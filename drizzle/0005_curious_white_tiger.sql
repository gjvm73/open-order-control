CREATE TABLE `prioritization_settings` (
	`id` int NOT NULL,
	`predictionChangeWeight` int NOT NULL DEFAULT 4,
	`noSupplierWeight` int NOT NULL DEFAULT 5,
	`overdueWeight` int NOT NULL DEFAULT 3,
	`highPriorityWeight` int NOT NULL DEFAULT 2,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `prioritization_settings_id` PRIMARY KEY(`id`)
);
