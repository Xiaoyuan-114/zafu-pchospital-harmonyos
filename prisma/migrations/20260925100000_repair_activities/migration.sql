-- 维修活动模块（M1）：活动 / 报名 / 成员出勤三表 + 分类 OTHER_FAULT。

CREATE TABLE `repair_activities` (
  `id` CHAR(36) NOT NULL,
  `title` VARCHAR(120) NOT NULL,
  `activity_at` DATETIME(3) NOT NULL,
  `capacity` INTEGER NOT NULL,
  `signup_opens_at` DATETIME(3) NOT NULL,
  `signup_closes_at` DATETIME(3) NOT NULL,
  `created_by` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,
  INDEX `repair_activities_deleted_activity_idx`(`deleted_at`, `activity_at`),
  INDEX `repair_activities_signup_window_idx`(`signup_opens_at`, `signup_closes_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `repair_activity_registrations` (
  `id` CHAR(36) NOT NULL,
  `activity_id` CHAR(36) NOT NULL,
  `name` VARCHAR(40) NOT NULL,
  `phone` VARCHAR(11) NOT NULL,
  `phone_last4` VARCHAR(4) NOT NULL,
  `issue_type` VARCHAR(32) NOT NULL,
  `status` VARCHAR(32) NOT NULL,
  `checked_in_at` DATETIME(3) NULL,
  `served_at` DATETIME(3) NULL,
  `served_by_member_profile_id` CHAR(36) NULL,
  `repair_record_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,
  UNIQUE INDEX `repair_activity_regs_repair_record_uq`(`repair_record_id`),
  INDEX `repair_activity_regs_activity_phone_idx`(`activity_id`, `phone`),
  INDEX `repair_activity_regs_activity_status_checked_idx`(`activity_id`, `status`, `checked_in_at`),
  INDEX `repair_activity_regs_activity_deleted_idx`(`activity_id`, `deleted_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `repair_activity_attendances` (
  `id` CHAR(36) NOT NULL,
  `activity_id` CHAR(36) NOT NULL,
  `member_profile_id` CHAR(36) NOT NULL,
  `checked_in_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `repair_activity_attendance_activity_member_uq`(`activity_id`, `member_profile_id`),
  INDEX `repair_activity_attendance_member_idx`(`member_profile_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

ALTER TABLE `repair_activities`
  ADD CONSTRAINT `repair_activities_created_by_fkey`
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `repair_activity_registrations`
  ADD CONSTRAINT `repair_activity_regs_activity_id_fkey`
  FOREIGN KEY (`activity_id`) REFERENCES `repair_activities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `repair_activity_registrations`
  ADD CONSTRAINT `repair_activity_regs_served_by_fkey`
  FOREIGN KEY (`served_by_member_profile_id`) REFERENCES `member_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `repair_activity_registrations`
  ADD CONSTRAINT `repair_activity_regs_repair_record_fkey`
  FOREIGN KEY (`repair_record_id`) REFERENCES `repair_records`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `repair_activity_attendances`
  ADD CONSTRAINT `repair_activity_attendance_activity_id_fkey`
  FOREIGN KEY (`activity_id`) REFERENCES `repair_activities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `repair_activity_attendances`
  ADD CONSTRAINT `repair_activity_attendance_member_fkey`
  FOREIGN KEY (`member_profile_id`) REFERENCES `member_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 活动接待落单「其他故障」分类；勿复用笼统 OTHER「其他」。
INSERT INTO `repair_categories` (`id`, `code`, `name`, `description`, `sort_order`, `is_active`, `created_by`, `created_at`, `updated_at`, `deleted_at`)
SELECT
  '10000000-0000-4000-8000-000000000010',
  'OTHER_FAULT',
  '其他故障',
  NULL,
  10,
  true,
  NULL,
  UTC_TIMESTAMP(3),
  UTC_TIMESTAMP(3),
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM `repair_categories` WHERE `code` = 'OTHER_FAULT'
);
