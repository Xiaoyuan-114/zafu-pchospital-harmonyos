import assert from "node:assert/strict";
import test from "node:test";

import { recentShanghaiMonths, resetAcademicTermConfigForTests } from "../../src/lib/academic-term";
import { createLatestOnlyGuard } from "../../src/features/analytics/latest-only";
import {
  DISPLAY_NAME_FALLBACK,
  RANKABLE_MEMBER_STATUS,
  isRankableMember,
  resolveDisplayName,
  toSafeDuration,
  toSafeInteger,
} from "../../src/features/analytics/analytics-policy";
import {
  buildMonthlyTrend,
  resolveScopeRange,
  toAnalyticsRange,
  toCategoryDistribution,
} from "../../src/features/analytics/analytics-view";
import { rankingMetricFilter, rankingScopeFilter } from "../../src/features/analytics/analytics-http";
import { approvedRepairSql } from "../../src/features/analytics/analytics-repository";
import { approvedRepairWhere } from "../../src/features/repairs/repair-query-service";
import {
  UNAVAILABLE_RANKING_PREVIEW,
  toRankingPreview,
} from "../../src/features/member-dashboard/community-summary";
import { UNCATEGORIZED_LABEL } from "../../src/types/contracts";
import type { MemberRankingPreview } from "../../src/types/contracts";

/** 每个用例都从「学期未配置」的干净状态开始，避免缓存串味。 */
function withoutTerm(): void {
  delete process.env.ACADEMIC_TERM_START;
  delete process.env.ACADEMIC_TERM_END;
  resetAcademicTermConfigForTests();
}

function withTerm(start: string, end: string): void {
  process.env.ACADEMIC_TERM_START = start;
  process.env.ACADEMIC_TERM_END = end;
  resetAcademicTermConfigForTests();
}

// ---------------------------------------------------------------- 范围解析

test("M5 范围解析：MONTH 取上海自然月，ALL_TIME 不附加日期条件", () => {
  withoutTerm();
  // 2026-08-31T16:00Z 正是上海 09-01 00:00，所以这里算的是 9 月。
  const now = new Date("2026-09-15T00:00:00.000Z");

  const month = resolveScopeRange("MONTH", now);
  assert.equal(month.status, "AVAILABLE");
  assert.equal(month.range?.startInclusive.toISOString(), "2026-08-31T16:00:00.000Z");
  assert.equal(month.range?.endExclusive.toISOString(), "2026-09-30T16:00:00.000Z");

  const all = resolveScopeRange("ALL_TIME", now);
  assert.equal(all.status, "AVAILABLE");
  assert.equal(all.range, null, "ALL_TIME 必须是无日期约束，而不是零长度区间");
});

test("M5 范围解析：学期未配置返回 UNCONFIGURED，绝不退化成空区间", () => {
  withoutTerm();
  const term = resolveScopeRange("TERM", new Date("2026-09-15T00:00:00.000Z"));
  assert.equal(term.status, "UNCONFIGURED");
  assert.equal(term.range, null);
});

test("M5 范围解析：学期配置后取 [start, end] 的 UTC 半开区间", () => {
  withTerm("2026-09-01", "2027-01-15");
  try {
    const term = resolveScopeRange("TERM", new Date("2026-10-01T00:00:00.000Z"));
    assert.equal(term.status, "AVAILABLE");
    assert.equal(term.range?.startInclusive.toISOString(), "2026-08-31T16:00:00.000Z");
    // 结束日包含全天 → 排他上界是次日 00:00（上海）
    assert.equal(term.range?.endExclusive.toISOString(), "2027-01-15T16:00:00.000Z");
  } finally {
    withoutTerm();
  }
});

test("M5 区间契约：ALL_TIME 两端为 null 且时区固定 Asia/Shanghai", () => {
  assert.deepEqual(toAnalyticsRange(null), {
    startInclusive: null,
    endExclusive: null,
    timezone: "Asia/Shanghai",
  });
});

// ---------------------------------------------------------------- 月份窗口

test("M5 最近 12 个上海自然月：顺序升序、末尾是当前月", () => {
  const months = recentShanghaiMonths(new Date("2026-09-15T00:00:00.000Z"), 12);
  assert.equal(months.length, 12);
  assert.equal(months[0], "2025-10");
  assert.equal(months[11], "2026-09");
});

test("M5 最近 12 个上海自然月：跨年进位正确", () => {
  const months = recentShanghaiMonths(new Date("2026-01-10T00:00:00.000Z"), 3);
  assert.deepEqual(months, ["2025-11", "2025-12", "2026-01"]);
});

test("M5 最近月份窗口：月末 UTC 跨日仍算当月（上海 09-30 23:59）", () => {
  // 2026-09-30T15:59:59.999Z = 上海 09-30 23:59:59.999
  const months = recentShanghaiMonths(new Date("2026-09-30T15:59:59.999Z"), 2);
  assert.deepEqual(months, ["2026-08", "2026-09"]);
});

// ---------------------------------------------------------------- 月度趋势

