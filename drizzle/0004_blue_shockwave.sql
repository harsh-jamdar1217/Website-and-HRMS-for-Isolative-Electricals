CREATE TABLE `catalogue_items` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`kind` text DEFAULT 'SERVICE' NOT NULL,
	`summary` text NOT NULL,
	`description` text NOT NULL,
	`highlights` text,
	`applications` text,
	`facts` text,
	`image_path` text,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`sort_order` integer DEFAULT 100 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalogue_slug_uq` ON `catalogue_items` (`slug`);--> statement-breakpoint
CREATE INDEX `catalogue_status_idx` ON `catalogue_items` (`status`,`category`,`sort_order`);--> statement-breakpoint
ALTER TABLE `enquiries` ADD `catalogue_item_id` text;--> statement-breakpoint
ALTER TABLE `enquiries` ADD `item_title` text;