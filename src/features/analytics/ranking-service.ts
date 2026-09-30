/**
 * M5 排行榜 Service（任务书 §8、§9.2）。
 *
 * 职责：权限、范围解析、并列名次语义、分页与「我的排名」组合。
 * **排名本身在 GreatSQL 内用窗口函数算出**（见 `analytics-repository`），
 * 本文件只负责把聚合行组装成 Contract，并保证：
 *
 * - 完整榜单与工作台预览**共用同一个 `buildRanking()`**，不写第二套排名逻辑；
 * - `currentMember` 由独立查询得到，**不受当前分页影响**；
 * - 零记录成员不入榜，此时 `currentMember` 为 `null`（页面显示「当前范围暂无上榜记录」）；
 * - 学期未配置时整份结果 `status: "UNCONFIGURED"`，**不伪装成空榜或 0**。
 */

import { paginationMeta } from "@/lib/api/pagination";
import { requirePermission } from "@/lib/auth/permissions";
import { memberProfileRepository } from "@/features/member-profile/member-profile-repository";
import {
  RANKING_PREVIEW_LIMIT,
  type AnalyticsScope,
  type RankingEntry,
  type RankingMetric,
  type RankingQueryInput,
  type RankingResult,
  type RankingServiceContract,
} from "@/types/contracts";
import {
  countRankedMembers,
  getMemberRankingRow,
  listRankingMemberInfo,
  listRankingPage,
  type RankingAggregateRow,
} from "./analytics-repository";
import {
  DISPLAY_NAME_FALLBACK,
  resolveDisplayName,
  toSafeDuration,
  toSafeInteger,
} from "./analytics-policy";
import { resolveScopeRange, toAnalyticsRange } from "./analytics-view";

export const rankingService: RankingServiceContract = {
  async getRankings(input: RankingQueryInput, actor) {
    requirePermission(actor, "analytics:read_internal");
    const self = await memberProfileRepository.activeForUser(actor.userId);
    return buildRanking({
      scope: input.scope,
      metric: input.metric,
      page: input.page,
      pageSize: input.pageSize,
      currentMemberProfileId: self.id,
      now: new Date(),
    });
  },

  async getTermPreview(memberProfileId, actor) {
    // 与 getRankings 同一道权限闸门：本方法接受显式 memberProfileId，
    // 不校验就会变成读任意成员名次的旁路。
    requirePermission(actor, "analytics:read_internal");
    const ranking = await buildRanking({
      scope: "TERM",
      metric: "REPAIR_COUNT",
      page: 1,
      pageSize: RANKING_PREVIEW_LIMIT,
      currentMemberProfileId: memberProfileId,
      now: new Date(),
    });
    return {
      available: true,
      status: ranking.status,
      scope: "TERM",
      metric: "REPAIR_COUNT",
      leaders: ranking.items,
      currentMember: ranking.currentMember,
      generatedAt: ranking.generatedAt,
    };
  },
};

type BuildRankingOptions = {
  scope: AnalyticsScope;
  metric: RankingMetric;
  page: number;
  pageSize: number;
  currentMemberProfileId: string;
  now: Date;
};

/**
 * 榜单构建的唯一实现。
 *
 * 分页与名次都在数据库内完成；这里额外做两件事：
 * 1. 把分页结果与「我的排名」涉及到的成员 ID 合并成**一次**成员信息查询，
 *    避免按行 N+1 取展示名；
 * 2. 用 `resolveDisplayName()` 统一回退展示名，**不返回任何身份字段**。
 */
async function buildRanking(options: BuildRankingOptions): Promise<RankingResult> {
  const { status, range } = resolveScopeRange(options.scope, options.now);
  const base = {
    scope: options.scope,
    metric: options.metric,
    status,
    range: toAnalyticsRange(range),
    source: "M5_ANALYTICS" as const,
    generatedAt: new Date().toISOString(),
  };

  // 学期未配置：不查库、不给空榜，明确返回 UNCONFIGURED 让页面显示「待配置」。
  if (status === "UNCONFIGURED") {
    return {
      ...base,
      items: [],
      currentMember: null,
      pagination: paginationMeta({ page: options.page, pageSize: options.pageSize }, 0),
    };
  }

  const skip = (options.page - 1) * options.pageSize;
  const [rows, total, currentRow] = await Promise.all([
    listRankingPage(options.metric, range, skip, options.pageSize),
    countRankedMembers(range),
    getMemberRankingRow(options.metric, range, options.currentMemberProfileId),
  ]);

  const ids = new Set(rows.map((row) => row.memberProfileId));
  if (currentRow) ids.add(currentRow.memberProfileId);
  const infoById = new Map(
    (await listRankingMemberInfo([...ids])).map((member) => [member.id, member]),
  );

  const toEntry = (row: RankingAggregateRow): RankingEntry => {
    const member = infoById.get(row.memberProfileId);
    const approvedCount = toSafeInteger(row.approvedCount);
    const durationMinutes = toSafeDuration(row.durationMinutes);
    return {
      rank: toSafeInteger(row.rankingPosition),
      memberProfileId: row.memberProfileId,
      displayName: member ? resolveDisplayName(member) : DISPLAY_NAME_FALLBACK,
      avatarUrl: member?.avatarUrl ?? null,
      approvedCount,
      durationMinutes,
      metricValue: options.metric === "REPAIR_COUNT" ? approvedCount : durationMinutes,
      isCurrentMember: row.memberProfileId === options.currentMemberProfileId,
    };
  };

  return {
    ...base,
    items: rows.map(toEntry),
    currentMember: currentRow ? toEntry(currentRow) : null,
    pagination: paginationMeta({ page: options.page, pageSize: options.pageSize }, total),
  };
}
