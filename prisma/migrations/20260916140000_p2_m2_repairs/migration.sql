CREATE TABLE `repair_categories` (
  `id` CHAR(36) NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `description` VARCHAR(500) NULL,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_by` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,
  UNIQUE INDEX `repair_categories_code_uq`(`code`),
  INDEX `repair_categories_active_sort_idx`(`is_active`, `sort_order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `repair_records` (
  `id` CHAR(36) NOT NULL,
  `member_profile_id` CHAR(36) NOT NULL,
  `repair_date` DATE NULL,
  `duration_minutes` INTEGER NULL,
  `category_id` CHAR(36) NULL,
  `content` TEXT NULL,
  `result` VARCHAR(32) NULL,
  `remark` VARCHAR(2000) NULL,
  `status` VARCHAR(32) NOT NULL,
  `is_difficult` BOOLEAN NOT NULL DEFAULT false,
  `is_typical` BOOLEAN NOT NULL DEFAULT false,
  `version` INTEGER NOT NULL DEFAULT 1,
  `create_request_key` VARCHAR(128) NOT NULL,
  `submitted_at` DATETIME(3) NULL,
  `reviewed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,
  UNIQUE INDEX `repair_records_create_request_uq`(`create_request_key`),
  INDEX `repair_records_member_status_date_idx`(`member_profile_id`, `status`, `repair_date`),
  INDEX `repair_records_status_submitted_idx`(`status`, `submitted_at`),
  INDEX `repair_records_category_status_date_idx`(`category_id`, `status`, `repair_date`),
  INDEX `repair_records_date_idx`(`repair_date`),
  INDEX `repair_records_difficult_status_idx`(`is_difficult`, `status`),
  INDEX `repair_records_typical_status_idx`(`is_typical`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `repair_photos` (
  `id` CHAR(36) NOT NULL, `repair_record_id` CHAR(36) NOT NULL,
  `storage_key` VARCHAR(255) NOT NULL, `original_name` VARCHAR(255) NULL,
  `mime_type` VARCHAR(64) NOT NULL, `size_bytes` INTEGER NOT NULL,
  `sha256_digest` BINARY(32) NOT NULL, `sort_order` INTEGER NOT NULL DEFAULT 0,
  `uploaded_by_user_id` CHAR(36) NOT NULL, `created_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,
  UNIQUE INDEX `repair_photos_storage_key_uq`(`storage_key`),
  INDEX `repair_photos_record_sort_idx`(`repair_record_id`, `deleted_at`, `sort_order`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `repair_reviews` (
  `id` CHAR(36) NOT NULL, `repair_record_id` CHAR(36) NOT NULL,
  `reviewer_user_id` CHAR(36) NOT NULL, `decision` VARCHAR(32) NOT NULL,
  `note` VARCHAR(2000) NULL, `idempotency_key` VARCHAR(128) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `repair_reviews_idempotency_uq`(`idempotency_key`),
  INDEX `repair_reviews_record_created_idx`(`repair_record_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `repair_timeline_events` (
  `id` CHAR(36) NOT NULL, `repair_record_id` CHAR(36) NOT NULL,
  `actor_user_id` CHAR(36) NULL, `event_type` VARCHAR(32) NOT NULL,
  `summary` JSON NULL, `created_at` DATETIME(3) NOT NULL,
  INDEX `repair_timeline_record_created_idx`(`repair_record_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

ALTER TABLE `repair_categories` ADD CONSTRAINT `repair_categories_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `repair_records` ADD CONSTRAINT `repair_records_member_profile_id_fkey` FOREIGN KEY (`member_profile_id`) REFERENCES `member_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `repair_records` ADD CONSTRAINT `repair_records_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `repair_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `repair_photos` ADD CONSTRAINT `repair_photos_repair_record_id_fkey` FOREIGN KEY (`repair_record_id`) REFERENCES `repair_records`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `repair_photos` ADD CONSTRAINT `repair_photos_uploaded_by_user_id_fkey` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `repair_reviews` ADD CONSTRAINT `repair_reviews_repair_record_id_fkey` FOREIGN KEY (`repair_record_id`) REFERENCES `repair_records`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `repair_reviews` ADD CONSTRAINT `repair_reviews_reviewer_user_id_fkey` FOREIGN KEY (`reviewer_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `repair_timeline_events` ADD CONSTRAINT `repair_timeline_repair_record_id_fkey` FOREIGN KEY (`repair_record_id`) REFERENCES `repair_records`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `repair_timeline_events` ADD CONSTRAINT `repair_timeline_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
