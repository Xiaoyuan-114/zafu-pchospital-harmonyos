import { deviceDraftInput, readJsonBody } from "@/features/devices/device-http";
import { deviceService } from "@/features/devices/device-service";
import { AppError } from "@/lib/api/errors";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { getRequestId } from "@/lib/api/request-id";
import { assertWriteAccess, authenticateRequest } from "@/lib/auth/request";

export const runtime = "nodejs";

/** 设备详情：含权益（按实际生效状态现算）与最近报修。非本人且非工作人员返回 404。 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    const { actor } = await authenticateRequest(request, requestId);
    return apiSuccess(await deviceService.detail(actor, (await params).id), requestId);
  } catch (error) {
    return apiFailure(error, requestId);
  }
}

/** 编辑设备与 POST 兼容入口共用同一处理：同一鉴权、同一校验、同一业务。 */
async function handleDeviceUpdate(
  request: Request,
  params: Promise<{ id: string }>,
  requestId: string,
) {
  assertWriteAccess(request);
  const { actor } = await authenticateRequest(request, requestId);
  const body = await readJsonBody(request);
  return apiSuccess(
    await deviceService.update(actor, (await params).id, deviceDraftInput(body)),
    requestId,
  );
}

/** 编辑设备：仅本人；字段与新增一致（整体覆盖可编辑字段）。 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    return await handleDeviceUpdate(request, params, requestId);
  } catch (error) {
    return apiFailure(error, requestId);
  }
}

/**
 * POST 兼容入口：`http.RequestMethod.PATCH` 是鸿蒙 API 26 才有的枚举，
 * API 24 客户端用 `POST + X-HTTP-Method-Override: PATCH`（头值大小写不敏感）。
 * 缺头或头值不是 PATCH 一律 405，不静默当作其它语义。
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    const override = request.headers.get("x-http-method-override")?.trim().toLowerCase();
    if (override !== "patch")
      throw new AppError(
        "METHOD_NOT_ALLOWED",
        "该路径的 POST 仅作为编辑兼容入口，必须携带 X-HTTP-Method-Override: PATCH",
      );
    return await handleDeviceUpdate(request, params, requestId);
  } catch (error) {
    return apiFailure(error, requestId);
  }
}

/** 解绑（软删）：有未结束报修时 409 DEVICE_IN_USE。 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertWriteAccess(request);
    const { actor } = await authenticateRequest(request, requestId);
    return apiSuccess(await deviceService.remove(actor, (await params).id), requestId);
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
