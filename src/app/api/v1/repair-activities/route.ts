import { repairActivityService } from "@/features/repair-activities/repair-activity-service";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { getRequestId } from "@/lib/api/request-id";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    return apiSuccess(await repairActivityService.listPublic(), requestId);
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
