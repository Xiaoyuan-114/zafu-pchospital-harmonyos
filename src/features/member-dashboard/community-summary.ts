import type {
  FavoriteView,
  MemberFavoriteSummary,
  MemberNotificationSummary,
  MemberRankingPreview,
  NotificationView,
} from "@/types/contracts";

/**
 * M4「通知 / 收藏摘要」的失败语义。
 *
 * 从 `member-dashboard-service.ts` 抽出来的理由与 `upcoming-entries.ts` 相同：
 * **纯逻辑放这里才能被 `tsx --test` 直接断言** —— 一旦 import 组件，
 * 就会顺着 `Button` → `Icon` 把模块顶层的 JSX 求值，直接报 `React is not defined`。
 *
 * ## 为什么失败时必须是 `null` 而不是 0
 *
 * 早先的实现是「失败时返回 `{ available: true, unreadCount: 0 }`」，
 * 于是**接口层面分不出「查询失败」和「真的没有未读」**：
 * 调用方（含未来的移动端、通知中心轮询）只会看到「0 条未读」，
 * 把一次数据库故障渲染成「你没有新消息」——静默丢消息，比报错更糟。
 *
 * M3 的口径是宁可标 `UNCONFIGURED` 也不给 0（见 `MetricValue`），这里与之对齐：
 * `available: false` + `unreadCount/count: null`。
 * 前端据 `available` 渲染错误态；`degraded` 数组仍由服务层同步登记，供页面定位区块。
 */

/** 一个可独立降级的聚合查询结果。 */
export type Settled<T> = { status: "ready"; data: T } | { status: "failed"; code: string };

/** 通知聚合查询的原始产出（与 `summarizeNotifications` 的返回结构一致）。 */
export type NotificationSummaryData = {
  unreadCount: number;
  latest: NotificationView[];
};

/** 收藏聚合查询的原始产出（与 `summarizeFavorites` 的返回结构一致）。 */
export type FavoriteSummaryData = {
  count: number;
  latest: FavoriteView[];
};

/**
 * 把一次聚合查询包成「成功 / 失败」两种结果，**不吞掉失败**。
 *
 * `code` 取错误对象上的 `code` 字段（`AppError` 等都有），拿不到时退回
 * `OVERVIEW_SECTION_FAILED` —— 与 M3 的概览降级保持同一个兜底码。
 */
export async function settleCommunity<T>(promise: Promise<T>): Promise<Settled<T>> {
  try {
    return { status: "ready", data: await promise };
  } catch (reason) {
    const code =
      reason && typeof reason === "object" && "code" in reason && typeof reason.code === "string"
        ? reason.code
        : "OVERVIEW_SECTION_FAILED";
    return { status: "failed", code };
  }
}

/** 通知摘要的失败占位：`available: false`，计数为 `null`（**不是 0**）。 */
export const UNAVAILABLE_NOTIFICATION_SUMMARY: MemberNotificationSummary = {
  available: false,
  unreadCount: null,
  latest: [],
};

/** 收藏摘要的失败占位：`available: false`，计数为 `null`（**不是 0**）。 */
export const UNAVAILABLE_FAVORITE_SUMMARY: MemberFavoriteSummary = {
  available: false,
  count: null,
  latest: [],
};

export function toNotificationSummary(settled: Settled<NotificationSummaryData>): MemberNotificationSummary {
  return settled.status === "ready"
    ? { available: true, unreadCount: settled.data.unreadCount, latest: settled.data.latest }
    : UNAVAILABLE_NOTIFICATION_SUMMARY;
}

export function toFavoriteSummary(settled: Settled<FavoriteSummaryData>): MemberFavoriteSummary {
  return settled.status === "ready"
    ? { available: true, count: settled.data.count, latest: settled.data.latest }
    : UNAVAILABLE_FAVORITE_SUMMARY;
}

/**
 * 排行预览的失败占位：`available: false` + `status: null`。
 *
 * 与通知/收藏同样不给「空榜单」——空榜在业务上是合法结果
 * （本学期确实没有人上榜），不能拿它冒充一次数据库故障。
 * 学期未配置走的是另一条路：`available: true, status: "UNCONFIGURED"`。
 */
export const UNAVAILABLE_RANKING_PREVIEW: MemberRankingPreview = {
  available: false,
  status: null,
  scope: "TERM",
  metric: "REPAIR_COUNT",
  leaders: [],
  currentMember: null,
  generatedAt: new Date(0).toISOString(),
};

export function toRankingPreview(settled: Settled<MemberRankingPreview>): MemberRankingPreview {
  return settled.status === "ready" ? settled.data : UNAVAILABLE_RANKING_PREVIEW;
}
