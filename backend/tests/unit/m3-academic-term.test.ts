import assert from "node:assert/strict";
import test from "node:test";

import {
  parseAcademicTermConfig,
  shanghaiMonthRange,
  shanghaiDateToUtc,
} from "../../src/lib/academic-term";
import { ApiErrorCode } from "../../src/lib/api/errors";
import { Permission } from "../../src/types/contracts";
import {
  MEMBER_NICKNAME_MAX_LENGTH,
  MEMBER_RECENT_REPAIR_LIMIT,
  MEMBER_SKILL_LIMIT,
} from "../../src/types/contracts";

// ---------------------------------------------------------------------------
// M3-A 学期配置解析（任务书 §6.2 / §15.1 五种情形）
// ---------------------------------------------------------------------------

test("M3 学期配置：两项皆空视为未配置且合法", () => {
  const result = parseAcademicTermConfig("", "");
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.config.configured, false);
});

test("M3 学期配置：仅配置开始日期视为非法", () => {
  const result = parseAcademicTermConfig("2026-09-01", "");
  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.message : "", /ACADEMIC_TERM_END/);
});

test("M3 学期配置：仅配置结束日期视为非法", () => {
  const result = parseAcademicTermConfig("", "2027-01-15");
  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.message : "", /ACADEMIC_TERM_START/);
});

test("M3 学期配置：非法格式与不存在的日期被拒绝", () => {
  for (const [start, end] of [
    ["2026/09/01", "2027-01-15"],
    ["2026-9-1", "2027-01-15"],
    ["2026-13-01", "2027-01-15"],
    ["2026-02-30", "2027-01-15"],
    ["2026-09-01", "2027-00-01"],
  ]) {
    const result = parseAcademicTermConfig(start, end);
    assert.equal(result.ok, false, `应拒绝 ${start} → ${end}`);
  }
});

test("M3 学期配置：开始晚于结束视为倒置区间", () => {
  const result = parseAcademicTermConfig("2027-01-15", "2026-09-01");
  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.message : "", /不得晚于/);
});

test("M3 学期配置：开始与结束同一天合法（单日学期）", () => {
  const result = parseAcademicTermConfig("2026-09-01", "2026-09-01");
  assert.equal(result.ok, true);
  if (result.ok && result.config.configured) {
    const span = result.config.range.endExclusive.getTime() - result.config.range.startInclusive.getTime();
    assert.equal(span, 24 * 60 * 60 * 1000);
  }
});

test("M3 学期配置：边界转换为 UTC 且结束日包含全天", () => {
  const result = parseAcademicTermConfig("2026-09-01", "2027-01-15");
  assert.equal(result.ok, true);
  if (!result.ok || !result.config.configured) throw new Error("预期已配置");
  // 上海 2026-09-01 00:00 = UTC 2026-08-31 16:00
  assert.equal(result.config.range.startInclusive.toISOString(), "2026-08-31T16:00:00.000Z");
  // 结束日 2027-01-15 含全天 → 排他上界 = 2027-01-16 00:00 上海 = UTC 2027-01-15 16:00
  assert.equal(result.config.range.endExclusive.toISOString(), "2027-01-15T16:00:00.000Z");
});

// ---------------------------------------------------------------------------
// Asia/Shanghai 月边界
// ---------------------------------------------------------------------------

test("M3 月份边界：上海月初按 UTC+8 平移", () => {
  // UTC 2026-08-31T16:00:00Z 恰好是上海 2026-09-01T00:00 → 属于 9 月
  const range = shanghaiMonthRange(new Date("2026-08-31T16:00:00.000Z"));
  assert.equal(range.year, 2026);
  assert.equal(range.month, 9);
  assert.equal(range.startInclusive.toISOString(), "2026-08-31T16:00:00.000Z");
  assert.equal(range.endExclusive.toISOString(), "2026-09-30T16:00:00.000Z");
});

test("M3 月份边界：上海月末最后一刻仍属当月（UTC 跨日）", () => {
  // UTtC 2026-09-30T15:59:59.999Z = 上海 2026-09-30T23:59:59.999 → 仍是 9 月
  const range = shanghaiMonthRange(new Date("2026-09-30T15:59:59.999Z"));
  assert.equal(range.month, 9);
  // 再往后 1ms 进入 10 月
  const next = shanghaiMonthRange(new Date("2026-09-30T16:00:00.000Z"));
  assert.equal(next.month, 10);
});

test("M3 月份边界：12 月正确进位到次年 1 月", () => {
  const range = shanghaiMonthRange(new Date("2026-12-15T00:00:00.000Z"));
  assert.equal(range.year, 2026);
  assert.equal(range.month, 12);
  assert.equal(range.endExclusive.toISOString(), "2026-12-31T16:00:00.000Z");
});

test("M3 日期工具：非法日期返回 null", () => {
  assert.equal(shanghaiDateToUtc("2026-02-30"), null);
  assert.equal(shanghaiDateToUtc("not-a-date"), null);
  assert.equal(shanghaiDateToUtc("2026-09-01")?.toISOString(), "2026-08-31T16:00:00.000Z");
});

// ---------------------------------------------------------------------------
// M3 公共契约
// ---------------------------------------------------------------------------

test("M3 稳定错误码已进入公共错误码集合", () => {
  for (const code of [
    "MEMBER_PROFILE_NOT_FOUND",
    "MEMBER_PROFILE_FORBIDDEN",
    "MEMBER_PROFILE_VERSION_CONFLICT",
    "MEMBER_PROFILE_INVALID_NICKNAME",
    "SKILL_NOT_FOUND",
    "SKILL_INACTIVE",
    "SKILL_LIMIT_EXCEEDED",
    "SKILL_SELECTION_INVALID",
    "ACADEMIC_TERM_CONFIG_INVALID",
  ]) {
    assert.equal(ApiErrorCode.includes(code as (typeof ApiErrorCode)[number]), true, code);
  }
});

test("M3 权限已进入公共 Permission 集合", () => {
  for (const permission of [
    "member.profile.read_self",
    "member.profile.update_self",
    "member.profile.read_internal",
    "member.skill.assign_self",
  ]) {
    assert.equal(Permission.includes(permission as (typeof Permission)[number]), true, permission);
  }
});

test("M3 数量边界常量固定为契约值", () => {
  assert.equal(MEMBER_SKILL_LIMIT, 12);
  assert.equal(MEMBER_NICKNAME_MAX_LENGTH, 64);
  assert.equal(MEMBER_RECENT_REPAIR_LIMIT, 5);
});
