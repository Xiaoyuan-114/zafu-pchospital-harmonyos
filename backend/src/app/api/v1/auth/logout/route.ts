import { authService } from "@/features/auth/auth-service";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { getRequestId } from "@/lib/api/request-id";
import {
  assertSameOrigin,
  readSessionToken,
  requestContext,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/request";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request);
    await authService.logout(readSessionToken(request), requestContext(request, requestId));
    const response = apiSuccess({ loggedOut: true }, requestId);
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
