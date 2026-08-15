ALTER TABLE `order_items` ADD `status` varchar(20) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `deliveredAt` timestamp;