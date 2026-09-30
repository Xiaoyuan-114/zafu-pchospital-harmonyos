import { MemberAvatar } from "@/components/member/MemberAvatar";
import { formatDurationMinutes } from "@/config/member";
import { rankingsCopy } from "@/config/rankings";
import type { RankingEntry, RankingMetric } from "@/types/contracts";

/**
 * 排行榜单行（纯展示，无状态）。
 *
 * 无障碍与可读性要求（任务书 §10.1、§10.4）：
 * - 名次以「第 N 名」文字给出，**并列由相同的名次数字表达**（1、1、3），
 *   因此不需要额外的「并列」徽标 —— 也不能只靠金银铜颜色区分前三名；
 * - 时长用 `formatDurationMinutes` 渲染成「X 小时 Y 分钟」，
 *   本身就是**精确且可读**的文本，不需要再加一份隐藏副本
 *   （重复的 `sr-only` 只会让读屏把同一个数字念两遍）；
 * - 当前成员用文字徽标标注，而不是只换颜色。
 */
export type RankingRowProps = {
  entry: RankingEntry;
  metric: RankingMetric;
};

export function RankingRow({ entry, metric }: RankingRowProps) {
  const primary =
    metric === "REPAIR_COUNT"
      ? `${entry.approvedCount} ${rankingsCopy.countUnit}`
      : formatDurationMinutes(entry.durationMinutes);

  return (
    <li
      className={`ranking-row${entry.isCurrentMember ? " ranking-row--current" : ""}`}
      aria-current={entry.isCurrentMember ? "true" : undefined}
    >
      <span className="ranking-row__rank">
        {rankingsCopy.rankPrefix}
        <span className="ranking-row__rank-num">{entry.rank}</span>
        {rankingsCopy.rankSuffix}
      </span>

      <MemberAvatar displayName={entry.displayName} avatarUrl={entry.avatarUrl} />
      <span className="ranking-row__name">
        {entry.displayName}
        {entry.isCurrentMember ? <span className="ranking-row__badge">{rankingsCopy.currentBadge}</span> : null}
      </span>

      <span className="ranking-row__value">{primary}</span>
    </li>
  );
}
