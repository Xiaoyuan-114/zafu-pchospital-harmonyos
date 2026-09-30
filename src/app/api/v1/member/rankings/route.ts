import { rankingMetricFilter, rankingScopeFilter } from "@/features/analytics/analytics-http";
import { rankingService } from "@/features/analytics/ranking-service";
import { parsePagination } from "@/lib/api/pagination";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { getRequestId } from "@/lib/api/request-id";
import { authenticateRequest } from "@/lib/auth/request";

export const runtime = "nodejs";
/**
 * 内部排行榜一律私有。
 *
 * ⚠️ 响应含 `isCurrentMember`，**绝不可**进入任何共享缓存 —— 同一份榜单对不同
 * 请求者内容不同（任务书 §12）。
 */
export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "private, no-store" } as const;

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    const { actor } = await authenticateRequest(request, requestId);
    const params = new URL(request.url).searchParams;
    const pagination = parsePagination(params);
    const result = await rankingService.getRankings(
      {
        ...pagination,
        scope: rankingScopeFilter(params),
        metric: rankingMetricFilter(params),
      },
      actor,
    );
    // `pagination` 已按契约放在 `data` 内（`RankingResult.pagination`），
    // 不在 `meta` 里重复一份，避免两处状态漂移。
    return apiSuccess(result, requestId, { headers: PRIVATE });
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
