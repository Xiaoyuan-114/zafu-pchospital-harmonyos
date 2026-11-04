import { AppError } from "@/lib/api/errors";
import { isForumCategory } from "./forum-types";

export const forumLimits = {
  titleMaxLength: 120,
  postBodyMaxLength: 10_000,
  commentBodyMaxLength: 2_000,
  requestKeyMaxLength: 128,
  queryMaxLength: 60,
  maxImagesPerPost: 9,
} as const;

export type ForumPostDraft = {
  category: string;
  title: string;
  body: string;
  createRequestKey: string;
};

export type ForumCommentDraft = { body: string; createRequestKey: string };

function requestKey(value: string): string {
  const key = value.trim();
  if (!key || key.length > forumLimits.requestKeyMaxLength)
    throw new AppError("VALIDATION_FAILED", "createRequestKey 必填且不能超过 128 字", {
      fieldErrors: { createRequestKey: ["必填且不能超过 128 字"] },
    });
  return key;
}

export function normalizeAndValidatePost(input: ForumPostDraft): ForumPostDraft {
  const draft = {
    category: input.category.trim().toUpperCase(),
    title: input.title.replace(/\s+/g, " ").trim(),
    body: input.body.trim(),
    createRequestKey: requestKey(input.createRequestKey),
  };
  const errors: Record<string, string[]> = {};
  if (!isForumCategory(draft.category))
    errors.category = ["必须是 GENERAL、EXPERIENCE 或 QUESTION"];
  if (!draft.title) errors.title = ["请填写标题"];
  else if (draft.title.length > forumLimits.titleMaxLength)
    errors.title = [`标题不能超过 ${forumLimits.titleMaxLength} 字`];
  if (!draft.body) errors.body = ["请填写正文"];
  else if (draft.body.length > forumLimits.postBodyMaxLength)
    errors.body = [`正文不能超过 ${forumLimits.postBodyMaxLength} 字`];
  if (Object.keys(errors).length)
    throw new AppError("VALIDATION_FAILED", "帖子内容填写不正确", { fieldErrors: errors });
  return draft;
}

export function normalizeAndValidateComment(input: ForumCommentDraft): ForumCommentDraft {
  const draft = { body: input.body.trim(), createRequestKey: requestKey(input.createRequestKey) };
  if (!draft.body)
    throw new AppError("VALIDATION_FAILED", "评论不能为空", {
      fieldErrors: { body: ["请填写评论"] },
    });
  if (draft.body.length > forumLimits.commentBodyMaxLength)
    throw new AppError("VALIDATION_FAILED", "评论过长", {
      fieldErrors: { body: [`不能超过 ${forumLimits.commentBodyMaxLength} 字`] },
    });
  return draft;
}
