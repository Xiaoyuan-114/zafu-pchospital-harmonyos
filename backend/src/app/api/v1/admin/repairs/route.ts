import { repairListInput } from "@/features/repairs/repair-http";
import { repairQueryService } from "@/features/repairs/repair-query-service";
import { parsePagination } from "@/lib/api/pagination";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { getRequestId } from "@/lib/api/request-id";
import { authenticateRequest } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/permissions";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    const { actor } = await authenticateRequest(request, requestId);
    requirePermission(actor, "repair:review");
    const params = new URL(request.url).searchParams;
    const page = parsePagination(params);
    const result = await repairQueryService.list(
      repairListInput(params, page.page, page.pageSize),
      actor,
    );
    return apiSuccess(result.items, requestId, { pagination: result.pagination });
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
