DROP INDEX IF EXISTS `provider_keys_user_provider_idx`;--> statement-breakpoint
ALTER TABLE `provider_keys` ADD `label` text DEFAULT 'Default';--> statement-breakpoint
CREATE INDEX `provider_keys_user_provider_idx` ON `provider_keys` (`user_id`,`provider`);
