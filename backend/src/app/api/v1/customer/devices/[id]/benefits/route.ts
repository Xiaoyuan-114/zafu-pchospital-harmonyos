import { deviceService } from "@/features/devices/device-service";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { getRequestId } from "@/lib/api/request-id";
import { authenticateRequest } from "@/lib/auth/request";

export const runtime = "nodejs";

/**
 * 某台设备的权益列表。
 *
 * 与设备详情里的 `benefits` 同一份数据，单独开这个路径是为了「权益查询」页
 * 只刷新权益而不重拉设备与报修记录；也便于以后加筛选（只看有效）。
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    const { actor } = await authenticateRequest(request, requestId);
    return apiSuccess(await deviceService.listBenefits(actor, (await params).id), requestId);
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
