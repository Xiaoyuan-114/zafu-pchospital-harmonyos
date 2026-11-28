import { apiFailure, apiSuccess } from "@/lib/api/response";
import { getRequestId } from "@/lib/api/request-id";
import { assertWriteAccess, authenticateRequest } from "@/lib/auth/request";
import type { AuthorizedActor } from "@/types/contracts";
import { optionalForumActor } from "./forum-http";

export async function communityRequest(
  request: Request,
  auth: "required" | "optional",
  operation: (actor: AuthorizedActor | null) => Promise<unknown>,
  options: { status?: number } = {},
) {
  const requestId = getRequestId(request.headers);
  try {
    if (request.method !== "GET") assertWriteAccess(request);
    const actor =
      auth === "required"
        ? (await authenticateRequest(request, requestId)).actor
        : await optionalForumActor(request, requestId);
    const result = await operation(actor);
    const headers = { "Cache-Control": "private, no-store" };
    if (result && typeof result === "object" && "items" in result && "pagination" in result) {
      const page = result as {
        items: unknown[];
        pagination: import("@/types/contracts").PaginationMeta;
      };
      return apiSuccess(page.items, requestId, {
        ...options,
        pagination: page.pagination,
        headers,
      });
    }
    return apiSuccess(result, requestId, { ...options, headers });
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
