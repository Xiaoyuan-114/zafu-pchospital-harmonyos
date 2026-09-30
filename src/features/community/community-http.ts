import { AppError } from "@/lib/api/errors";
import { NotificationStatus, type CreateRepairCommentInput } from "@/types/contracts";

function rejectUnknownFields(body: Record<string, unknown>, allowed: readonly string[]): void {
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new AppError("VALIDATION_FAILED", "请求包含不允许的字段", {
      fieldErrors: Object.fromEntries(unknown.map((key) => [key, ["不允许修改该字段"]])),
    });
  }
}

export function createCommentInput(body: Record<string, unknown>): CreateRepairCommentInput {
  rejectUnknownFields(body, ["body", "parentCommentId", "mentionedMemberProfileIds"]);
  if (typeof body.body !== "string") {
    throw new AppError("COMMENT_BODY_INVALID", "评论内容必须是字符串", {
      fieldErrors: { body: ["评论内容必须是字符串"] },
    });
  }
  const input: CreateRepairCommentInput = { body: body.body };
  if (Object.prototype.hasOwnProperty.call(body, "parentCommentId")) {
    const parent = body.parentCommentId;
    if (parent !== null && typeof parent !== "string") {
      throw new AppError("COMMENT_PARENT_INVALID", "parentCommentId 必须是字符串或 null");
    }
    input.parentCommentId = parent;
  }
  if (Object.prototype.hasOwnProperty.call(body, "mentionedMemberProfileIds")) {
    const ids = body.mentionedMemberProfileIds;
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
      throw new AppError("VALIDATION_FAILED", "mentionedMemberProfileIds 必须是字符串数组", {
        fieldErrors: { mentionedMemberProfileIds: ["必须是字符串数组"] },
      });
    }
    input.mentionedMemberProfileIds = ids;
  }
  return input;
}

export function createFavoriteInput(body: Record<string, unknown>): { repairRecordId: string } {
  rejectUnknownFields(body, ["repairRecordId"]);
  if (typeof body.repairRecordId !== "string" || body.repairRecordId.trim() === "") {
    throw new AppError("VALIDATION_FAILED", "repairRecordId 无效", {
      fieldErrors: { repairRecordId: ["repairRecordId 必须是非空字符串"] },
    });
  }
  return { repairRecordId: body.repairRecordId.trim() };
}

export function notificationStatusFilter(params: URLSearchParams) {
  const status = params.get("status") || undefined;
  if (!status) return undefined;
  if (!(NotificationStatus as readonly string[]).includes(status)) {
    throw new AppError("VALIDATION_FAILED", "status 参数无效");
  }
  return status as (typeof NotificationStatus)[number];
}
