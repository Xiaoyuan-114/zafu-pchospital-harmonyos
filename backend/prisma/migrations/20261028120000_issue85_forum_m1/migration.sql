-- Issue #85 论坛 M1：只新增独立帖子、评论与帖子图片表，不修改既有表或数据。

-- CreateTable
CREATE TABLE `forum_posts` (
    `id` CHAR(36) NOT NULL,
    `author_id` CHAR(36) NOT NULL,
    `category` VARCHAR(32) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `body` TEXT NOT NULL,
    `create_request_key` VARCHAR(128) NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `forum_posts_author_request_uq`(`author_id`, `create_request_key`),
    INDEX `forum_posts_public_created_idx`(`deleted_at`, `category`, `created_at`, `id`),
    INDEX `forum_posts_author_created_idx`(`author_id`, `deleted_at`, `created_at`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `forum_comments` (
    `id` CHAR(36) NOT NULL,
    `post_id` CHAR(36) NOT NULL,
    `author_id` CHAR(36) NOT NULL,
    `body` TEXT NOT NULL,
    `create_request_key` VARCHAR(128) NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `forum_comments_author_request_uq`(`author_id`, `create_request_key`),
    INDEX `forum_comments_post_created_idx`(`post_id`, `deleted_at`, `created_at`, `id`),
    INDEX `forum_comments_author_created_idx`(`author_id`, `deleted_at`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `forum_post_images` (
    `id` CHAR(36) NOT NULL,
    `post_id` CHAR(36) NOT NULL,
    `storage_key` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(64) NOT NULL,
    `size_bytes` INT NOT NULL,
    `sha256_digest` BINARY(32) NOT NULL,
    `upload_key` VARCHAR(128) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `forum_post_images_storage_key_uq`(`storage_key`),
    UNIQUE INDEX `forum_post_images_post_upload_uq`(`post_id`, `upload_key`),
    INDEX `forum_post_images_post_sort_idx`(`post_id`, `deleted_at`, `sort_order`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `forum_posts` ADD CONSTRAINT `forum_posts_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `forum_comments` ADD CONSTRAINT `forum_comments_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `forum_posts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `forum_comments` ADD CONSTRAINT `forum_comments_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `forum_post_images` ADD CONSTRAINT `forum_post_images_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `forum_posts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
