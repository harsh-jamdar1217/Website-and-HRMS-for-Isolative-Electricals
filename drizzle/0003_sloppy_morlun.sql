CREATE TABLE `meeting_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`meeting_id` text NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`email` text NOT NULL,
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meeting_participant_uq` ON `meeting_participants` (`meeting_id`,`email`);--> statement-breakpoint
CREATE INDEX `meeting_participant_user_idx` ON `meeting_participants` (`user_id`);--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` text PRIMARY KEY NOT NULL,
	`uid` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`starts_at` integer NOT NULL,
	`duration_min` integer NOT NULL,
	`location` text,
	`meeting_link` text,
	`agenda` text,
	`status` text DEFAULT 'SCHEDULED' NOT NULL,
	`cancel_reason` text,
	`sequence` integer DEFAULT 0 NOT NULL,
	`organizer_id` text NOT NULL,
	`application_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organizer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meetings_uid_uq` ON `meetings` (`uid`);--> statement-breakpoint
CREATE INDEX `meetings_start_idx` ON `meetings` (`starts_at`);--> statement-breakpoint
CREATE INDEX `meetings_app_idx` ON `meetings` (`application_id`);--> statement-breakpoint
ALTER TABLE `email_logs` ADD `ics_content` text;