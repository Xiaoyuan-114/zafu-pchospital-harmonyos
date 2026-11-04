import { AppError } from "@/lib/api/errors";
import type { AuthorizedActor } from "@/types/contracts";

export function isForumModerator(actor: AuthorizedActor): boolean {
  return actor.permissions.includes("forum:moderate");
}

export function forumUserId(actor: AuthorizedActor): string {
  if (!actor.userId) throw new AppError("UNAUTHENTICATED", "登录状态无效");
  return actor.userId;
}

export function assertCanDeleteForumPost(
  actor: AuthorizedActor,
  post: { authorId: string },
): void {
  const userId = forumUserId(actor);
  if (post.authorId !== userId && !isForumModerator(actor))
    throw new AppError("FORBIDDEN", "只能删除自己发布的帖子");
}

export function assertCanDeleteForumComment(
  actor: AuthorizedActor,
  comment: { authorId: string },
): void {
  const userId = forumUserId(actor);
  if (comment.authorId !== userId && !isForumModerator(actor))
    throw new AppError("FORBIDDEN", "只能删除自己发布的评论");
}
