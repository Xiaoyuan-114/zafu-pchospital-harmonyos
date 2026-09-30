import { skillService } from "@/features/skills/skill-service";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { getRequestId } from "@/lib/api/request-id";
import { assertSameOrigin, authenticateRequest } from "@/lib/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `GET /api/v1/skills` —— 启用中的技能标签，用于成员技能选择。
 * 只读、不含成员信息，但仍要求登录：技能选择是成员内部能力。
 */
export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    await authenticateRequest(request, requestId);
    return apiSuccess(await skillService.listActive(), requestId, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiFailure(error, requestId);
  }
}

/**
 * `POST /api/v1/skills` —— 成员自建技能标签（issue #68，业务确认无需审核）。
 *
 * 标签库是**全体成员共享**的资源，所以除同名复用外再加一道按账号的限流：
 * 挡的是「换着名字灌标签」这种把公共列表刷脏的用法。
 */
export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request);
    const { actor } = await authenticateRequest(request, requestId);
    enforceRateLimit(`skill:create:${actor.userId}`, 10, 60_000);
    const body = (await request.json()) as Record<string, unknown>;
    return apiSuccess(await skillService.createFromMember(body.name, actor), requestId, {
      status: 201,
    });
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
