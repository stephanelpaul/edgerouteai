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
