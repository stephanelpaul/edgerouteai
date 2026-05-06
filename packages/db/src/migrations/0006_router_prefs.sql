CREATE TABLE `user_router_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`api_key_id` text,
	`pinned_providers` text NOT NULL DEFAULT '[]',
	`excluded_providers` text NOT NULL DEFAULT '[]',
	`max_cost_per_request_cents` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`api_key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `user_router_prefs_user_key_idx` ON `user_router_preferences` (`user_id`,`api_key_id`);
