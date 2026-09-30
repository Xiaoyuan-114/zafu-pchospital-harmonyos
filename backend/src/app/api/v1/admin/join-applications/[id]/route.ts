import { joinApplicationService } from "@/features/recruitment/join-application-service";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { getRequestId } from "@/lib/api/request-id";
import { authenticateRequest } from "@/lib/auth/request";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    const { actor } = await authenticateRequest(request, requestId);
    return apiSuccess(await joinApplicationService.get((await params).id, actor), requestId);
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
