CREATE TABLE `counters` (
	`name` text PRIMARY KEY NOT NULL,
	`value` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`application_id` text NOT NULL,
	`employee_code` text NOT NULL,
	`department` text NOT NULL,
	`job_title` text NOT NULL,
	`employment_type` text NOT NULL,
	`joining_date` integer NOT NULL,
	`status` text DEFAULT 'ONBOARDING' NOT NULL,
	`address_line` text,
	`emergency_name` text,
	`emergency_phone` text,
	`emergency_relation` text,
	`onboarding_completed_at` integer,
	`created_by_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employees_user_uq` ON `employees` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `employees_application_uq` ON `employees` (`application_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `employees_code_uq` ON `employees` (`employee_code`);--> statement-breakpoint
CREATE INDEX `employees_status_idx` ON `employees` (`status`);--> statement-breakpoint
CREATE TABLE `onboarding_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`key` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`owner` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`completed_at` integer,
	`completed_by_id` text,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`completed_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `onboarding_task_uq` ON `onboarding_tasks` (`employee_id`,`key`);