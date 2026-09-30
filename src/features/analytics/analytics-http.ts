/**
 * M5 路由层的输入解析（任务书 §9.2、§11）。
 *
 * 与 M4 的 `community-http.ts` 同一定位：把「URL 参数 → 受控 Enum」的转换集中一处，
 * **只接受白名单取值**，任何非法输入都返回稳定错误码，
 * 绝不把用户字符串透传到 SQL 的 `ORDER BY` 或分组表达式里。
 */

import { AppError } from "@/lib/api/errors";
import { AnalyticsScope, RankingMetric } from "@/types/contracts";
import type { AnalyticsScope as Scope, RankingMetric as Metric } from "@/types/contracts";

/** `scope` 缺省 `TERM`（任务书 §9.2）。 */
export function rankingScopeFilter(params: URLSearchParams): Scope {
  const raw = params.get("scope");
  if (!raw) return "TERM";
  if (!(AnalyticsScope as readonly string[]).includes(raw)) {
    throw new AppError("ANALYTICS_SCOPE_INVALID", "统计范围无效");
  }
  return raw as Scope;
}

/** `metric` 缺省 `REPAIR_COUNT`（任务书 §9.2）。 */
export function rankingMetricFilter(params: URLSearchParams): Metric {
  const raw = params.get("metric");
  if (!raw) return "REPAIR_COUNT";
  if (!(RankingMetric as readonly string[]).includes(raw)) {
    throw new AppError("RANKING_METRIC_INVALID", "排行指标无效");
  }
  return raw as Metric;
}
