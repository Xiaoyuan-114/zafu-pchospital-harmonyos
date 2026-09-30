import { authService } from "@/features/auth/auth-service";
import { inviteCodeService } from "@/features/invitations/invite-code-service";
import { AppError } from "@/lib/api/errors";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { getRequestId } from "@/lib/api/request-id";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { assertSameOrigin, requestContext, sessionCookie } from "@/lib/auth/request";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request);
    const body = (await request.json()) as Record<string, unknown>;
    const context = requestContext(request, requestId);
    enforceRateLimit(`invite-registration:${context.ipAddress ?? "unknown"}`, 10, 15 * 60_000);
    if (String(body.password ?? "") !== String(body.passwordConfirmation ?? "")) {
      throw new AppError("PASSWORD_CONFIRMATION_MISMATCH", "两次输入的密码不一致");
    }
    const input = {
      code: String(body.code ?? ""),
      idempotencyKey: String(body.idempotencyKey ?? ""),
      realName: String(body.realName ?? ""),
      qq: String(body.qq ?? ""),
      phone: String(body.phone ?? ""),
      studentId: optional(body.studentId),
      className: optional(body.className),
      password: String(body.password ?? ""),
    };
    const registration = await inviteCodeService.redeem(input, context);
    const login = await authService.login({ qq: input.qq, password: input.password }, context);
    const response = apiSuccess(registration, requestId, { status: 201 });
    response.cookies.set(sessionCookie(login.token, login.expiresAt));
    return response;
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
function optional(value: unknown) {
  return typeof value === "string" ? value : undefined;
}
