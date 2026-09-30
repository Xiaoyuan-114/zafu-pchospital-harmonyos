-- 维修活动报名：记录报名时同意的免责声明版本与时间（issue #62 前端3）。
-- 两列都可空：本迁移之前的历史报名没有签署动作，不能凭默认值伪造出一条同意记录。

ALTER TABLE `repair_activity_registrations`
  ADD COLUMN `consent_version` VARCHAR(16) NULL,
  ADD COLUMN `consent_accepted_at` DATETIME(3) NULL;
