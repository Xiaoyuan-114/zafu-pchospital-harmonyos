import { memberProfileService } from "@/features/member-profile/member-profile-service";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { getRequestId } from "@/lib/api/request-id";
import { authenticateRequest } from "@/lib/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `GET /api/v1/members/:memberProfileId/profile` —— 他人内部主页（M3 任务书 §10.4）。
 *
 * 只返回经 `ProfileVisibilityPolicy` 裁剪的内部资料、技能、已通过摘要与最近记录。
 * 不存在、软删除、非有效成员与无权访问统一返回 `MEMBER_PROFILE_NOT_FOUND`，避免枚举。
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ memberProfileId: string }> },
) {
  const requestId = getRequestId(request.headers);
  try {
    const { actor } = await authenticateRequest(request, requestId);
    const { memberProfileId } = await context.params;
    return apiSuccess(
      await memberProfileService.getInternal(memberProfileId, actor),
      requestId,
      // 他人主页同样私有：QQ 属内部字段，绝不能被共享缓存留存。
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
