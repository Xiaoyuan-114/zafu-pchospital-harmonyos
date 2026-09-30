-- M3 成员工作台与个人主页
-- 前向 Migration：新增 Skill / UserSkill，并为 MemberProfile 增加乐观锁 version。
-- 不修改 M0/M1/M2 已执行 Migration，不使用 prisma db push 或手工生产 DDL。

-- 1) MemberProfile 乐观锁版本号
ALTER TABLE `member_profiles` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;

-- 2) 技能标签
CREATE TABLE `skills` (
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
  UNIQUE INDEX `skills_code_uq`(`code`),
  INDEX `skills_active_deleted_sort_name_idx`(`is_active`, `deleted_at`, `sort_order`, `name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

-- 3) 成员技能关联（外键指向 MemberProfile，不存 QQ / 手机号 / 姓名 / 冗余 userId）
CREATE TABLE `user_skills` (
  `id` CHAR(36) NOT NULL,
  `member_profile_id` CHAR(36) NOT NULL,
  `skill_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,
  UNIQUE INDEX `user_skills_member_skill_uq`(`member_profile_id`, `skill_id`),
  INDEX `user_skills_member_deleted_idx`(`member_profile_id`, `deleted_at`),
  INDEX `user_skills_skill_deleted_idx`(`skill_id`, `deleted_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

ALTER TABLE `skills` ADD CONSTRAINT `skills_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `user_skills` ADD CONSTRAINT `user_skills_member_profile_id_fkey` FOREIGN KEY (`member_profile_id`) REFERENCES `member_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `user_skills` ADD CONSTRAINT `user_skills_skill_id_fkey` FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
