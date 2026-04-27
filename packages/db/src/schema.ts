import { blob, index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable(
	'users',
	{
		id: text('id').primaryKey(),
		email: text('email').notNull(),
		name: text('name'),
		avatar: text('avatar'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
	},
	(table) => [uniqueIndex('users_email_idx').on(table.email)],
)

export const apiKeys = sqliteTable(
	'api_keys',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id),
		name: text('name').notNull(),
		keyHash: text('key_hash').notNull(),
		keyPrefix: text('key_prefix').notNull(),
		rateLimit: integer('rate_limit'),
		modelRestrictions: text('model_restrictions'),
		retryCount: integer('retry_count').default(2),
		timeoutMs: integer('timeout_ms').default(30000),
		lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
		revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
	},
	(table) => [uniqueIndex('api_keys_hash_idx').on(table.keyHash)],
)

export const providerKeys = sqliteTable(
	'provider_keys',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id),
		provider: text('provider').notNull(),
		label: text('label').default('Default'),
		encryptedKey: blob('encrypted_key', { mode: 'buffer' }).notNull(),
		iv: blob('iv', { mode: 'buffer' }).notNull(),
		isValid: integer('is_valid', { mode: 'boolean' }).default(true),
		lastVerifiedAt: integer('last_verified_at', { mode: 'timestamp_ms' }),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
	},
	(table) => [index('provider_keys_user_provider_idx').on(table.userId, table.provider)],
)

export const requestLogs = sqliteTable('request_logs', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id),
	apiKeyId: text('api_key_id')
		.notNull()
		.references(() => apiKeys.id),
	provider: text('provider').notNull(),
	model: text('model').notNull(),
	inputTokens: integer('input_tokens'),
	outputTokens: integer('output_tokens'),
	costUsd: real('cost_usd'),
	latencyMs: integer('latency_ms'),
	statusCode: integer('status_code').notNull(),
	errorMessage: text('error_message'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export const routingConfigs = sqliteTable('routing_configs', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id),
	name: text('name').notNull(),
	fallbackChain: text('fallback_chain').notNull(),
	isDefault: integer('is_default', { mode: 'boolean' }).default(false),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export const modelAliases = sqliteTable(
	'model_aliases',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id),
		alias: text('alias').notNull(),
		targetModel: text('target_model').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
	},
	(table) => [uniqueIndex('model_aliases_user_alias_idx').on(table.userId, table.alias)],
)

export const budgets = sqliteTable('budgets', {
	id: text('id').primaryKey(),
	apiKeyId: text('api_key_id')
		.notNull()
		.references(() => apiKeys.id),
	monthlyLimitUsd: real('monthly_limit_usd').notNull(),
	currentSpendUsd: real('current_spend_usd').notNull().default(0),
	periodStart: integer('period_start', { mode: 'timestamp_ms' }).notNull(),
	isDisabled: integer('is_disabled', { mode: 'boolean' }).default(false),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export const webhooks = sqliteTable('webhooks', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id),
	url: text('url').notNull(),
	events: text('events').notNull(), // JSON array: ["request.completed", "budget.exceeded"]
	secret: text('secret'),
	isActive: integer('is_active', { mode: 'boolean' }).default(true),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export const requestTransforms = sqliteTable('request_transforms', {
	id: text('id').primaryKey(),
	apiKeyId: text('api_key_id')
		.notNull()
		.references(() => apiKeys.id),
	type: text('type').notNull(), // "prepend_system", "append_system", "set_parameter"
	value: text('value').notNull(), // JSON — the content or parameter to inject
	isActive: integer('is_active', { mode: 'boolean' }).default(true),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

// Guardrails: per-api-key safety rules. config JSON shape:
//   {
//     blockPii?: { categories: ("email" | "phone" | "ssn" | "creditcard")[] },
//     blockedKeywords?: string[],
//     applyTo: "input" | "output" | "both",
//   }
// Action is implicit: "block" (return 400 with code "guardrail_blocked").
// Multiple rules per key are OR-combined: any match blocks the request.
export const guardrails = sqliteTable(
	'guardrails',
	{
		id: text('id').primaryKey(),
		apiKeyId: text('api_key_id')
			.notNull()
			.references(() => apiKeys.id),
		name: text('name').notNull(),
		config: text('config').notNull(),
		isActive: integer('is_active', { mode: 'boolean' }).default(true),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
	},
	(table) => [index('guardrails_api_key_idx').on(table.apiKeyId)],
)

// Platform-held upstream keys. One row per (provider, label); not user-owned.
// Used when a user opts into platform-managed keys and pays via credits.
export const platformUpstreamKeys = sqliteTable(
	'platform_upstream_keys',
	{
		id: text('id').primaryKey(),
		provider: text('provider').notNull(),
		label: text('label').default('Default'),
		encryptedKey: blob('encrypted_key', { mode: 'buffer' }).notNull(),
		iv: blob('iv', { mode: 'buffer' }).notNull(),
		isActive: integer('is_active', { mode: 'boolean' }).default(true),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
	},
	(table) => [index('platform_upstream_keys_provider_idx').on(table.provider)],
)

// User credit balance in integer cents. Kept small for atomic UPDATE ops.
export const userCredits = sqliteTable('user_credits', {
	userId: text('user_id')
		.primaryKey()
		.references(() => users.id),
	balanceCents: integer('balance_cents').notNull().default(0),
	lifetimeToppedUpCents: integer('lifetime_topped_up_cents').notNull().default(0),
	lifetimeSpentCents: integer('lifetime_spent_cents').notNull().default(0),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

// One row per platform-key request: provider cost + our markup + total debited.
export const usageLedger = sqliteTable(
	'usage_ledger',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id),
		requestLogId: text('request_log_id')
			.notNull()
			.references(() => requestLogs.id),
		costCents: integer('cost_cents').notNull(),
		markupCents: integer('markup_cents').notNull(),
		totalDebitedCents: integer('total_debited_cents').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
	},
	(table) => [index('usage_ledger_user_created_idx').on(table.userId, table.createdAt)],
)

// Payment provider webhook events we've processed, keyed on event.id for
// idempotency. Provider-agnostic (Polar today, could be anything tomorrow)
// so the gateway schema doesn't leak the proprietary billing integration.
export const paymentEvents = sqliteTable('payment_events', {
	eventId: text('event_id').primaryKey(),
	provider: text('provider').notNull(), // "polar" | ...
	type: text('type').notNull(),
	userId: text('user_id').references(() => users.id),
	amountCents: integer('amount_cents'),
	processedAt: integer('processed_at', { mode: 'timestamp_ms' }).notNull(),
})
