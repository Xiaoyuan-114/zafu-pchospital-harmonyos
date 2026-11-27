import { benefitService } from "@/features/devices/benefit-service";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { getRequestId } from "@/lib/api/request-id";
import { assertWriteAccess, authenticateRequest } from "@/lib/auth/request";

export const runtime = "nodejs";

/**
 * 作废一条权益（仅管理员，`benefit:void`）。
 *
 * 只改 `state`，不删行：客户仍能看到「已作废」，历史可追溯。
 * 重复调用幂等，返回当前状态。
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertWriteAccess(request);
    const { actor } = await authenticateRequest(request, requestId);
    return apiSuccess(await benefitService.voidBenefit(actor, (await params).id), requestId);
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
