import { inviteCodeService } from "@/features/invitations/invite-code-service";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { getRequestId } from "@/lib/api/request-id";
import { assertSameOrigin, authenticateRequest } from "@/lib/auth/request";
export const runtime = "nodejs";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request);
    const { actor } = await authenticateRequest(request, requestId);
    const body = (await request.json()) as Record<string, unknown>;
    return apiSuccess(
      await inviteCodeService.update(
        (await params).id,
        {
          activeFrom: date(body.activeFrom),
          expiresAt: date(body.expiresAt),
          maxUses: body.maxUses === undefined ? undefined : Number(body.maxUses),
        },
        actor,
      ),
      requestId,
    );
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
function date(value: unknown): string | null | undefined {
  return value === null ? null : typeof value === "string" ? value : undefined;
}
