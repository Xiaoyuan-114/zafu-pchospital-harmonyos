import { Button } from "@/components/ui/Button";
import { RankingRow } from "@/components/rankings/RankingRow";
import { rankingsCopy } from "@/config/rankings";
import type { RankingResult } from "@/types/contracts";

/**
 * 排行榜结果区（纯展示）。
 *
 * 三种状态必须可区分，且**都不能被显示成「暂无记录」**：
 * 1. `status: "UNCONFIGURED"` —— 学期区间未配置 → 明确提示「待配置」；
 * 2. 正常但为空 —— 当前范围确实无人上榜；
 * 3. 有数据 —— 列表 + 「我的排名」。
 *
 * 「我的排名」直接使用服务端返回的 `currentMember`，它**不受当前分页影响**，
 * 因此这里不做任何二次计算，也不复用分页列表里的元素。
 */
export type RankingsBoardProps = {
  result: RankingResult;
  scopeLabels: Record<"MONTH" | "TERM" | "ALL_TIME", string>;
  onPageChange: (page: number) => void;
  onRetry: () => void;
};

function paginationText(result: RankingResult): string {
  const { pagination } = result;
  return rankingsCopy.paginationSummary
    .replace("{page}", String(pagination.page))
    .replace("{totalPages}", String(Math.max(pagination.totalPages, 1)))
    .replace("{total}", String(pagination.total));
}

export function RankingsBoard({ result, scopeLabels, onPageChange, onRetry }: RankingsBoardProps) {
  if (result.status === "UNCONFIGURED") {
    return (
      <p className="member-section__note" role="status">
        {rankingsCopy.unconfigured}
      </p>
    );
  }

  const { pagination, currentMember, items, metric, scope } = result;
  const summary = paginationText(result);

  return (
    <div className="rankings-board">
      <p className="rankings-board__meta">
        {scopeLabels[scope]} · {summary}
      </p>

      {items.length === 0 ? (
        <p className="member-section__note" role="status">
          {rankingsCopy.empty}
        </p>
      ) : (
        <ol className="ranking-list">
          {items.map((entry) => (
            <RankingRow entry={entry} metric={metric} key={entry.memberProfileId} />
          ))}
        </ol>
      )}

      <nav className="rankings-pager" aria-label={summary}>
        <Button
          variant="outline"
          disabled={pagination.page <= 1}
          onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
        >
          {rankingsCopy.paginationPrev}
        </Button>
        <Button
          variant="outline"
          disabled={pagination.page >= Math.max(pagination.totalPages, 1)}
          onClick={() => onPageChange(pagination.page + 1)}
        >
          {rankingsCopy.paginationNext}
        </Button>
      </nav>

      <section className="rankings-mine" aria-labelledby="rankings-mine-title">
        <h3 className="rankings-mine__title" id="rankings-mine-title">
          {rankingsCopy.myRankTitle}
        </h3>
        {currentMember ? (
          <ol className="ranking-list ranking-list--single">
            <RankingRow entry={currentMember} metric={metric} />
          </ol>
        ) : (
          <p className="member-section__note">{rankingsCopy.myRankEmpty}</p>
        )}
      </section>

      <p className="member-section__foot">
        <Button variant="ghost" onClick={onRetry}>
          {rankingsCopy.reload}
        </Button>
      </p>
    </div>
  );
}
