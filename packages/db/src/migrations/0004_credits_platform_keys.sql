CREATE TABLE `platform_upstream_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`label` text DEFAULT 'Default',
	`encrypted_key` blob NOT NULL,
	`iv` blob NOT NULL,
	`is_active` integer DEFAULT true,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `platform_upstream_keys_provider_idx` ON `platform_upstream_keys` (`provider`);--> statement-breakpoint
CREATE TABLE `payment_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`type` text NOT NULL,
	`user_id` text,
	`amount_cents` integer,
	`processed_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `usage_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`request_log_id` text NOT NULL,
	`cost_cents` integer NOT NULL,
	`markup_cents` integer NOT NULL,
	`total_debited_cents` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`request_log_id`) REFERENCES `request_logs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `usage_ledger_user_created_idx` ON `usage_ledger` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `user_credits` (
	`user_id` text PRIMARY KEY NOT NULL,
	`balance_cents` integer DEFAULT 0 NOT NULL,
	`lifetime_topped_up_cents` integer DEFAULT 0 NOT NULL,
	`lifetime_spent_cents` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
-- NOTE: the `label` column on provider_keys is already in migration 0003,
-- so it's omitted here even though the Drizzle generator re-detects it
-- (stale meta snapshot). The column exists; do not re-add.