test("M5 月度趋势：数据库缺失的月份补真实 0", () => {
  const trend = buildMonthlyTrend(["2026-07", "2026-08", "2026-09"], [
    { month: "2026-08", approvedCount: 3, durationMinutes: 120 },
    { month: "2026-09", approvedCount: 1, durationMinutes: 45 },
  ]);
  assert.deepEqual(trend, [
    { month: "2026-07", approvedCount: 0, durationMinutes: 0 },
    { month: "2026-08", approvedCount: 3, durationMinutes: 120 },
    { month: "2026-09", approvedCount: 1, durationMinutes: 45 },
  ]);
});

test("M5 月度趋势：BigInt / 字符串 / NULL 时长都被正确转换", () => {
  const trend = buildMonthlyTrend(["2026-09"], [
    { month: "2026-09", approvedCount: 2n, durationMinutes: null },
  ]);
  assert.deepEqual(trend, [{ month: "2026-09", approvedCount: 2, durationMinutes: 0 }]);
  assert.equal(typeof trend[0]!.approvedCount, "number");
});

test("M5 月度趋势：无数据时返回全 0 而不是空数组", () => {
  const trend = buildMonthlyTrend(["2026-08", "2026-09"], []);
  assert.equal(trend.length, 2);
  assert.equal(
    trend.every((p) => p.approvedCount === 0 && p.durationMinutes === 0),
    true,
  );
});

// ------------------------------------------------------------ 分类分布

test("M5 分类分布：按数量降序 → 时长降序 → 名称升序稳定排序", () => {
  const items = toCategoryDistribution([
    { categoryId: "b", categoryName: "打印机", approvedCount: 2, durationMinutes: 30 },
    { categoryId: "a", categoryName: "硬件", approvedCount: 5, durationMinutes: 100 },
    { categoryId: "c", categoryName: "网络", approvedCount: 2, durationMinutes: 90 },
  ]);
  assert.deepEqual(
    items.map((i) => i.categoryName),
    ["硬件", "网络", "打印机"],
  );
});

test("M5 分类分布：无分类历史记录归入稳定的「未分类」桶", () => {
  const items = toCategoryDistribution([
    { categoryId: null, categoryName: null, approvedCount: 1, durationMinutes: 10 },
  ]);
  assert.equal(items[0]!.categoryId, null);
  assert.equal(items[0]!.categoryName, UNCATEGORIZED_LABEL);
});

test("M5 分类分布：分类停用后仍显示历史名称（不因 isActive 改名）", () => {
  const items = toCategoryDistribution([
    { categoryId: "x", categoryName: "已停用分类", approvedCount: 1, durationMinutes: 10 },
  ]);
  assert.equal(items[0]!.categoryName, "已停用分类");
});

// ------------------------------------------------------------ 展示名与数值

test("M5 展示名回退链：昵称 → 实名 → 账号展示名 → 成员", () => {
  assert.equal(
    resolveDisplayName({ nickname: "小电", realName: "张三", displayName: "zs" }),
    "小电",
  );
  assert.equal(resolveDisplayName({ nickname: "  ", realName: "张三", displayName: "zs" }), "张三");
  assert.equal(resolveDisplayName({ nickname: null, realName: null, displayName: "zs" }), "zs");
  assert.equal(
    resolveDisplayName({ nickname: null, realName: null, displayName: null }),
    DISPLAY_NAME_FALLBACK,
  );
});

test("M5 入榜条件：仅 ACTIVE 且未软删除的成员档案", () => {
  assert.equal(isRankableMember({ status: "ACTIVE", deletedAt: null }), true);
  assert.equal(isRankableMember({ status: "REVOKED", deletedAt: null }), false);
  assert.equal(isRankableMember({ status: "ACTIVE", deletedAt: new Date() }), false);
  assert.equal(RANKABLE_MEMBER_STATUS, "ACTIVE");
});

test("M5 数值转换：BigInt / 字符串 / null / NaN 一律转成安全整数", () => {
  assert.equal(toSafeInteger(7n), 7);
  assert.equal(toSafeInteger("12"), 12);
  assert.equal(toSafeInteger(3.9), 3);
  assert.equal(toSafeInteger(null), 0);
  assert.equal(toSafeInteger(undefined), 0);
  assert.equal(toSafeInteger(Number.NaN), 0);
  assert.equal(toSafeDuration(null), 0);
  assert.equal(toSafeDuration(45n), 45);
});

test("M5 数值转换后可以正常 JSON 序列化（BigInt 不再炸）", () => {
  const converted = { count: toSafeInteger(9n), duration: toSafeDuration(null) };
  assert.doesNotThrow(() => JSON.stringify(converted));
  assert.equal(JSON.stringify(converted), '{"count":9,"duration":0}');
});

// ------------------------------------------------------------ 参数白名单

test("M5 参数解析：scope / metric 缺省值符合任务书", () => {
  assert.equal(rankingScopeFilter(new URLSearchParams()), "TERM");
  assert.equal(rankingMetricFilter(new URLSearchParams()), "REPAIR_COUNT");
});

