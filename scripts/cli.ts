import { execSync } from 'child_process'
import { randomUUID, randomBytes, pbkdf2Sync, createHash } from 'crypto'

const DB_NAME = 'edgerouteai-db'
const API_URL = 'https://edgerouteai-api.remediumdev.workers.dev'

// Parse args
const args = process.argv.slice(2)
const command = args[0]

function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`)
  return idx !== -1 ? args[idx + 1] : undefined
}

function d1Execute(sql: string): string {
  try {
    const result = execSync(
      `npx wrangler d1 execute ${DB_NAME} --remote --command "${sql.replace(/"/g, '\\"')}"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    )
    return result
  } catch (e: any) {
    console.error('D1 execute failed:', e.stderr || e.message)
    process.exit(1)
  }
}

function hashPassword(password: string): string {
  // PBKDF2 format matching the Workers crypto.subtle implementation
  const salt = randomBytes(16)
  const hash = pbkdf2Sync(password, salt, 100000, 32, 'sha256')
  return salt.toString('hex') + ':' + hash.toString('hex')
}

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = randomBytes(48)
  return 'sk-er-' + Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

async function main() {
  switch (command) {
    case 'setup':
      await setup()
      break
    case 'create-user':
      await createUser()
      break
    case 'reset-password':
      await resetPassword()
      break
    case 'list-users':
      await listUsers()
      break
    case 'create-key':
      await createKey()
      break
    case 'set-role':
      await setRole()
      break
    case 'deploy':
      await deploy()
      break
    default:
      printHelp()
  }
}

async function setup() {
  console.log('\n🚀 EdgeRouteAI First-Time Setup\n')

  // Create all tables
  console.log('📦 Creating database tables...')
  const tables = [
    `CREATE TABLE IF NOT EXISTS "user" ("id" text PRIMARY KEY NOT NULL, "name" text NOT NULL, "email" text NOT NULL, "emailVerified" integer NOT NULL DEFAULT 0, "image" text, "createdAt" integer NOT NULL, "updatedAt" integer NOT NULL)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "user_email_idx" ON "user" ("email")`,
    `CREATE TABLE IF NOT EXISTS "session" ("id" text PRIMARY KEY NOT NULL, "expiresAt" integer NOT NULL, "token" text NOT NULL, "createdAt" integer NOT NULL, "updatedAt" integer NOT NULL, "ipAddress" text, "userAgent" text, "userId" text NOT NULL REFERENCES "user"("id"))`,
    `CREATE TABLE IF NOT EXISTS "account" ("id" text PRIMARY KEY NOT NULL, "accountId" text NOT NULL, "providerId" text NOT NULL, "userId" text NOT NULL REFERENCES "user"("id"), "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" integer, "refreshTokenExpiresAt" integer, "scope" text, "password" text, "createdAt" integer NOT NULL, "updatedAt" integer NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS "verification" ("id" text PRIMARY KEY NOT NULL, "identifier" text NOT NULL, "value" text NOT NULL, "expiresAt" integer NOT NULL, "createdAt" integer, "updatedAt" integer)`,
    `CREATE TABLE IF NOT EXISTS "users" ("id" text PRIMARY KEY NOT NULL, "email" text NOT NULL, "name" text, "avatar" text, "created_at" integer NOT NULL)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email")`,
    `CREATE TABLE IF NOT EXISTS "api_keys" ("id" text PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "name" text NOT NULL, "key_hash" text NOT NULL, "key_prefix" text NOT NULL, "rate_limit" integer, "model_restrictions" text, "last_used_at" integer, "created_at" integer NOT NULL, "revoked_at" integer, FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_hash_idx" ON "api_keys" ("key_hash")`,
    `CREATE TABLE IF NOT EXISTS "provider_keys" ("id" text PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "provider" text NOT NULL, "encrypted_key" blob NOT NULL, "iv" blob NOT NULL, "is_valid" integer DEFAULT 1, "last_verified_at" integer, "created_at" integer NOT NULL, FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "provider_keys_user_provider_idx" ON "provider_keys" ("user_id","provider")`,
    `CREATE TABLE IF NOT EXISTS "request_logs" ("id" text PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "api_key_id" text NOT NULL, "provider" text NOT NULL, "model" text NOT NULL, "input_tokens" integer, "output_tokens" integer, "cost_usd" real, "latency_ms" integer, "status_code" integer NOT NULL, "error_message" text, "created_at" integer NOT NULL, FOREIGN KEY ("user_id") REFERENCES "users"("id"), FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id"))`,
    `CREATE TABLE IF NOT EXISTS "routing_configs" ("id" text PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "name" text NOT NULL, "fallback_chain" text NOT NULL, "is_default" integer DEFAULT 0, "created_at" integer NOT NULL, FOREIGN KEY ("user_id") REFERENCES "users"("id"))`,
  ]

  for (const sql of tables) {
    d1Execute(sql)
  }
  console.log('✅ Tables created')

  // Create admin user
  const email = getArg('email')
  const password = getArg('password')
  const name = getArg('name') || 'Admin'

  if (email && password) {
    console.log(`\n👤 Creating admin user: ${email}`)
    await doCreateUser(name, email, password)
  } else {
    console.log('\n⚠️  No --email and --password provided. Run "pnpm cli create-user" to create a user later.')
  }

  console.log('\n✅ Setup complete!\n')
  console.log(`  API:       ${API_URL}`)
  console.log(`  Dashboard: https://edgerouteai-web.pages.dev`)
  console.log('')
}

