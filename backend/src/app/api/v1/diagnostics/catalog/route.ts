import { diagnosticService } from "@/features/diagnostics/diagnostic-service";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { getRequestId } from "@/lib/api/request-id";
import { authenticateRequest } from "@/lib/auth/request";

export const runtime = "nodejs";

/**
 * 检测目录（Issue #102）。
 *
 * 需要登录：目录本身是公开知识，但入口在「服务」里、且每台设备的状态都在客户视角下，
 * 让游客拿一个半截的目录没有意义。命中缓存也不需要——纯静态数据，代价可忽略。
 */
export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    await authenticateRequest(request, requestId);
    return apiSuccess(diagnosticService.catalog(), requestId);
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
