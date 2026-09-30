/**
 * 数据库聚合结果 → 稳定 Contract 的纯转换（M5 任务书 §7）。
 *
 * 本文件不做任何查询，也不依赖 Prisma：把「聚合行的形状差异」和
 * 「缺失月份补零」这类容易出错的分支集中在一处，便于单测直接覆盖。
 */

import type { UtcRange } from "@/lib/academic-term";
import { UNCATEGORIZED_LABEL } from "@/types/contracts";
import type {
  AnalyticsRange,
  AnalyticsScope,
  AnalyticsStatus,
  CategoryDistributionItem,
  MonthlyTrendPoint,
} from "@/types/contracts";
import { resolveMemberRanges } from "@/features/member-dashboard/member-overview-provider";
import { toSafeDuration, toSafeInteger } from "./analytics-policy";

/**
 * 统计范围解析。
 *
 * **复用 M3 的 `resolveMemberRanges()`**，而不是自己再算一次上海自然月或读一遍学期配置：
 * 三个入口（工作台 / 个人主页 / 排行榜）必须共用同一套日期口径，否则同名指标会不相等。
 *
 * - `MONTH` → 当前 `Asia/Shanghai` 自然月；
 * - `TERM` → 学期区间；**未配置时返回 `UNCONFIGURED` 且 `range: null`**，
 *   由调用方渲染「待配置」，绝不退化成空榜或 0；
 * - `ALL_TIME` → `range: null` 表示不附加任何日期条件。
 */
export function resolveScopeRange(
  scope: AnalyticsScope,
  now: Date,
): { status: AnalyticsStatus; range: UtcRange | null } {
  const { monthRange, termRange } = resolveMemberRanges(now);
  switch (scope) {
    case "MONTH":
      return { status: "AVAILABLE", range: monthRange };
    case "TERM":
      return termRange
        ? { status: "AVAILABLE", range: termRange }
        : { status: "UNCONFIGURED", range: null };
    case "ALL_TIME":
      return { status: "AVAILABLE", range: null };
  }
}

/**
 * 区间 → Contract。`null` 表示 `ALL_TIME`：无日期条件，两端均为 `null`
 * （**不是**「全 0 到全 0」，消费方必须按「无约束」理解）。
 */
export function toAnalyticsRange(range: UtcRange | null): AnalyticsRange {
  return {
    startInclusive: range ? range.startInclusive.toISOString() : null,
    endExclusive: range ? range.endExclusive.toISOString() : null,
    timezone: "Asia/Shanghai",
  };
}

export type MonthlyAggregateRow = {
  month: string;
  approvedCount: unknown;
  durationMinutes: unknown;
};

/**
 * 按月补零。
 *
 * 数据库只聚出**有数据**的月份，这里按传入的完整月份序列（升序，最后一个是当前月）
 * 补齐为真实 `0` —— 缺失月份代表「当月确实没有已通过记录」，而不是未知。
 */
export function buildMonthlyTrend(
  months: readonly string[],
  rows: readonly MonthlyAggregateRow[],
): MonthlyTrendPoint[] {
  const byMonth = new Map<string, MonthlyTrendPoint>();
  for (const row of rows) {
    const month = String(row.month);
    byMonth.set(month, {
      month,
      approvedCount: toSafeInteger(row.approvedCount),
      durationMinutes: toSafeDuration(row.durationMinutes),
    });
  }
  return months.map(
    (month) => byMonth.get(month) ?? { month, approvedCount: 0, durationMinutes: 0 },
  );
}

export type CategoryAggregateRow = {
  categoryId: string | null;
  categoryName: string | null;
  approvedCount: unknown;
  durationMinutes: unknown;
};

/**
 * 分类分布。
 *
 * - `categoryId = null` 的历史记录归入稳定的「未分类」桶；
 * - 分类被软删除后**仍显示其历史名称**（查询侧不过滤 `category.deletedAt`），
 *   避免历史统计因分类停用而改名或消失；
 * - 排序：数量降序 → 时长降序 → 名称升序，保证同一份数据顺序稳定。
 */
export function toCategoryDistribution(
  rows: readonly CategoryAggregateRow[],
): CategoryDistributionItem[] {
  return rows
    .map((row) => ({
      categoryId: row.categoryId,
      categoryName: row.categoryName?.trim() || UNCATEGORIZED_LABEL,
      approvedCount: toSafeInteger(row.approvedCount),
      durationMinutes: toSafeDuration(row.durationMinutes),
    }))
    .sort(
      (a, b) =>
        b.approvedCount - a.approvedCount ||
        b.durationMinutes - a.durationMinutes ||
        a.categoryName.localeCompare(b.categoryName, "zh-Hans-CN"),
    );
}
