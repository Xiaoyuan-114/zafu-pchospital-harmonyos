import type { RepairActivityStatus } from "@/features/repair-activities/repair-activity-validation";

/**
 * 公开维修活动五态 → `.repair-tag` 语义 class（T-FE-3 映射；列表与详情共用）。
 * OPEN 可行动 / FULL 警告 / UPCOMING·CLOSED 中性 / ENDED 结果中性。
 */
export function repairActivityStatusBadgeClass(status: string): string {
  switch (status as RepairActivityStatus) {
    case "OPEN":
      return "repair-tag repair-tag--approved";
    case "FULL":
      return "repair-tag repair-tag--pending";
    case "UPCOMING":
    case "CLOSED":
      return "repair-tag repair-tag--draft";
    case "ENDED":
      return "repair-tag repair-tag--result";
    default:
      return "repair-tag repair-tag--draft";
  }
}
