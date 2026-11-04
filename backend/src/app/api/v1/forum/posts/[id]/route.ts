import { optionalForumActor } from "@/features/forum/forum-http";
import { forumService } from "@/features/forum/forum-service";
import { getRequestId } from "@/lib/api/request-id";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { assertWriteAccess, authenticateRequest } from "@/lib/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const requestId = getRequestId(request.headers);
  try {
    const actor = await optionalForumActor(request, requestId);
    return apiSuccess(await forumService.detail((await params).id, actor), requestId);
  } catch (error) {
    return apiFailure(error, requestId);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const requestId = getRequestId(request.headers);
  try {
    assertWriteAccess(request);
    const { actor } = await authenticateRequest(request, requestId);
    await forumService.deletePost((await params).id, actor);
    return apiSuccess({ deleted: true }, requestId, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
