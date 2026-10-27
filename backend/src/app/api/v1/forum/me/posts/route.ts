import { forumService } from "@/features/forum/forum-service";
import { parsePagination } from "@/lib/api/pagination";
import { getRequestId } from "@/lib/api/request-id";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { authenticateRequest } from "@/lib/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    const { actor } = await authenticateRequest(request, requestId);
    const result = await forumService.listMine(
      parsePagination(new URL(request.url).searchParams),
      actor,
    );
    return apiSuccess(result.items, requestId, {
      pagination: result.pagination,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
