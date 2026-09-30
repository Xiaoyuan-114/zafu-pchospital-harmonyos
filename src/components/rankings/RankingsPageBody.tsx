"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { RankingsBoard } from "@/components/rankings/RankingsBoard";
import { memberCopy } from "@/config/member";
import { rankingsCopy, rankingsPage, rankingsSections } from "@/config/rankings";
import { createLatestOnlyGuard } from "@/features/analytics/latest-only";
import type { RankingResult } from "@/types/contracts";

/**
 * `/member/rankings` —— 内部排行榜页面主体（客户端）。
 *
 * 数据来自 `GET /api/v1/member/rankings`，筛选条件全部**由服务端白名单解析**，
 * 前端只负责把它们拼进查询串（非法值一律由服务端返回稳定 400，前端不自行降级）。
 *
 * 状态处理：加载中 / 加载失败 / 学期未配置 / 空数据 四种都必须可区分，
 * 且「学期未配置」来自服务端的 `status: "UNCONFIGURED"`，不是前端猜的。
 */
export function RankingsPageBody({ scope: initialScope, metric: initialMetric }: {
  scope: "MONTH" | "TERM" | "ALL_TIME";
  metric: "REPAIR_COUNT" | "DURATION_MINUTES";
}) {
  const [scope, setScope] = useState(initialScope);
  const [metric, setMetric] = useState(initialMetric);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<RankingResult | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  /** 快速切换筛选时，只允许最新一次请求写入状态（见 `latest-only.ts`）。 */
  const guardRef = useRef(createLatestOnlyGuard());

  const load = useCallback(async () => {
    const token = guardRef.current.begin();
    setState("loading");
    try {
      const params = new URLSearchParams({ scope, metric, page: String(page), pageSize: "20" });
      const response = await fetch(`/api/v1/member/rankings?${params.toString()}`, { cache: "no-store" });
      const json = await response.json();
      if (!json.success) throw new Error(json?.error?.code ?? "RANKINGS_FAILED");
      if (!guardRef.current.isLatest(token)) return;
      setResult(json.data as RankingResult);
      setState("ready");
    } catch {
      if (!guardRef.current.isLatest(token)) return;
      setState("error");
    }
  }, [scope, metric, page]);

  useEffect(() => {
    void load();
  }, [load]);

  /** 切换范围或指标时回到第 1 页，否则会停在越界页。 */
  function applyFilter(next: { scope?: typeof scope; metric?: typeof metric }) {
    if (next.scope !== undefined) setScope(next.scope);
    if (next.metric !== undefined) setMetric(next.metric);
    setPage(1);
  }

  return (
    <div className="rankings-page">
      <header className="rankings-page__head">
        <h1 className="rankings-page__title" id="member-rankings-title">
          {rankingsPage.title}
        </h1>
        <p className="rankings-page__lead">{rankingsPage.lead}</p>
      </header>

      <div className="rankings-filters">
        <fieldset className="rankings-filters__group">
          <legend className="rankings-filters__legend">{rankingsCopy.scopeLabel}</legend>
          {(Object.keys(rankingsCopy.scopes) as Array<typeof scope>).map((key) => (
            <Button
              key={key}
              variant={scope === key ? "solid" : "ghost"}
              aria-pressed={scope === key}
              onClick={() => applyFilter({ scope: key })}
            >
              {rankingsCopy.scopes[key]}
            </Button>
          ))}
        </fieldset>

        <fieldset className="rankings-filters__group">
          <legend className="rankings-filters__legend">{rankingsCopy.metricLabel}</legend>
          {(Object.keys(rankingsCopy.metrics) as Array<typeof metric>).map((key) => (
            <Button
              key={key}
              variant={metric === key ? "solid" : "ghost"}
              aria-pressed={metric === key}
              onClick={() => applyFilter({ metric: key })}
            >
              {rankingsCopy.metrics[key]}
            </Button>
          ))}
        </fieldset>
      </div>

      <section aria-labelledby="rankings-board-title">
        <h2 className="rankings-board__title" id="rankings-board-title">
          {rankingsSections.board.title}
        </h2>

        {state === "loading" ? (
          <p className="member-section__note" role="status">
            {memberCopy.common.loading}
          </p>
        ) : state === "error" ? (
          <div className="member-section__error" role="status">
            <p>{rankingsCopy.loadFailed}</p>
            <Button onClick={() => void load()}>{rankingsCopy.reload}</Button>
          </div>
        ) : result ? (
          <RankingsBoard
            result={result}
            onPageChange={setPage}
            onRetry={() => void load()}
            scopeLabels={rankingsCopy.scopes}
          />
        ) : null}
      </section>
    </div>
  );
}
