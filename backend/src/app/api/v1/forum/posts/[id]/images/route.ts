import { forumImageService } from "@/features/forum/forum-image-service";
import { AppError } from "@/lib/api/errors";
import { getRequestId } from "@/lib/api/request-id";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { assertWriteAccess, authenticateRequest } from "@/lib/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** multipart 字段：photos（可重复）与 uploadKeys（可重复，顺序一一对应）。 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request.headers);
  try {
    assertWriteAccess(request);
    const { actor } = await authenticateRequest(request, requestId);
    let form: FormData;
    try {
      form = await request.formData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/exceed|too large|body.*size|payload.*size/i.test(message))
        throw new AppError("FORUM_IMAGE_TOO_LARGE", "上传内容超过大小上限", { cause: error });
      throw new AppError("VALIDATION_FAILED", "multipart 表单格式不正确", { cause: error });
    }
    const files = form.getAll("photos").filter((item): item is File => item instanceof File);
    const pluralKeys = form.getAll("uploadKeys").filter((item): item is string => typeof item === "string");
    const uploadKeys = pluralKeys.length
      ? pluralKeys
      : form.getAll("uploadKey").filter((item): item is string => typeof item === "string");
    return apiSuccess(
      await forumImageService.upload((await params).id, files, uploadKeys, actor),
      requestId,
      { status: 201 },
    );
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