test("M5 参数解析：白名单内的取值原样通过", () => {
  assert.equal(rankingScopeFilter(new URLSearchParams("scope=MONTH")), "MONTH");
  assert.equal(rankingScopeFilter(new URLSearchParams("scope=ALL_TIME")), "ALL_TIME");
  assert.equal(rankingMetricFilter(new URLSearchParams("metric=DURATION_MINUTES")), "DURATION_MINUTES");
});

test("M5 参数解析：非法 scope / metric 抛稳定错误码而不是静默回退", () => {
  assert.throws(
    () => rankingScopeFilter(new URLSearchParams("scope=YEAR")),
    (error: { code?: string }) => error.code === "ANALYTICS_SCOPE_INVALID",
  );
  assert.throws(
    () => rankingMetricFilter(new URLSearchParams("metric=AVG")),
    (error: { code?: string }) => error.code === "RANKING_METRIC_INVALID",
  );
});

// ------------------------------------------------------------ 降级语义

test("M5 排行失败占位：available=false + status=null，不伪装成空榜", () => {
  assert.equal(UNAVAILABLE_RANKING_PREVIEW.available, false);
  assert.equal(UNAVAILABLE_RANKING_PREVIEW.status, null);
  assert.deepEqual(UNAVAILABLE_RANKING_PREVIEW.leaders, []);
  assert.equal(UNAVAILABLE_RANKING_PREVIEW.currentMember, null);

  const failed = toRankingPreview({ status: "failed", code: "DB_UNAVAILABLE" });
  assert.deepEqual(failed, UNAVAILABLE_RANKING_PREVIEW);
});

test("M5 排行成功：原样透传，学期未配置也保持 available=true", () => {
  const preview: MemberRankingPreview = {
    available: true,
    status: "UNCONFIGURED",
    scope: "TERM",
    metric: "REPAIR_COUNT",
    leaders: [],
    currentMember: null,
    generatedAt: "2026-09-19T00:00:00.000Z",
  };
  assert.deepEqual(toRankingPreview({ status: "ready", data: preview }), preview);
});

// ------------------------------------------------ 正式谓词 → SQL 的机械翻译

test("M5 原生 SQL 的谓词取值来自 approvedRepairWhere()，不重复写字面量", () => {
  const sql = approvedRepairSql("rr");
  // Prisma.Sql 的 values 里应带上谓词的实际取值，而不是在 SQL 文本里硬编码。
  const values = (sql as unknown as { values: unknown[] }).values;
  assert.equal(values.includes("APPROVED"), true);
  const text = (sql as unknown as { strings: readonly string[] }).strings.join("?");
  assert.match(text, /rr\.status/);
  assert.match(text, /rr\.deleted_at/);
  assert.match(text, /IS NULL/);
});

test("M5 正式谓词的条件集合被钉死，新增条件会让 SQL 翻译层抛错", () => {
  // 原生 SQL 逐字段翻译谓词；若谓词将来新增第三个条件而 SQL 没同步，
  // 两处口径就会静默分叉。这里把「无附加条件时恰好是这两个键」钉成契约。
  assert.deepEqual(
    Object.keys(approvedRepairWhere()).sort(),
    ["deletedAt", "status"],
    "正式谓词新增条件后，必须同步更新 approvedRepairSql() 并修改本断言",
  );
  // 附加条件会原样合并进来（不是被丢弃）
  assert.deepEqual(
    Object.keys(approvedRepairWhere({ memberProfileId: "m1" })).sort(),
    ["deletedAt", "memberProfileId", "status"],
  );
});

// ------------------------------------------------ 只允许最新请求生效

test("M5 竞态守卫：旧请求的结果不会被写入", () => {
  const guard = createLatestOnlyGuard();
  const first = guard.begin();
  assert.equal(guard.isLatest(first), true, "首次请求应生效");

  const second = guard.begin();
  assert.equal(guard.isLatest(first), false, "被更新的请求取代后，旧请求必须失效");
  assert.equal(guard.isLatest(second), true);

  // 连续多次切换，只有最后一次有效
  const third = guard.begin();
  const fourth = guard.begin();
  assert.equal(guard.isLatest(third), false);
  assert.equal(guard.isLatest(fourth), true);
  assert.equal(guard.isLatest(second), false);
});

test("M5 竞态守卫：各实例的序号互不干扰", () => {
  // 序号是**每实例独立**的，只在本实例内有意义；
  // 这里断言的是「另一个守卫开始新请求，不会让本守卫的最新请求失效」。
  const a = createLatestOnlyGuard();
  const b = createLatestOnlyGuard();

  const tokenA = a.begin();
  b.begin();
  assert.equal(a.isLatest(tokenA), true, "b 的请求不应影响 a");

  const tokenB = b.begin();
  a.begin();
  assert.equal(b.isLatest(tokenB), true, "a 的请求不应影响 b");
  assert.equal(a.isLatest(tokenA), false, "a 自己开了新请求后，旧 token 仍应失效");
});