async function doCreateUser(name: string, email: string, password: string, role: string = 'user') {
  const userId = randomUUID()
  const accountId = randomUUID()
  const now = Date.now()
  const hashedPassword = hashPassword(password)

  // Check if this is the first user (for setup command)
  const countResult = d1Execute(`SELECT COUNT(*) as count FROM "user"`)
  const countMatch = countResult.match(/"count"\s*:\s*(\d+)/)
  const userCount = countMatch ? parseInt(countMatch[1], 10) : 1
  const effectiveRole = userCount === 0 ? 'superadmin' : role

  // Create Better Auth user
  d1Execute(`INSERT OR IGNORE INTO "user" ("id", "name", "email", "emailVerified", "role", "createdAt", "updatedAt") VALUES ('${userId}', '${name}', '${email}', 1, '${effectiveRole}', ${now}, ${now})`)

  // Create Better Auth credential account
  d1Execute(`INSERT OR IGNORE INTO "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt") VALUES ('${accountId}', '${userId}', 'credential', '${userId}', '${hashedPassword}', ${now}, ${now})`)

  // Also create in our users table (for API key references)
  d1Execute(`INSERT OR IGNORE INTO "users" ("id", "email", "name", "created_at") VALUES ('${userId}', '${email}', '${name}', ${now})`)

  // Create API key
  const rawKey = generateApiKey()
  const keyHash = hashApiKey(rawKey)
  const keyPrefix = rawKey.substring(0, 12)
  const keyId = randomUUID()

  d1Execute(`INSERT INTO "api_keys" ("id", "user_id", "name", "key_hash", "key_prefix", "created_at") VALUES ('${keyId}', '${userId}', 'Default Key', '${keyHash}', '${keyPrefix}', ${now})`)

  console.log(`✅ User created: ${email} (role: ${effectiveRole})`)
  console.log(`🔑 API Key (save this — shown only once): ${rawKey}`)
}

async function createUser() {
  const email = getArg('email')
  const password = getArg('password')
  const name = getArg('name') || 'User'
  const role = getArg('role') || 'user'

  if (!email || !password) {
    console.error('Usage: pnpm cli create-user --email <email> --password <password> [--name <name>] [--role <role>]')
    process.exit(1)
  }

  if (!['superadmin', 'admin', 'user'].includes(role)) {
    console.error('Invalid role. Must be one of: superadmin, admin, user')
    process.exit(1)
  }

  await doCreateUser(name, email, password, role)
}

async function setRole() {
  const email = getArg('email')
  const role = getArg('role')

  if (!email || !role) {
    console.error('Usage: pnpm cli set-role --email <email> --role <role>')
    console.error('Roles: superadmin, admin, user')
    process.exit(1)
  }

  if (!['superadmin', 'admin', 'user'].includes(role)) {
    console.error('Invalid role. Must be one of: superadmin, admin, user')
    process.exit(1)
  }

  const now = Date.now()
  d1Execute(`UPDATE "user" SET role = '${role}', "updatedAt" = ${now} WHERE email = '${email}'`)
  console.log(`✅ Role set to "${role}" for ${email}`)
}

