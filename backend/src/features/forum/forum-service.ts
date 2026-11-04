import { randomUUID } from "node:crypto";
import { AppError } from "@/lib/api/errors";
import { paginationMeta } from "@/lib/api/pagination";
import type { AuthorizedActor, PaginationInput } from "@/types/contracts";
import { forumUserId, isForumModerator } from "./forum-policy";
import {
  forumRepository,
  isForumUniqueViolation,
  type ForumCommentRow,
  type ForumPostRow,
} from "./forum-repository";
import {
  normalizeAndValidateComment,
  normalizeAndValidatePost,
  type ForumCommentDraft,
  type ForumPostDraft,
} from "./forum-validation";
import { toForumCommentView, toForumPostView } from "./forum-view";

export function replayForumPost(
  existing: ForumPostRow,
  draft: Pick<ForumPostDraft, "category" | "title" | "body">,
  actor: AuthorizedActor,
) {
  if (existing.deletedAt) throw new AppError("FORUM_POST_NOT_FOUND", "帖子不存在");
  if (
    existing.category !== draft.category ||
    existing.title !== draft.title ||
    existing.body !== draft.body
  )
    throw new AppError("IDEMPOTENCY_CONFLICT", "该幂等键已用于其他帖子内容");
  return toForumPostView(existing, actor);
}

export function replayForumComment(
  existing: ForumCommentRow,
  postId: string,
  draft: Pick<ForumCommentDraft, "body">,
  actor: AuthorizedActor,
) {
  if (existing.deletedAt) throw new AppError("FORUM_COMMENT_NOT_FOUND", "评论不存在");
  if (existing.postId !== postId || existing.body !== draft.body)
    throw new AppError("IDEMPOTENCY_CONFLICT", "该幂等键已用于其他评论内容");
  return toForumCommentView(existing, actor);
}

export function createForumService(repository: typeof forumRepository = forumRepository) {
  return {
    async listPublic(
      query: { category?: string; q?: string },
      pagination: PaginationInput,
      actor: AuthorizedActor | null,
    ) {
      const { items, total } = await repository.listPublicPosts({
        ...query,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      });
      return {
        items: items.map((item) => toForumPostView(item, actor)),
        pagination: paginationMeta(pagination, total),
      };
    },

    async listMine(pagination: PaginationInput, actor: AuthorizedActor) {
      const authorId = forumUserId(actor);
      const { items, total } = await repository.listPostsByAuthor(authorId, {
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      });
      return {
        items: items.map((item) => toForumPostView(item, actor)),
        pagination: paginationMeta(pagination, total),
      };
    },

    async create(input: ForumPostDraft, actor: AuthorizedActor) {
      const authorId = forumUserId(actor);
      const draft = normalizeAndValidatePost(input);
      const existing = await repository.findPostByKey(authorId, draft.createRequestKey);
      if (existing) return replayForumPost(existing, draft, actor);
      try {
        const created = await repository.createPost({
          ...draft,
          id: randomUUID(),
          authorId,
          now: new Date(),
        });
        return toForumPostView(created, actor);
      } catch (error) {
        if (isForumUniqueViolation(error)) {
          const concurrent = await repository.findPostByKey(authorId, draft.createRequestKey);
          if (concurrent) return replayForumPost(concurrent, draft, actor);
        }
        throw error;
      }
    },

    async detail(id: string, actor: AuthorizedActor | null) {
      const post = await repository.findPostById(id);
      if (!post || post.deletedAt) throw new AppError("FORUM_POST_NOT_FOUND", "帖子不存在");
      return toForumPostView(post, actor);
    },

    async deletePost(id: string, actor: AuthorizedActor) {
      const userId = forumUserId(actor);
      const result = await repository.softDeletePost(
        id,
        { userId, moderator: isForumModerator(actor) },
        new Date(),
      );
      if (result === "not-found") throw new AppError("FORUM_POST_NOT_FOUND", "帖子不存在");
      if (result === "forbidden") throw new AppError("FORBIDDEN", "只能删除自己发布的帖子");
    },

    async listComments(postId: string, pagination: PaginationInput, actor: AuthorizedActor | null) {
      const post = await repository.findPostById(postId);
      if (!post || post.deletedAt) throw new AppError("FORUM_POST_NOT_FOUND", "帖子不存在");
      const { items, total } = await repository.listComments(postId, {
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      });
      return {
        items: items.map((item) => toForumCommentView(item, actor)),
        pagination: paginationMeta(pagination, total),
      };
    },

    async createComment(postId: string, input: ForumCommentDraft, actor: AuthorizedActor) {
      const authorId = forumUserId(actor);
      const draft = normalizeAndValidateComment(input);
      const existing = await repository.findCommentByKey(authorId, draft.createRequestKey);
      if (existing) {
        const post = await repository.findPostById(postId);
        if (!post || post.deletedAt) throw new AppError("FORUM_POST_NOT_FOUND", "帖子不存在");
        return replayForumComment(existing, postId, draft, actor);
      }
      try {
        const result = await repository.createComment({
          ...draft,
          id: randomUUID(),
          postId,
          authorId,
          now: new Date(),
        });
        if (result.outcome === "post-not-found")
          throw new AppError("FORUM_POST_NOT_FOUND", "帖子不存在");
        if (result.outcome === "comment-not-found")
          throw new AppError("FORUM_COMMENT_NOT_FOUND", "评论不存在");
        return replayForumComment(result.comment, postId, draft, actor);
      } catch (error) {
        if (isForumUniqueViolation(error)) {
          const concurrent = await repository.findCommentByKey(authorId, draft.createRequestKey);
          if (concurrent) {
            const post = await repository.findPostById(postId);
            if (!post || post.deletedAt) throw new AppError("FORUM_POST_NOT_FOUND", "帖子不存在");
            return replayForumComment(concurrent, postId, draft, actor);
          }
        }
        throw error;
      }
    },

    async deleteComment(id: string, actor: AuthorizedActor) {
      const userId = forumUserId(actor);
      const result = await repository.softDeleteComment(
        id,
        { userId, moderator: isForumModerator(actor) },
        new Date(),
      );
      if (result === "not-found") throw new AppError("FORUM_COMMENT_NOT_FOUND", "评论不存在");
      if (result === "forbidden") throw new AppError("FORBIDDEN", "只能删除自己发布的评论");
    },
  };
}

export const forumService = createForumService();
