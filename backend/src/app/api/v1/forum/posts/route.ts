import { forumPostInput, forumPostListQuery, optionalForumActor, readForumJsonBody } from "@/features/forum/forum-http";
import { forumService } from "@/features/forum/forum-service";
import { parsePagination } from "@/lib/api/pagination";
import { getRequestId } from "@/lib/api/request-id";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { assertWriteAccess, authenticateRequest } from "@/lib/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    const params = new URL(request.url).searchParams;
    const actor = await optionalForumActor(request, requestId);
    const result = await forumService.listPublic(
      forumPostListQuery(params),
      parsePagination(params),
      actor,
    );
    return apiSuccess(result.items, requestId, { pagination: result.pagination });
  } catch (error) {
    return apiFailure(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    assertWriteAccess(request);
    const { actor } = await authenticateRequest(request, requestId);
    const input = forumPostInput(await readForumJsonBody(request));
    return apiSuccess(await forumService.create(input, actor), requestId, { status: 201 });
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
