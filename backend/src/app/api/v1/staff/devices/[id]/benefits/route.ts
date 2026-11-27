import { benefitDraftInput, readJsonBody } from "@/features/devices/device-http";
import { benefitService } from "@/features/devices/benefit-service";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { getRequestId } from "@/lib/api/request-id";
import { assertWriteAccess, authenticateRequest } from "@/lib/auth/request";

export const runtime = "nodejs";

/**
 * 工作人员为客户设备登记一条权益（保修/延保/到店服务/意外保障）。
 *
 * 设备归属仍是客户，这里只写权益记录，登记人记在 `createdByUserId` 上；
 * 客户侧只读，不能自己给自己登记保修。
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertWriteAccess(request);
    const { actor } = await authenticateRequest(request, requestId);
    const body = await readJsonBody(request);
    return apiSuccess(
      await benefitService.register(actor, (await params).id, benefitDraftInput(body)),
      requestId,
      { status: 201 },
    );
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
