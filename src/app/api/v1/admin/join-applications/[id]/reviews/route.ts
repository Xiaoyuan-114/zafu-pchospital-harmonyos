import { joinApplicationService } from "@/features/recruitment/join-application-service";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { getRequestId } from "@/lib/api/request-id";
import { assertSameOrigin, authenticateRequest } from "@/lib/auth/request";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request);
    const { actor } = await authenticateRequest(request, requestId);
    const body = (await request.json()) as Record<string, unknown>;
    return apiSuccess(
      await joinApplicationService.review(
        {
          applicationId: (await params).id,
          result: body.result === "PASSED" ? "PASSED" : "REJECTED",
          interviewedAt: String(body.interviewedAt ?? ""),
          internalNote: typeof body.internalNote === "string" ? body.internalNote : undefined,
          idempotencyKey: String(body.idempotencyKey ?? ""),
        },
        actor,
      ),
      requestId,
    );
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
