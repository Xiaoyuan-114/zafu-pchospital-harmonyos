import { diagnosticDraftInput } from "@/features/diagnostics/diagnostic-http";
import { diagnosticService } from "@/features/diagnostics/diagnostic-service";
import { parsePagination } from "@/lib/api/pagination";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { getRequestId } from "@/lib/api/request-id";
import { assertWriteAccess, authenticateRequest } from "@/lib/auth/request";

export const runtime = "nodejs";

/** 本人的检测记录（Issue #102）。 */
export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    const { actor } = await authenticateRequest(request, requestId);
    const pagination = parsePagination(new URL(request.url).searchParams);
    const result = await diagnosticService.list(actor, pagination);
    return apiSuccess(result.items, requestId, { pagination: result.pagination });
  } catch (error) {
    return apiFailure(error, requestId);
  }
}

/** 提交一次症状问答：结论由服务端按目录计算后落库。 */
export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    assertWriteAccess(request);
    const { actor } = await authenticateRequest(request, requestId);
    return apiSuccess(await diagnosticService.run(actor, await diagnosticDraftInput(request)), requestId, {
      status: 201,
    });
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
