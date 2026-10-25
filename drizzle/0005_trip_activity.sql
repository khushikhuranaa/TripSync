CREATE TABLE `trip_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`actor_id` text,
	`kind` text NOT NULL,
	`summary` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `trip_activity_trip_idx` ON `trip_activity` (`trip_id`,`created_at`);
