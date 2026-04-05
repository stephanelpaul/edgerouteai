CREATE TABLE `request_transforms` (
	`id` text PRIMARY KEY NOT NULL,
	`api_key_id` text NOT NULL,
	`type` text NOT NULL,
	`value` text NOT NULL,
	`is_active` integer DEFAULT true,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`api_key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `webhooks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`url` text NOT NULL,
	`events` text NOT NULL,
	`secret` text,
	`is_active` integer DEFAULT true,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `api_keys` ADD `retry_count` integer DEFAULT 2;--> statement-breakpoint
ALTER TABLE `api_keys` ADD `timeout_ms` integer DEFAULT 30000;