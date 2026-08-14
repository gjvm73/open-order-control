CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shipTo` text,
	`customerPo` varchar(100),
	`shipmentPriority` varchar(50),
	`orderCreationDate` varchar(50),
	`item` varchar(100) NOT NULL,
	`itemDescription` text,
	`quantity` decimal(12,2) DEFAULT '0',
	`scheduledReserved` decimal(12,2) DEFAULT '0',
	`unitSellingPrice` decimal(12,4) DEFAULT '0',
	`extendedPrice` decimal(12,4) DEFAULT '0',
	`currentPrediction` text,
	`previousPrediction` text,
	`longText` text,
	`predictionChangesCount` int NOT NULL DEFAULT 0,
	`lastPredictionChangeDate` timestamp,
	`lastUploadId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prediction_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderItemId` int NOT NULL,
	`uploadId` int NOT NULL,
	`item` varchar(100) NOT NULL,
	`customerPo` varchar(100),
	`prediction` text NOT NULL,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `prediction_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `uploads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`uploadDate` timestamp NOT NULL DEFAULT (now()),
	`totalRows` int NOT NULL DEFAULT 0,
	`changedRowsCount` int NOT NULL DEFAULT 0,
	`uploadedBy` int,
	CONSTRAINT `uploads_id` PRIMARY KEY(`id`)
);
