-- 活动报名选填机型（issue #68）：报名时记下设备型号，接待落单时带进维修记录。
-- 两列都可空：历史报名与手工建单的记录没有这个信息，不能凭默认值编一个出来。

ALTER TABLE `repair_activity_registrations`
  ADD COLUMN `device_model` VARCHAR(60) NULL;

ALTER TABLE `repair_records`
  ADD COLUMN `device_model` VARCHAR(60) NULL;
