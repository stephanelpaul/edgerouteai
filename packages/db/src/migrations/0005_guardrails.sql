CREATE TABLE `guardrails` (
	`id` text PRIMARY KEY NOT NULL,
	`api_key_id` text NOT NULL,
	`name` text NOT NULL,
	`config` text NOT NULL,
	`is_active` integer DEFAULT true,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`api_key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `guardrails_api_key_idx` ON `guardrails` (`api_key_id`);
