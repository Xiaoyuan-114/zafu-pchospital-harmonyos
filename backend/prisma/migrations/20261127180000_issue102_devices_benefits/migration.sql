-- Issue #102 设备与权益：新增客户设备、设备权益两张表，
-- 并给报修单加一个可空的 device_id。历史单据保持 NULL，不做推测性回填。

-- CreateTable
CREATE TABLE `customer_devices` (
    `id` CHAR(36) NOT NULL,
    `owner_user_id` CHAR(36) NOT NULL,
    `label` VARCHAR(40) NOT NULL,
    `brand` VARCHAR(40) NOT NULL,
    `model` VARCHAR(60) NOT NULL,
    `serial_number` VARCHAR(120) NULL,
    `purchase_on` DATE NULL,
    `source` VARCHAR(16) NOT NULL,
    `status` VARCHAR(16) NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `customer_devices_owner_serial_uq`(`owner_user_id`, `serial_number`),
    INDEX `customer_devices_owner_status_idx`(`owner_user_id`, `status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `device_benefits` (
    `id` CHAR(36) NOT NULL,
    `device_id` CHAR(36) NOT NULL,
    `kind` VARCHAR(24) NOT NULL,
    `name` VARCHAR(60) NOT NULL,
    `provider` VARCHAR(60) NOT NULL,
    `start_on` DATE NOT NULL,
    `end_on` DATE NULL,
    `region` VARCHAR(80) NOT NULL,
    `total_uses` INTEGER NULL,
    `used_uses` INTEGER NOT NULL DEFAULT 0,
    `state` VARCHAR(16) NOT NULL,
    `note` VARCHAR(200) NULL,
    `created_by_user_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `device_benefits_device_idx`(`device_id`, `state`, `end_on`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `repair_orders` ADD COLUMN `device_id` CHAR(36) NULL;

-- CreateIndex
CREATE INDEX `repair_orders_device_created_idx` ON `repair_orders`(`device_id`, `created_at`);

-- AddForeignKey
ALTER TABLE `customer_devices`
    ADD CONSTRAINT `customer_devices_owner_user_id_fkey`
    FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `device_benefits`
    ADD CONSTRAINT `device_benefits_device_id_fkey`
    FOREIGN KEY (`device_id`) REFERENCES `customer_devices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `device_benefits`
    ADD CONSTRAINT `device_benefits_created_by_user_id_fkey`
    FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `repair_orders`
    ADD CONSTRAINT `repair_orders_device_id_fkey`
    FOREIGN KEY (`device_id`) REFERENCES `customer_devices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
