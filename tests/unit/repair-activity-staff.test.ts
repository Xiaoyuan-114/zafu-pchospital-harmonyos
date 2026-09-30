import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVITY_SERVE_DURATION_MINUTES,
  ACTIVITY_SERVE_REMARK,
  buildActivityServeContent,
  canCheckInRegistration,
  canServeRegistration,
  canWithdrawRegistration,
  mapIssueTypeToCategoryCode,
  shanghaiCalendarDay,
  sortQueueByCheckedInAt,
} from "../../src/features/repair-activities/repair-activity-validation";

test("签到矩阵：仅 REGISTERED 可签到", () => {
  assert.equal(canCheckInRegistration("REGISTERED"), true);
  assert.equal(canCheckInRegistration("CHECKED_IN"), false);
  assert.equal(canCheckInRegistration("SERVED"), false);
  assert.equal(canCheckInRegistration("UNKNOWN"), false);
});

test("撤回矩阵：仅 CHECKED_IN 可撤回；SERVED 不可", () => {
  assert.equal(canWithdrawRegistration("CHECKED_IN"), true);
  assert.equal(canWithdrawRegistration("REGISTERED"), false);
  assert.equal(canWithdrawRegistration("SERVED"), false);
});

test("接待矩阵：仅 CHECKED_IN 可接待", () => {
  assert.equal(canServeRegistration("CHECKED_IN"), true);
  assert.equal(canServeRegistration("REGISTERED"), false);
  assert.equal(canServeRegistration("SERVED"), false);
});

test("故障类型 → 分类 code 映射", () => {
  assert.equal(mapIssueTypeToCategoryCode("CLEAN_PASTE"), "COOLING_CLEANING");
  assert.equal(mapIssueTypeToCategoryCode("CLEAN_ONLY"), "COOLING_CLEANING");
  assert.equal(mapIssueTypeToCategoryCode("SOFTWARE_SYSTEM"), "SYSTEM");
  assert.equal(mapIssueTypeToCategoryCode("OTHER"), "OTHER_FAULT");
});

test("排队序按 checkedInAt ASC；null 排最后", () => {
  const rows = [
    { id: "c", checkedInAt: new Date("2026-09-25T10:00:00.000Z") },
    { id: "a", checkedInAt: new Date("2026-09-25T08:00:00.000Z") },
    { id: "b", checkedInAt: new Date("2026-09-25T09:00:00.000Z") },
    { id: "n", checkedInAt: null },
  ];
  assert.deepEqual(
    sortQueueByCheckedInAt(rows).map((r) => r.id),
    ["a", "b", "c", "n"],
  );
  // 不改原数组
  assert.equal(rows[0].id, "c");
});

test("出勤闸门语义：未出勤操作码为 ACTIVITY_ATTENDANCE_REQUIRED（403）", async () => {
  const { ApiErrorCode, defaultStatusFor } = await importErrorStatus();
  assert.ok((ApiErrorCode as readonly string[]).includes("ACTIVITY_ATTENDANCE_REQUIRED"));
  assert.equal(defaultStatusFor("ACTIVITY_ATTENDANCE_REQUIRED"), 403);
  assert.equal(defaultStatusFor("ACTIVITY_REGISTRATION_STATE_INVALID"), 409);
});

test("落单内容模板含活动标题、姓名、脱敏电话、故障类型", () => {
  const content = buildActivityServeContent({
    activityTitle: "秋季义诊",
    customerName: "张三",
    phoneMasked: "138****5678",
    issueTypeLabel: "清灰换硅脂",
  });
  assert.match(content, /秋季义诊/);
  assert.match(content, /张三/);
  assert.match(content, /138\*\*\*\*5678/);
  assert.match(content, /清灰换硅脂/);
  assert.equal(ACTIVITY_SERVE_DURATION_MINUTES, 1);
  assert.equal(ACTIVITY_SERVE_REMARK, "活动接待自动落单");
});

test("activityAt 转上海日历日", () => {
  // 2026-09-25 16:00 UTC = 2026-09-26 00:00 CST
  assert.equal(shanghaiCalendarDay(new Date("2026-09-25T16:00:00.000Z")), "2026-09-26");
  // 同日白天
  assert.equal(shanghaiCalendarDay(new Date("2026-09-25T06:00:00.000Z")), "2026-09-25");
});

/** 从 errors 模块读出状态映射（避免导出私有 defaultStatus）。 */
async function importErrorStatus() {
  const mod = await import("../../src/lib/api/errors");
  const { AppError, ApiErrorCode } = mod;
  function defaultStatusFor(code: (typeof ApiErrorCode)[number]): number {
    return new AppError(code, "x").status;
  }
  return { ApiErrorCode, defaultStatusFor };
}
