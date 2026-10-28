CREATE TABLE `application_events` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`actor_id` text,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `app_events_idx` ON `application_events` (`application_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`candidate_id` text NOT NULL,
	`vacancy_id` text NOT NULL,
	`status` text DEFAULT 'PENDING_VERIFICATION' NOT NULL,
	`cover_note` text,
	`submitted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`vacancy_id`) REFERENCES `vacancies`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `applications_reference_uq` ON `applications` (`reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `applications_candidate_vacancy_uq` ON `applications` (`candidate_id`,`vacancy_id`);--> statement-breakpoint
CREATE INDEX `applications_status_idx` ON `applications` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `candidate_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`phone` text,
	`city` text,
	`qualification` text,
	`experience_years` integer,
	`summary` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`type` text NOT NULL,
	`original_name` text NOT NULL,
	`storage_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`scan_status` text DEFAULT 'NOT_SCANNED' NOT NULL,
	`review_status` text DEFAULT 'PENDING' NOT NULL,
	`review_note` text,
	`superseded_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_key_uq` ON `documents` (`storage_key`);--> statement-breakpoint
CREATE INDEX `documents_app_idx` ON `documents` (`application_id`);--> statement-breakpoint
CREATE TABLE `vacancies` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`department` text,
	`location` text NOT NULL,
	`employment_type` text NOT NULL,
	`description` text NOT NULL,
	`eligibility` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`closes_at` integer,
	`created_by_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vacancies_slug_uq` ON `vacancies` (`slug`);--> statement-breakpoint
CREATE INDEX `vacancies_status_idx` ON `vacancies` (`status`);--> statement-breakpoint
CREATE TABLE `verification_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`purpose` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vtoken_hash_uq` ON `verification_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `vtoken_user_idx` ON `verification_tokens` (`user_id`,`purpose`);