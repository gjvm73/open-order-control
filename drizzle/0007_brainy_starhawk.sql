ALTER TABLE `uploads` ADD `acceptedRows` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `uploads` ADD `consolidatedRows` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `uploads` ADD `rejectedRows` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `uploads` ADD `duplicateRows` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `uploads` ADD `rejectionReasons` text;