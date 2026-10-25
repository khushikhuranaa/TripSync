ALTER TABLE `user` ADD `two_factor_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE `two_factor` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`secret` text NOT NULL,
	`backup_codes` text NOT NULL,
	`verified` integer DEFAULT true NOT NULL,
	`failed_verification_count` integer DEFAULT 0 NOT NULL,
	`locked_until` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `two_factor_secret_idx` ON `two_factor` (`secret`);--> statement-breakpoint
CREATE INDEX `two_factor_user_idx` ON `two_factor` (`user_id`);--> statement-breakpoint
CREATE TABLE `admin_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`target_id` text,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_audit_actor_idx` ON `admin_audit_log` (`actor_id`);
