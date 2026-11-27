import { diagnosticService } from "@/features/diagnostics/diagnostic-service";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { getRequestId } from "@/lib/api/request-id";
import { authenticateRequest } from "@/lib/auth/request";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    const { actor } = await authenticateRequest(request, requestId);
    const { id } = await context.params;
    return apiSuccess(await diagnosticService.detail(actor, id), requestId);
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
