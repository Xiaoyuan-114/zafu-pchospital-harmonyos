import assert from "node:assert/strict";
import test from "node:test";

import {
  assertActivityTimeRules,
  assertValidIssueType,
  canAcceptNewRegistration,
  canEditIssueType,
  deriveRepairActivityStatus,
  remainingCapacity,
  RepairActivityIssueType,
  repairActivityIssueTypeLabels,
} from "../../src/features/repair-activities/repair-activity-validation";
import { repairActivitiesPage } from "../../src/config/repair-activities";
import { AppError } from "../../src/lib/api/errors";

const base = {
  activityAt: new Date("2026-10-01T06:00:00.000Z"), // 上海 14:00
  signupOpensAt: new Date("2026-09-20T00:00:00.000Z"),
  signupClosesAt: new Date("2026-10-01T05:00:00.000Z"), // 活动前 1h
  capacity: 10,
};

test("派生状态：未开始 / 报名中 / 已报满 / 报名截止 / 已结束", () => {
  assert.equal(
    deriveRepairActivityStatus({
      ...base,
      now: new Date("2026-09-19T23:59:59.999Z"),
      effectiveRegistrationCount: 0,
    }),
    "UPCOMING",
  );
  assert.equal(
    deriveRepairActivityStatus({
      ...base,
      now: new Date("2026-09-20T00:00:00.000Z"),
      effectiveRegistrationCount: 0,
    }),
    "OPEN",
  );
  assert.equal(
    deriveRepairActivityStatus({
      ...base,
      now: new Date("2026-09-25T12:00:00.000Z"),
      effectiveRegistrationCount: 10,
    }),
    "FULL",
  );
  assert.equal(
    deriveRepairActivityStatus({
      ...base,
      now: new Date("2026-10-01T05:00:00.000Z"),
      effectiveRegistrationCount: 3,
    }),
    "CLOSED",
  );
  assert.equal(
    deriveRepairActivityStatus({
      ...base,
      now: new Date("2026-10-01T06:00:00.000Z"),
      effectiveRegistrationCount: 3,
    }),
    "ENDED",
  );
});

test("优先级：已结束压过报名截止与报满", () => {
  assert.equal(
    deriveRepairActivityStatus({
      ...base,
      now: new Date("2026-10-01T07:00:00.000Z"),
      effectiveRegistrationCount: 10,
    }),
    "ENDED",
  );
});

test("软删释放名额后 FULL 回到 OPEN", () => {
  const duringWindow = new Date("2026-09-25T12:00:00.000Z");
  assert.equal(
    deriveRepairActivityStatus({
      ...base,
      now: duringWindow,
      effectiveRegistrationCount: 10,
    }),
    "FULL",
  );
  assert.equal(
    deriveRepairActivityStatus({
      ...base,
      now: duringWindow,
      effectiveRegistrationCount: 9,
    }),
    "OPEN",
  );
});

test("边界：opensAt 瞬间为 OPEN；closesAt 瞬间为 CLOSED；activityAt 瞬间为 ENDED", () => {
  assert.equal(
    deriveRepairActivityStatus({
      ...base,
      now: base.signupOpensAt,
      effectiveRegistrationCount: 0,
    }),
    "OPEN",
  );
  assert.equal(
    deriveRepairActivityStatus({
      ...base,
      now: base.signupClosesAt,
      effectiveRegistrationCount: 0,
    }),
    "CLOSED",
  );
  assert.equal(
    deriveRepairActivityStatus({
      ...base,
      now: base.activityAt,
      effectiveRegistrationCount: 0,
    }),
    "ENDED",
  );
});

test("仅 OPEN 可新报", () => {
  assert.equal(canAcceptNewRegistration("OPEN"), true);
  for (const status of ["UPCOMING", "FULL", "CLOSED", "ENDED"] as const) {
    assert.equal(canAcceptNewRegistration(status), false, status);
  }
});

