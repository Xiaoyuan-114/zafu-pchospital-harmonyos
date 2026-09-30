import type { RepairActivityStatus } from "@/features/repair-activities/repair-activity-validation";

/** 公开列表排序所需最小字段（status 须已派生）。 */
export type PublicListSortable = {
  id: string;
  status: RepairActivityStatus;
  activityAt: string | Date;
  createdAt?: string | Date;
};

function toTime(value: string | Date): number {
  return typeof value === "string" ? new Date(value).getTime() : value.getTime();
}

function tieBreak(a: PublicListSortable, b: PublicListSortable): number {
  const ac = a.createdAt ? toTime(a.createdAt) : 0;
  const bc = b.createdAt ? toTime(b.createdAt) : 0;
  if (ac !== bc) return ac - bc;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * 方案 B（验收写死）：
 * 1) 非 ENDED：activityAt 升序，次键稳定（createdAt asc → id）
 * 2) ENDED 整段在后：activityAt 降序，次键稳定
 */
export function sortRepairActivitiesForPublicList<T extends PublicListSortable>(
  items: readonly T[],
): T[] {
  const active: T[] = [];
  const ended: T[] = [];
  for (const item of items) {
    (item.status === "ENDED" ? ended : active).push(item);
  }
  active.sort((a, b) => {
    const d = toTime(a.activityAt) - toTime(b.activityAt);
    return d !== 0 ? d : tieBreak(a, b);
  });
  ended.sort((a, b) => {
    const d = toTime(b.activityAt) - toTime(a.activityAt);
    return d !== 0 ? d : tieBreak(a, b);
  });
  return [...active, ...ended];
}

/**
 * 首页预览的状态优先级：数字小者在前。
 *
 * 「还报得上名的」最该被看见 —— 只按 activityAt 升序时，报名已截止（CLOSED）
 * 或已满（FULL）的活动会挤掉报名开放中（OPEN）的卡片。
 */
const HOME_PREVIEW_STATUS_PRIORITY: Record<RepairActivityStatus, number> = {
  OPEN: 0,
  UPCOMING: 1,
  FULL: 2,
  CLOSED: 3,
  ENDED: 4,
};

/**
 * 首页近场活动（UX R3 / R7）：按「报名开放中优先」取前 `limit` 条未结束活动。
 *
 * 优先级：OPEN → UPCOMING → 其余未结束状态（FULL / CLOSED），
 * 同一档内按 activityAt 升序（次键与公开列表一致）；ENDED 一律不进预览。
 *
 * 与公开列表的「方案 B」是两个口径：公开列表必须整体按 activityAt 排序
 * （验收写死），首页预览只关心「先给还报得上名的」。调用方可先拿 listPublic
 * 结果再喂入本函数（这里会重新分档，不会改动入参）。
 */
export function pickNonEndedRepairActivitiesForHomePreview<T extends PublicListSortable>(
  items: readonly T[],
  limit = 3,
): T[] {
  const n = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 3;
  return items
    .filter((item) => item.status !== "ENDED")
    .sort((a, b) => {
      const byStatus =
        HOME_PREVIEW_STATUS_PRIORITY[a.status] - HOME_PREVIEW_STATUS_PRIORITY[b.status];
      if (byStatus !== 0) return byStatus;
      const byActivityAt = toTime(a.activityAt) - toTime(b.activityAt);
      return byActivityAt !== 0 ? byActivityAt : tieBreak(a, b);
    })
    .slice(0, n);
}
