import { repairCategoryService } from "@/features/repairs/repair-category-service";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { getRequestId } from "@/lib/api/request-id";
import { authenticateRequest } from "@/lib/auth/request";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    await authenticateRequest(request, requestId);
    return apiSuccess(await repairCategoryService.list(), requestId);
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
