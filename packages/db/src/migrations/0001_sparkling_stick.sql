CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`api_key_id` text NOT NULL,
	`monthly_limit_usd` real NOT NULL,
	`current_spend_usd` real DEFAULT 0 NOT NULL,
	`period_start` integer NOT NULL,
	`is_disabled` integer DEFAULT false,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`api_key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `model_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`alias` text NOT NULL,
	`target_model` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `model_aliases_user_alias_idx` ON `model_aliases` (`user_id`,`alias`);