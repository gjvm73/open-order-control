ALTER TABLE `order_items` DROP INDEX `order_items_item_customer_po_unique`;--> statement-breakpoint
ALTER TABLE `order_items` ADD `comparisonKey` varchar(255) NULL;--> statement-breakpoint
UPDATE `order_items`
SET `comparisonKey` = CONCAT(
  UPPER(TRIM(COALESCE(`shipTo`, 'SEM FILIAL INFORMADA'))),
  '::',
  UPPER(TRIM(`item`)),
  '::',
  UPPER(TRIM(COALESCE(`customerPo`, 'SEM PO')))
);--> statement-breakpoint
ALTER TABLE `order_items` MODIFY `comparisonKey` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_comparison_key_unique` UNIQUE(`comparisonKey`);--> statement-breakpoint
