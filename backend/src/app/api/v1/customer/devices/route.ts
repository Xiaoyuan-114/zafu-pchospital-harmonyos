import { deviceDraftInput, deviceListStatus } from "@/features/devices/device-http";
import { deviceService } from "@/features/devices/device-service";
import { readJsonBody } from "@/lib/api/json-body";
import { parsePagination } from "@/lib/api/pagination";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { getRequestId } from "@/lib/api/request-id";
import { assertWriteAccess, authenticateRequest } from "@/lib/auth/request";

export const runtime = "nodejs";

/** 本人设备列表（Issue #102）。 */
export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    const { actor } = await authenticateRequest(request, requestId);
    const params = new URL(request.url).searchParams;
    const pagination = parsePagination(params);
    // 默认只列在用的设备；status=RETIRED 才返回已解绑记录。
    const result = await deviceService.list(actor, pagination, { status: deviceListStatus(params) });
    return apiSuccess(result.items, requestId, { pagination: result.pagination });
  } catch (error) {
    return apiFailure(error, requestId);
  }
}

/**
 * 绑定一台设备：归属人由会话决定，不接收客户端自报的 ownerUserId。
 *
 * 新建返回 201；序列号撞上本人已解绑的同一台机器时复用原记录（复活），
 * 语义上是一次更新，返回 200。
 */
export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    assertWriteAccess(request);
    const { actor } = await authenticateRequest(request, requestId);
    const body = await readJsonBody(request);
    const result = await deviceService.create(actor, deviceDraftInput(body));
    return apiSuccess(result.device, requestId, { status: result.created ? 201 : 200 });
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
