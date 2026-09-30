"use client";

import { useCallback, useEffect, useState } from "react";

import { MemberCategoryDistribution } from "@/components/analytics/MemberCategoryDistribution";
import { MemberMonthlyTrend } from "@/components/analytics/MemberMonthlyTrend";
import { Button } from "@/components/ui/Button";
import { MemberSection } from "@/components/member/MemberSection";
import { memberCopy } from "@/config/member";
import type { MemberAnalytics as MemberAnalyticsData } from "@/types/contracts";

/**
 * 个人主页的分类分布与 12 个月趋势（客户端取数）。
 *
 * 数据来自 `GET /api/v1/member/analytics`，**只统计审核已通过的记录**，
 * 且与工作台摘要共用同一个 Analytics 入口（口径一致）。
 *
 * 状态处理：加载中 / 加载失败 / 空数据 都能区分；
 * 失败时给出局部错误与重试，不会把「查不出来」画成「没有数据」。
 */
export function MemberAnalytics() {
  const copy = memberCopy.profile;
  const [data, setData] = useState<MemberAnalyticsData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const response = await fetch("/api/v1/member/analytics", { cache: "no-store" });
      const json = await response.json();
      if (!json.success) throw new Error(json?.error?.code ?? "ANALYTICS_FAILED");
      setData(json.data as MemberAnalyticsData);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <section aria-labelledby="member-distribution-title">
        <MemberSection id="member-distribution-title" title={copy.distributionTitle} tag={copy.distributionTag}>
          {state === "loading" ? (
            <p className="member-section__note" role="status">
              {memberCopy.common.loading}
            </p>
          ) : state === "error" || !data ? (
            <SectionError onRetry={() => void load()} />
          ) : (
            <MemberCategoryDistribution items={data.categoryDistribution} />
          )}
        </MemberSection>
      </section>

      <section aria-labelledby="member-trend-title">
        <MemberSection id="member-trend-title" title={copy.trendTitle} tag={copy.trendTag}>
          {state === "loading" ? (
            <p className="member-section__note" role="status">
              {memberCopy.common.loading}
            </p>
          ) : state === "error" || !data ? (
            <SectionError onRetry={() => void load()} />
          ) : (
            <MemberMonthlyTrend points={data.monthlyTrend} />
          )}
        </MemberSection>
      </section>
    </>
  );
}

function SectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="member-section__error" role="status">
      <p>{memberCopy.common.sectionLoadError}</p>
      <Button onClick={onRetry}>{memberCopy.common.reload}</Button>
    </div>
  );
}