async function resetPassword() {
  const email = getArg('email')
  const password = getArg('password')

  if (!email || !password) {
    console.error('Usage: pnpm cli reset-password --email <email> --password <password>')
    process.exit(1)
  }

  const hashedPassword = hashPassword(password)
  const now = Date.now()

  // Find user ID
  const result = d1Execute(`SELECT id FROM "user" WHERE email = '${email}'`)
  // Parse the JSON output to find the user ID
  const match = result.match(/"id"\s*:\s*"([^"]+)"/)
  if (!match) {
    console.error(`User not found: ${email}`)
    process.exit(1)
  }

  const userId = match[1]
  d1Execute(`UPDATE "account" SET "password" = '${hashedPassword}', "updatedAt" = ${now} WHERE "userId" = '${userId}' AND "providerId" = 'credential'`)

  console.log(`✅ Password reset for ${email}`)
}

async function listUsers() {
  const result = d1Execute(`SELECT id, email, name, role, createdAt FROM "user" ORDER BY createdAt DESC`)
  console.log('\n👥 Users:\n')

  // Parse JSON from wrangler output
  try {
    const jsonMatch = result.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const outerArr = JSON.parse(jsonMatch[0])
      const rows = outerArr[0]?.results || []
      if (rows.length === 0) {
        console.log('  No users found. Run "pnpm cli create-user" to create one.')
        return
      }
      console.log('  ID                                    Email                     Name        Role         Created')
      console.log('  ' + '-'.repeat(105))
      for (const row of rows) {
        const date = new Date(row.createdAt).toISOString().split('T')[0]
        console.log(`  ${row.id}  ${row.email.padEnd(25)} ${(row.name || '-').padEnd(10)}  ${(row.role || 'user').padEnd(12)} ${date}`)
      }
    }
  } catch {
    console.log(result)
  }
  console.log('')
}

async function createKey() {
  const email = getArg('email')
  const name = getArg('name') || 'CLI Key'

  if (!email) {
    console.error('Usage: pnpm cli create-key --email <email> [--name <name>]')
    process.exit(1)
  }

  // Find user ID from our users table
  const result = d1Execute(`SELECT id FROM "users" WHERE email = '${email}'`)
  const match = result.match(/"id"\s*:\s*"([^"]+)"/)
  if (!match) {
    console.error(`User not found: ${email}`)
    process.exit(1)
  }

  const userId = match[1]
  const rawKey = generateApiKey()
  const keyHash = hashApiKey(rawKey)
  const keyPrefix = rawKey.substring(0, 12)
  const keyId = randomUUID()
  const now = Date.now()

  d1Execute(`INSERT INTO "api_keys" ("id", "user_id", "name", "key_hash", "key_prefix", "created_at") VALUES ('${keyId}', '${userId}', '${name}', '${keyHash}', '${keyPrefix}', ${now})`)

  console.log(`✅ API Key created for ${email}`)
  console.log(`🔑 Key (save this — shown only once): ${rawKey}`)
}

async function deploy() {
  console.log('\n🚀 Deploying EdgeRouteAI...\n')

  console.log('📡 Deploying API...')
  execSync('cd apps/api && npx wrangler deploy', { stdio: 'inherit' })

  console.log('\n🌐 Building dashboard...')
  execSync('cd apps/web && NEXT_PUBLIC_API_URL=https://edgerouteai-api.remediumdev.workers.dev npx next build', { stdio: 'inherit' })

  console.log('\n📄 Deploying dashboard...')
  execSync('npx wrangler pages deploy apps/web/out --project-name edgerouteai-web --branch main --commit-dirty=true', { stdio: 'inherit' })

  console.log('\n✅ Deploy complete!')
  console.log(`  API:       ${API_URL}`)
  console.log(`  Dashboard: https://edgerouteai-web.pages.dev\n`)
}

function printHelp() {
  console.log(`
EdgeRouteAI CLI

Usage: pnpm cli <command> [options]

Commands:
  setup              First-time setup (creates DB tables, optional admin user)
                     --email <email> --password <pw> [--name <name>]

  create-user        Create a new user with API key
                     --email <email> --password <pw> [--name <name>] [--role <role>]

  reset-password     Reset a user's password
                     --email <email> --password <pw>

  list-users         List all users (includes role column)

  set-role           Set a user's role
                     --email <email> --role <superadmin|admin|user>

  create-key         Create a new API key for a user
                     --email <email> [--name <key-name>]

  deploy             Deploy API + Dashboard to Cloudflare
`)
}

main().catch(console.error)
