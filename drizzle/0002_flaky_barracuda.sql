ALTER TABLE `packing_items` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `polls` ADD `description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `trip_notes` ADD `category` text DEFAULT 'General' NOT NULL;