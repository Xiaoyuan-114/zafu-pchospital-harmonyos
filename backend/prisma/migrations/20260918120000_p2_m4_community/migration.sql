-- M4 内部交流与通知
-- 前向 Migration：新增 RepairComment / CommentMention / RepairFavorite / Notification。
-- 不修改 M0–M3 已执行 Migration，不使用 prisma db push 或手工生产 DDL。
-- 业务外键一律指向 member_profiles / repair_records，不存 QQ、手机号或冗余 userId。

-- 1) 维修记录评论（两层：根评论 parent_comment_id 为空，回复挂到根评论）
CREATE TABLE `repair_comments` (
  `id` CHAR(36) NOT NULL,
  `repair_record_id` CHAR(36) NOT NULL,
  `author_member_profile_id` CHAR(36) NOT NULL,
  `parent_comment_id` CHAR(36) NULL,
  `body` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,
  INDEX `repair_comments_record_created_idx`(`repair_record_id`, `created_at`),
  INDEX `repair_comments_author_created_idx`(`author_member_profile_id`, `created_at`),
  INDEX `repair_comments_parent_created_idx`(`parent_comment_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

-- 2) 评论提及（同一评论对同一成员只记一次）
CREATE TABLE `comment_mentions` (
  `id` CHAR(36) NOT NULL,
  `comment_id` CHAR(36) NOT NULL,
  `mentioned_member_profile_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `comment_mentions_comment_member_uq`(`comment_id`, `mentioned_member_profile_id`),
  INDEX `comment_mentions_member_idx`(`mentioned_member_profile_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

-- 3) 维修记录收藏（取消走软删除，再次收藏恢复同一行）
CREATE TABLE `repair_favorites` (
  `id` CHAR(36) NOT NULL,
  `member_profile_id` CHAR(36) NOT NULL,
  `repair_record_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,
  UNIQUE INDEX `repair_favorites_member_record_uq`(`member_profile_id`, `repair_record_id`),
  INDEX `repair_favorites_member_deleted_created_idx`(`member_profile_id`, `deleted_at`, `created_at`),
  INDEX `repair_favorites_record_deleted_idx`(`repair_record_id`, `deleted_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

-- 4) 成员通知（删除走软删除，未读/已读状态保留）
CREATE TABLE `notifications` (
  `id` CHAR(36) NOT NULL,
  `recipient_member_profile_id` CHAR(36) NOT NULL,
  `type` VARCHAR(32) NOT NULL,
  `status` VARCHAR(16) NOT NULL,
  `repair_record_id` CHAR(36) NULL,
  `comment_id` CHAR(36) NULL,
  `actor_member_profile_id` CHAR(36) NULL,
  `read_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,
  INDEX `notifications_recipient_status_created_idx`(`recipient_member_profile_id`, `status`, `created_at`),
  INDEX `notifications_recipient_deleted_created_idx`(`recipient_member_profile_id`, `deleted_at`, `created_at`),
  INDEX `notifications_record_idx`(`repair_record_id`),
  INDEX `notifications_comment_idx`(`comment_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

ALTER TABLE `repair_comments` ADD CONSTRAINT `repair_comments_repair_record_id_fkey` FOREIGN KEY (`repair_record_id`) REFERENCES `repair_records`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `repair_comments` ADD CONSTRAINT `repair_comments_author_member_profile_id_fkey` FOREIGN KEY (`author_member_profile_id`) REFERENCES `member_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `repair_comments` ADD CONSTRAINT `repair_comments_parent_comment_id_fkey` FOREIGN KEY (`parent_comment_id`) REFERENCES `repair_comments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `comment_mentions` ADD CONSTRAINT `comment_mentions_comment_id_fkey` FOREIGN KEY (`comment_id`) REFERENCES `repair_comments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `comment_mentions` ADD CONSTRAINT `comment_mentions_mentioned_member_profile_id_fkey` FOREIGN KEY (`mentioned_member_profile_id`) REFERENCES `member_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `repair_favorites` ADD CONSTRAINT `repair_favorites_member_profile_id_fkey` FOREIGN KEY (`member_profile_id`) REFERENCES `member_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `repair_favorites` ADD CONSTRAINT `repair_favorites_repair_record_id_fkey` FOREIGN KEY (`repair_record_id`) REFERENCES `repair_records`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `notifications` ADD CONSTRAINT `notifications_recipient_member_profile_id_fkey` FOREIGN KEY (`recipient_member_profile_id`) REFERENCES `member_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_actor_member_profile_id_fkey` FOREIGN KEY (`actor_member_profile_id`) REFERENCES `member_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_repair_record_id_fkey` FOREIGN KEY (`repair_record_id`) REFERENCES `repair_records`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_comment_id_fkey` FOREIGN KEY (`comment_id`) REFERENCES `repair_comments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
