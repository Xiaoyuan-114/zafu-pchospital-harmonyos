import assert from "node:assert/strict";
import test from "node:test";

import {
  repairActivityIpRateLimitKey,
  repairActivityPhoneRateLimitKey,
} from "../../src/features/repair-activities/repair-activity-rate-limit";

test("公开维修活动接口共用 IP 限流键", () => {
  assert.equal(repairActivityIpRateLimitKey("203.0.113.7"), "activity-signup:203.0.113.7");
  assert.equal(
    repairActivityIpRateLimitKey("203.0.113.7"),
    repairActivityIpRateLimitKey("203.0.113.7"),
  );
});

test("报名、查号与改类型共用规范化手机号限流键，且不与 IP 键串桶", () => {
  assert.equal(repairActivityPhoneRateLimitKey("13800138000"), "activity-signup-phone:13800138000");
  assert.notEqual(
    repairActivityPhoneRateLimitKey("13800138000"),
    repairActivityIpRateLimitKey("13800138000"),
  );
});
