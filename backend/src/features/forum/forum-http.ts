import { AppError } from "@/lib/api/errors";
import { authenticateRequest, SESSION_COOKIE_NAME } from "@/lib/auth/request";
import type { AuthorizedActor } from "@/types/contracts";
import { isForumCategory, type ForumCategory } from "./forum-types";
import { forumLimits, type ForumCommentDraft, type ForumPostDraft } from "./forum-validation";

function requiredString(body: Record<string, unknown>, name: string): string {
  const value = body[name];
  if (typeof value !== "string" || !value.trim())
    throw new AppError("VALIDATION_FAILED", `${name} 不能为空`, {
      fieldErrors: { [name]: ["不能为空"] },
    });
  return value;
}

export async function readForumJsonBody(request: Request): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new AppError("VALIDATION_FAILED", "请求体必须是合法的 JSON 对象");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AppError("VALIDATION_FAILED", "请求体必须是 JSON 对象");
  return value as Record<string, unknown>;
}

export function forumPostInput(body: Record<string, unknown>): ForumPostDraft {
  return {
    category: requiredString(body, "category"),
    title: requiredString(body, "title"),
    body: requiredString(body, "body"),
    createRequestKey: requiredString(body, "createRequestKey"),
  };
}

export function forumCommentInput(body: Record<string, unknown>): ForumCommentDraft {
  return {
    body: requiredString(body, "body"),
    createRequestKey: requiredString(body, "createRequestKey"),
  };
}

export function forumPostListQuery(params: URLSearchParams): {
  category?: ForumCategory;
  q?: string;
} {
  const category = params.get("category")?.trim().toUpperCase();
  if (category && !isForumCategory(category))
    throw new AppError("VALIDATION_FAILED", "category 参数无效", {
      fieldErrors: { category: ["必须是 GENERAL、EXPERIENCE 或 QUESTION"] },
    });
  const q = params.get("q")?.replace(/\s+/g, " ").trim();
  if (q && q.length > forumLimits.queryMaxLength)
    throw new AppError("VALIDATION_FAILED", "q 参数过长");
  return {
    ...(category ? { category: category as ForumCategory } : {}),
    ...(q ? { q } : {}),
  };
}

/** 公开读的可选登录：无效/过期凭据按游客处理，写接口仍严格鉴权。 */
export async function optionalForumActor(
  request: Request,
  requestId: string,
): Promise<AuthorizedActor | null> {
  const authorization = request.headers.get("authorization");
  const cookie = request.headers.get("cookie") ?? "";
  const presented =
    authorization?.startsWith("Bearer ") || cookie.includes(`${SESSION_COOKIE_NAME}=`);
  if (!presented) return null;
  try {
    return (await authenticateRequest(request, requestId)).actor;
  } catch {
    return null;
  }
}
