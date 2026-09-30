import { RankingRow } from "@/components/rankings/RankingRow";
import { memberCopy } from "@/config/member";
import type { MemberRankingPreview } from "@/types/contracts";

/**
 * 工作台「维修排行」预览（本学期 + 维修数量，前 3 名）。
 *
 * 三种状态可区分：
 * - `available: false`（区块加载失败）→ 由外层按 `degraded` 渲染局部错误，
 *   本组件返回 `null`，**不在这里把失败画成空榜**；
 * - `status: "UNCONFIGURED"`（学期未配置）→ 明确提示「待配置」；
 * - 正常 → 前 3 名 + 「我的排名」。
 *
 * 这里只做预览，不再带「查看完整排行榜」的入口：榜单页收在侧栏足部的「设置」里，
 * 预览区块保持原样（数据、字段、`degraded` 语义都不变）。
 *
 * 预览与完整榜单**共用同一个 `RankingRow`**，保证同一份数据在两处呈现一致。
 */
export function MemberRankingPreviewView({ preview }: { preview: MemberRankingPreview }) {
  if (!preview.available) return null;

  const copy = memberCopy.dashboard;

  if (preview.status === "UNCONFIGURED") {
    return <p className="member-section__note">{copy.rankingUnconfigured}</p>;
  }

  return (
    <div className="ranking-preview">
      <p className="ranking-preview__meta">{copy.rankingTopLabel.replace("{count}", String(preview.leaders.length))}</p>

      {preview.leaders.length === 0 ? (
        <p className="member-section__note">{copy.rankingEmpty}</p>
      ) : (
        <ol className="ranking-list">
          {preview.leaders.map((entry) => (
            <RankingRow entry={entry} metric={preview.metric} key={entry.memberProfileId} />
          ))}
        </ol>
      )}

      <p className="ranking-preview__mine">
        <span className="ranking-preview__mine-label">{copy.rankingMyRank}</span>
        {preview.currentMember ? (
          <span className="ranking-preview__mine-value">
            {copy.rankingMyRankValue.replace("{rank}", String(preview.currentMember.rank))}
          </span>
        ) : (
          <span className="ranking-preview__mine-value">{copy.rankingNoRank}</span>
        )}
      </p>
    </div>
  );
}