test("改类型：REGISTERED 且未 ENDED 才允许（截止后活动前仍可）", () => {
  assert.equal(
    canEditIssueType({ registrationStatus: "REGISTERED", activityStatus: "OPEN" }),
    true,
  );
  assert.equal(
    canEditIssueType({ registrationStatus: "REGISTERED", activityStatus: "CLOSED" }),
    true,
  );
  assert.equal(
    canEditIssueType({ registrationStatus: "REGISTERED", activityStatus: "UPCOMING" }),
    true,
  );
  assert.equal(
    canEditIssueType({ registrationStatus: "REGISTERED", activityStatus: "FULL" }),
    true,
  );
  assert.equal(
    canEditIssueType({ registrationStatus: "REGISTERED", activityStatus: "ENDED" }),
    false,
  );
  assert.equal(
    canEditIssueType({ registrationStatus: "CHECKED_IN", activityStatus: "OPEN" }),
    false,
  );
  assert.equal(canEditIssueType({ registrationStatus: "SERVED", activityStatus: "CLOSED" }), false);
});

test("时间校验：opens < closes <= activityAt", () => {
  assert.doesNotThrow(() =>
    assertActivityTimeRules({
      signupOpensAt: new Date("2026-09-01T00:00:00Z"),
      signupClosesAt: new Date("2026-09-10T00:00:00Z"),
      activityAt: new Date("2026-09-10T00:00:00Z"),
    }),
  );
  assert.throws(
    () =>
      assertActivityTimeRules({
        signupOpensAt: new Date("2026-09-10T00:00:00Z"),
        signupClosesAt: new Date("2026-09-10T00:00:00Z"),
        activityAt: new Date("2026-09-11T00:00:00Z"),
      }),
    (error) => error instanceof AppError && error.code === "VALIDATION_FAILED",
  );
  assert.throws(
    () =>
      assertActivityTimeRules({
        signupOpensAt: new Date("2026-09-01T00:00:00Z"),
        signupClosesAt: new Date("2026-09-12T00:00:00Z"),
        activityAt: new Date("2026-09-11T00:00:00Z"),
      }),
    (error) => error instanceof AppError && error.code === "VALIDATION_FAILED",
  );
});

test("剩余名额不为负", () => {
  assert.equal(remainingCapacity(10, 3), 7);
  assert.equal(remainingCapacity(10, 10), 0);
  assert.equal(remainingCapacity(10, 12), 0);
});

test("软删除有效报名后，活动窗口内 FULL 恢复为 OPEN；成员撤回仍不释放名额", () => {
  const now = new Date("2026-09-25T00:00:00.000Z");
  assert.equal(
    deriveRepairActivityStatus({ ...base, capacity: 2, now, effectiveRegistrationCount: 2 }),
    "FULL",
  );
  // 管理软删除使有效报名数从 2 降为 1；成员撤回不在有效状态集合中，也同样不增加有效数。
  assert.equal(
    deriveRepairActivityStatus({ ...base, capacity: 2, now, effectiveRegistrationCount: 1 }),
    "OPEN",
  );
});

test("管理报名 PATCH 使用同一 issueType 白名单", () => {
  assert.doesNotThrow(() => assertValidIssueType("CLEAN_ONLY"));
  assert.doesNotThrow(() => assertValidIssueType("SOFTWARE_SYSTEM"));
  assert.throws(
    () => assertValidIssueType("INVALID"),
    (error) => error instanceof AppError && error.code === "VALIDATION_FAILED",
  );
});

test("报名页给出的每个故障类型都被服务端接受，且两处文案一致", () => {
  const options = repairActivitiesPage.issueTypes;
  // 前端选项与服务端白名单/标签是两份数据，很容易只改一处 —— issue #62 要求新增
  // 「软件 / 系统问题」时，两边必须同步。
  for (const option of options) {
    assert.equal(assertValidIssueType(option.value), option.value);
    assert.equal(
      repairActivityIssueTypeLabels[option.value as RepairActivityIssueType],
      option.label,
      `故障类型 ${option.value} 的文案在 config 与 validation 里不一致`,
    );
  }
  assert.deepEqual(
    options.map((option) => option.value).sort(),
    [...RepairActivityIssueType].sort(),
    "报名页的故障类型选项与服务端枚举必须逐一对应",
  );
});
