import { getAdminDashboardSummary } from "@/features/admin/admin-dashboard";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { getRequestId } from "@/lib/api/request-id";
import { authenticateRequest } from "@/lib/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 管理后台首页聚合：各域待办计数（`pageSize: 1` 复用列表口径）。
 * 单域失败只让那一项为 `null`，整包不失败。
 */
export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    const { actor } = await authenticateRequest(request, requestId);
    const summary = await getAdminDashboardSummary(actor);
    return apiSuccess(summary, requestId, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
