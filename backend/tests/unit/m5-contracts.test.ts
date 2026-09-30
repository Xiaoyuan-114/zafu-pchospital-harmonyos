import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ApiErrorCode, AppError } from "../../src/lib/api/errors";
import { permissionsForRoles, rolePermissions } from "../../src/lib/auth/permissions";
import {
  ANALYTICS_TREND_MONTHS,
  AnalyticsScope,
  AnalyticsStatus,
  RANKING_PAGE_SIZE_DEFAULT,
  RANKING_PAGE_SIZE_MAX,
  RANKING_PREVIEW_LIMIT,
  RankingMetric,
  UNCATEGORIZED_LABEL,
} from "../../src/types/contracts";

test("M5 枚举已进入公共契约且无重复值", () => {
  for (const values of [AnalyticsScope, RankingMetric, AnalyticsStatus]) {
    assert.equal(new Set(values).size, values.length);
  }
  assert.deepEqual([...AnalyticsScope], ["MONTH", "TERM", "ALL_TIME"]);
  assert.deepEqual([...RankingMetric], ["REPAIR_COUNT", "DURATION_MINUTES"]);
  assert.deepEqual([...AnalyticsStatus], ["AVAILABLE", "UNCONFIGURED"]);
});

test("M5 稳定错误码已入册并映射为 400", () => {
  for (const code of ["ANALYTICS_SCOPE_INVALID", "RANKING_METRIC_INVALID"]) {
    assert.equal(ApiErrorCode.includes(code as (typeof ApiErrorCode)[number]), true);
    assert.equal(new AppError(code as (typeof ApiErrorCode)[number], "x").status, 400);
  }
});

test("M5 权限 analytics:read_internal 授予 MEMBER 与 ADMIN，未授予其他角色", () => {
  assert.equal(rolePermissions.MEMBER.includes("analytics:read_internal"), true);
  assert.equal(rolePermissions.ADMIN.includes("analytics:read_internal"), true);
  // 两个角色之外不应存在第三个拥有该权限的角色
  const holders = Object.entries(rolePermissions)
    .filter(([, perms]) => perms.includes("analytics:read_internal"))
    .map(([role]) => role)
    .sort();
  assert.deepEqual(holders, ["ADMIN", "MEMBER"]);
  // 只读权限：不得顺带带出写权限
  assert.equal(rolePermissions.MEMBER.includes("comment:delete"), false);
});

test("M5 权限并集不产生重复项", () => {
  const merged = permissionsForRoles(["MEMBER", "ADMIN"]);
  assert.equal(new Set(merged).size, merged.length);
  assert.equal(merged.includes("analytics:read_internal"), true);
});

test("M5 数量边界常量固定为契约值", () => {
  assert.equal(RANKING_PAGE_SIZE_DEFAULT, 20);
  assert.equal(RANKING_PAGE_SIZE_MAX, 100);
  assert.equal(RANKING_PREVIEW_LIMIT, 3);
  assert.equal(ANALYTICS_TREND_MONTHS, 12);
  assert.equal(UNCATEGORIZED_LABEL, "未分类");
});

/**
 * 隐私红线：排行榜 DTO 的**字段白名单**。
 *
 * `RankingEntry` 是纯类型，运行时无法枚举字段，因此对契约源码块做文本断言：
 * 一旦有人把 QQ、手机号、学号、班级或 `userId` 加进排行条目，本用例立刻失败，
 * 而不是等到线上泄漏才发现。（端到端的字段检查另见 GreatSQL 集成测试。）
 */
test("M5 排行条目不得包含任何身份字段（契约层白名单）", () => {
  const text = readFileSync("src/types/contracts.ts", "utf8");
  const start = text.indexOf("export type RankingEntry = {");
  assert.notEqual(start, -1, "找不到 RankingEntry 定义");
  const block = text.slice(start, text.indexOf("};", start));

  for (const forbidden of ["qq", "phone", "studentId", "className", "userId", "nickname"]) {
    assert.doesNotMatch(block, new RegExp(forbidden, "i"), `RankingEntry 不得出现 ${forbidden}`);
  }
  for (const required of [
    "rank",
    "memberProfileId",
    "displayName",
    "approvedCount",
    "durationMinutes",
    "metricValue",
    "isCurrentMember",
  ]) {
    assert.match(block, new RegExp(`\\b${required}\\b`), `RankingEntry 必须包含 ${required}`);
  }
});
