import assert from "node:assert/strict";
import test from "node:test";

import { AppError } from "../../src/lib/api/errors";
import { customerPermissions, permissionsForRoles } from "../../src/lib/auth/permissions";
import type { AuthorizedActor, Permission } from "../../src/types/contracts";
import {
  assertCanManageDevice,
  assertCanReadDevice,
  assertCanRegisterBenefit,
  assertCanVoidBenefit,
} from "../../src/features/devices/device-policy";
import {
  calendarDateString,
  normalizeBenefitInput,
  normalizeDeviceInput,
  parseCalendarDate,
  validateBenefitInput,
  validateDeviceInput,
} from "../../src/features/devices/device-validation";
import { toBenefitView } from "../../src/features/devices/device-view";

/**
 * Issue #102 设备与权益的规则测试。
 *
 * 这里只测纯函数（权限、日期、校验、状态计算）：
 * 它们决定了客户看到什么，且不需要数据库就能复现，
 * 比在接口层断言更适合守住「到期由日期算、不自证权益」这两条硬规则。
 */

function actor(permissions: readonly Permission[], userId = "user-1"): AuthorizedActor {
  return {
    requestId: "test",
    actorType: "USER",
    userId,
    userStatus: "ACTIVE",
    permissions,
  };
}

function fieldErrors(error: unknown): Record<string, string[]> | undefined {
  return error instanceof AppError
    ? (error.fieldErrors as Record<string, string[]> | undefined)
    : undefined;
}

test("客户拿到设备与权益的自助权限，但拿不到登记与作废", () => {
  const customer = permissionsForRoles([]);
  assert.equal(customer.includes("device:read_self"), true);
  assert.equal(customer.includes("device:manage_self"), true);
  assert.equal(customer.includes("benefit:read_self"), true);
  // 客户不能自己登记保修（否则等于自证权益），也不能查别人的设备。
  assert.equal(customer.includes("benefit:write"), false);
  assert.equal(customer.includes("benefit:void"), false);
  assert.equal(customer.includes("device:read"), false);
  assert.deepEqual([...customer].sort(), [...customerPermissions].sort());
});

test("工作人员可查设备、可登记权益，但不能作废", () => {
  const member = permissionsForRoles(["MEMBER"]);
  assert.equal(member.includes("device:read"), true);
  assert.equal(member.includes("benefit:write"), true);
  assert.equal(member.includes("benefit:void"), false);
  // 工作人员不能替客户改设备（归属仍是客户）。
  assert.equal(member.includes("device:manage_self"), false);
});

test("管理员可作废权益", () => {
  const admin = permissionsForRoles(["ADMIN"]);
  assert.equal(admin.includes("device:read"), true);
  assert.equal(admin.includes("benefit:write"), true);
  assert.equal(admin.includes("benefit:void"), true);
});

test("日历日解析：非法日期与非法格式都返回 null", () => {
  assert.equal(parseCalendarDate("2026-11-27")?.toISOString(), "2026-11-27T00:00:00.000Z");
  assert.equal(parseCalendarDate("2026-02-30"), null);
  assert.equal(parseCalendarDate("2026-13-01"), null);
  assert.equal(parseCalendarDate("2026/11/27"), null);
  assert.equal(parseCalendarDate("26-11-27"), null);
  assert.equal(calendarDateString(null), null);
  assert.equal(calendarDateString(new Date("2026-11-27T00:00:00.000Z")), "2026-11-27");
});

test("设备校验：必填缺失一次性报全，购买日期不能晚于今天", () => {
  try {
    validateDeviceInput({ label: "", brand: "", model: "" });
    assert.fail("应当抛出校验错误");
  } catch (error) {
    const errors = fieldErrors(error);
    assert.ok(errors);
    assert.deepEqual(Object.keys(errors).sort(), ["brand", "label", "model"]);
  }

  try {
    validateDeviceInput({ label: "办公机", brand: "联想", model: "T14", purchaseOn: "2999-01-01" });
    assert.fail("未来日期应当被拒绝");
  } catch (error) {
    assert.deepEqual(fieldErrors(error), { purchaseOn: ["购买日期不能晚于今天"] });
  }

  // 合法输入不抛错
  validateDeviceInput({ label: "办公机", brand: "联想", model: "T14", purchaseOn: "2024-09-01" });
});

test("设备归一化：空白折叠，序列号与日期空串视为未填", () => {
  const normalized = normalizeDeviceInput({
    label: "  上课用的   T14 ",
    brand: " 联想 ",
    model: " ThinkPad T14 ",
    serialNumber: "   ",
    purchaseOn: "",
  });
  assert.equal(normalized.label, "上课用的 T14");
  assert.equal(normalized.serialNumber, undefined);
  assert.equal(normalized.purchaseOn, undefined);
});

