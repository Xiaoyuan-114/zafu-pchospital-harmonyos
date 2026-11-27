-- AlterTable
ALTER TABLE `repair_activity_registrations` ADD COLUMN `points_eligible` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `forum_posts` ADD COLUMN `circle_id` CHAR(36) NULL;

-- CreateTable
CREATE TABLE `forum_follows` (
    `user_id` CHAR(36) NOT NULL,
    `target_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `forum_follows_target_id_idx`(`target_id`),
    PRIMARY KEY (`user_id`, `target_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `forum_circles` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(60) NOT NULL,
    `description` VARCHAR(1000) NOT NULL,
    `category` VARCHAR(40) NOT NULL,
    `cover_url` VARCHAR(1000) NULL,
    `archived` BOOLEAN NOT NULL DEFAULT false,
    `created_by` CHAR(36) NOT NULL,
    `create_request_key` VARCHAR(128) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `forum_circles_category_created_at_idx`(`category`, `created_at`),
    UNIQUE INDEX `forum_circles_created_by_create_request_key_key`(`created_by`, `create_request_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `forum_circle_memberships` (
    `user_id` CHAR(36) NOT NULL,
    `circle_id` CHAR(36) NOT NULL,
    `joined_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `forum_circle_memberships_circle_id_idx`(`circle_id`),
    PRIMARY KEY (`user_id`, `circle_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `community_daily_check_ins` (
    `user_id` CHAR(36) NOT NULL,
    `day` DATE NOT NULL,
    `streak` INTEGER NOT NULL,
    `points` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`user_id`, `day`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `community_point_entries` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `source` VARCHAR(32) NOT NULL,
    `source_key` VARCHAR(128) NOT NULL,
    `activity_id` CHAR(36) NULL,
    `amount` INTEGER NOT NULL,
    `description` VARCHAR(200) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `community_point_entries_user_id_created_at_id_idx`(`user_id`, `created_at`, `id`),
    UNIQUE INDEX `community_point_entries_user_id_source_source_key_key`(`user_id`, `source`, `source_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `community_activity_rewards` (
    `user_id` CHAR(36) NOT NULL,
    `activity_id` CHAR(36) NOT NULL,
    `awarded` BOOLEAN NOT NULL DEFAULT false,
    `revision` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`user_id`, `activity_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `forum_posts_circle_created_idx` ON `forum_posts`(`circle_id`, `deleted_at`, `created_at`, `id`);

-- AddForeignKey
ALTER TABLE `forum_follows` ADD CONSTRAINT `forum_follows_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `forum_follows` ADD CONSTRAINT `forum_follows_target_id_fkey` FOREIGN KEY (`target_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `forum_circles` ADD CONSTRAINT `forum_circles_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `forum_circle_memberships` ADD CONSTRAINT `forum_circle_memberships_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `forum_circle_memberships` ADD CONSTRAINT `forum_circle_memberships_circle_id_fkey` FOREIGN KEY (`circle_id`) REFERENCES `forum_circles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `community_daily_check_ins` ADD CONSTRAINT `community_daily_check_ins_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `community_point_entries` ADD CONSTRAINT `community_point_entries_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `community_activity_rewards` ADD CONSTRAINT `community_activity_rewards_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `forum_posts` ADD CONSTRAINT `forum_posts_circle_id_fkey` FOREIGN KEY (`circle_id`) REFERENCES `forum_circles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
