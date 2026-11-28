import { deviceLookupSerial } from "@/features/devices/device-http";
import { deviceService } from "@/features/devices/device-service";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { getRequestId } from "@/lib/api/request-id";
import { authenticateRequest } from "@/lib/auth/request";

export const runtime = "nodejs";

/**
 * 工作人员按序列号查设备（到店登记保修前的核对步骤）。
 *
 * 返回列表而不是单条：序列号只在同一账号内唯一，不同客户可能填了同一个串号。
 * 每条带 `ownerDisplayName`，工作人员据此确认是谁的机器。
 */
export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    const { actor } = await authenticateRequest(request, requestId);
    const serial = deviceLookupSerial(new URL(request.url).searchParams);
    return apiSuccess(await deviceService.staffLookup(actor, serial), requestId);
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