test("权益校验：类型白名单、截止不得早于生效、次数上限", () => {
  try {
    validateBenefitInput({
      kind: "FREE",
      name: "整机保修",
      provider: "联想",
      startOn: "2026-01-01",
      endOn: "2025-12-31",
      totalUses: 1000,
    });
    assert.fail("应当抛出校验错误");
  } catch (error) {
    const errors = fieldErrors(error);
    assert.ok(errors);
    assert.deepEqual(errors.kind, ["权益类型不在可选范围内"]);
    assert.deepEqual(errors.endOn, ["截止日期不能早于生效日期"]);
    assert.deepEqual(errors.totalUses, ["可用次数应为 0–999 的整数"]);
  }

  // 长期有效（不填截止）与不限次（不填次数）都是合法输入
  validateBenefitInput({ kind: "WARRANTY", name: "整机保修", provider: "联想", startOn: "2026-01-01" });
});

test("权益归一化：类型转大写、地区缺省为大陆、次数取整", () => {
  const normalized = normalizeBenefitInput({
    kind: " warranty ",
    name: "整机保修",
    provider: "联想",
    startOn: "2026-01-01",
    totalUses: 3.7,
  });
  assert.equal(normalized.kind, "WARRANTY");
  assert.equal(normalized.region, "中国大陆");
  assert.equal(normalized.totalUses, 3);
});

const benefitRow = {
  id: "benefit-1",
  deviceId: "device-1",
  kind: "WARRANTY",
  name: "整机保修",
  provider: "联想",
  startOn: new Date("2026-01-01T00:00:00.000Z"),
  endOn: new Date("2026-12-31T00:00:00.000Z"),
  region: "中国大陆",
  totalUses: 2,
  usedUses: 1,
  state: "ACTIVE",
  note: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

test("权益状态由日期现算：未到期有效、过了截止即过期", () => {
  const before = toBenefitView(benefitRow, "2026-06-01");
  assert.equal(before.status, "EFFECTIVE");
  assert.equal(before.daysRemaining, 213);
  assert.equal(before.remainingUses, 1);

  const after = toBenefitView(benefitRow, "2027-01-01");
  assert.equal(after.status, "EXPIRED");
  assert.equal(after.daysRemaining, -1);
});

test("权益作废优先于到期：VOID 不会被算成过期或有效", () => {
  const voided = toBenefitView({ ...benefitRow, state: "VOID" }, "2026-06-01");
  assert.equal(voided.status, "VOID");
});

test("长期有效与不限次：endOn/totalUses 为 null 时天数和剩余次数为 null", () => {
  const longTerm = toBenefitView(
    { ...benefitRow, endOn: null, totalUses: null, usedUses: 0 },
    "2030-01-01",
  );
  assert.equal(longTerm.status, "EFFECTIVE");
  assert.equal(longTerm.daysRemaining, null);
  assert.equal(longTerm.remainingUses, null);
});

const device = { ownerUserId: "user-1", deletedAt: null };

test("读设备：本人可读，工作人员可读他人，陌生人 404", () => {
  assertCanReadDevice(actor(["device:read_self"]), device);
  assertCanReadDevice(actor(["device:read"], "staff-1"), device);

  try {
    assertCanReadDevice(actor(["device:read_self"], "user-2"), device);
    assert.fail("应当拒绝");
  } catch (error) {
    assert.equal((error as AppError).code, "DEVICE_NOT_FOUND");
  }
});

test("解绑：工作人员不能替客户解绑（404 而非 403）", () => {
  try {
    assertCanManageDevice(actor(["device:read"], "staff-1"), device);
    assert.fail("应当拒绝");
  } catch (error) {
    assert.equal((error as AppError).code, "DEVICE_NOT_FOUND");
  }

  assertCanManageDevice(actor(["device:manage_self"]), device);
});

test("已解绑的设备对任何人都表现为不存在", () => {
  const retired = { ownerUserId: "user-1", deletedAt: new Date("2026-11-01T00:00:00.000Z") };
  try {
    assertCanReadDevice(actor(["device:read_self"]), retired);
    assert.fail("应当拒绝");
  } catch (error) {
    assert.equal((error as AppError).code, "DEVICE_NOT_FOUND");
  }
});

test("登记与作废权益的权限隔离", () => {
  assert.throws(() => assertCanRegisterBenefit(actor(["benefit:read_self"])), /没有执行该操作的权限/);
  assertCanRegisterBenefit(actor(["benefit:write"], "staff-1"));
  assert.throws(() => assertCanVoidBenefit(actor(["benefit:write"], "staff-1")), /没有执行该操作的权限/);
  assertCanVoidBenefit(actor(["benefit:void"], "admin-1"));
});
