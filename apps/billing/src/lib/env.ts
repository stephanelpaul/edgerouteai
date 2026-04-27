export interface BillingEnv {
	DB: D1Database
	ENVIRONMENT: string
	// Polar (test or live, whichever is deployed). Set via `wrangler secret put`.
	POLAR_ACCESS_TOKEN: string
	POLAR_WEBHOOK_SECRET: string
	// One Polar product id per credit-pack size.
	POLAR_PRODUCT_PACK_5: string
	POLAR_PRODUCT_PACK_20: string
	POLAR_PRODUCT_PACK_50: string
	POLAR_PRODUCT_PACK_100: string
	// Session secret for cookie-auth (shared with apps/web / apps/api).
	SESSION_SECRET: string
	// Dashboard URL for checkout success/cancel redirects.
	DASHBOARD_URL: string
}

export interface BillingContext {
	Bindings: BillingEnv
	Variables: {
		userId: string
	}
}
