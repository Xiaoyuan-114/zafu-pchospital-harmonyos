-- Issue #102 检测：新增一张检测记录表，挂在客户账号与（可选的）设备上。
--
-- 只存症状答案与服务端当时的结论快照；没有、也不会有硬件读数列。

-- CreateTable
CREATE TABLE `diagnostic_sessions` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `device_id` CHAR(36) NULL,
    `category_code` VARCHAR(32) NOT NULL,
    `answers` JSON NOT NULL,
    `outcome` VARCHAR(24) NOT NULL,
    `created_at` DATETIME(3) NOT NULL,

    INDEX `diagnostic_sessions_user_created_idx`(`user_id`, `created_at`),
    INDEX `diagnostic_sessions_device_idx`(`device_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `diagnostic_sessions`
    ADD CONSTRAINT `diagnostic_sessions_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `diagnostic_sessions`
    ADD CONSTRAINT `diagnostic_sessions_device_id_fkey`
    FOREIGN KEY (`device_id`) REFERENCES `customer_devices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
