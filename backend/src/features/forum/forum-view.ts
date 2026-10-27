import type { AuthorizedActor } from "@/types/contracts";
import { isForumModerator } from "./forum-policy";
import type { ForumCommentRow, ForumPostImageRow, ForumPostRow } from "./forum-repository";
import type { ForumCategory } from "./forum-types";

export type ForumImageView = { id: string; url: string; sortOrder: number };
export type ForumPostView = {
  id: string;
  category: ForumCategory;
  title: string;
  body: string;
  author: { id: string; displayName: string };
  images: ForumImageView[];
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  actions: { canDelete: boolean; canUploadImages: boolean; canComment: boolean };
};
export type ForumCommentView = {
  id: string;
  postId: string;
  body: string;
  author: { id: string; displayName: string };
  createdAt: string;
  actions: { canDelete: boolean };
};

type DisplayableUser = {
  id: string;
  displayName: string | null;
  customerProfile: { nickname: string | null } | null;
  memberProfile: { nickname: string | null } | null;
};

/** 公开作者只使用昵称/显示名，不读取或返回 realName、studentId。 */
export function forumDisplayName(user: DisplayableUser): string {
  return (
    user.customerProfile?.nickname?.trim() ||
    user.memberProfile?.nickname?.trim() ||
    user.displayName?.trim() ||
    "校园用户"
  );
}

export function toForumImageView(image: ForumPostImageRow): ForumImageView {
  return {
    id: image.id,
    url: `/api/v1/forum/images/${image.id}/content`,
    sortOrder: image.sortOrder,
  };
}

export function toForumPostView(
  row: ForumPostRow,
  actor: AuthorizedActor | null = null,
): ForumPostView {
  const active = row.deletedAt === null;
  const owner = actor?.userId === row.authorId;
  return {
    id: row.id,
    category: row.category as ForumCategory,
    title: row.title,
    body: row.body,
    author: { id: row.author.id, displayName: forumDisplayName(row.author) },
    images: row.images.map(toForumImageView),
    commentCount: row._count.comments,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    actions: {
      canDelete: active && Boolean(actor?.userId) && (owner || isForumModerator(actor!)),
      canUploadImages: active && owner,
      canComment: active && Boolean(actor?.userId),
    },
  };
}

export function toForumCommentView(
  row: ForumCommentRow,
  actor: AuthorizedActor | null = null,
): ForumCommentView {
  const owner = actor?.userId === row.authorId;
  return {
    id: row.id,
    postId: row.postId,
    body: row.body,
    author: { id: row.author.id, displayName: forumDisplayName(row.author) },
    createdAt: row.createdAt.toISOString(),
    actions: {
      canDelete:
        row.deletedAt === null &&
        Boolean(actor?.userId) &&
        (owner || isForumModerator(actor!)),
    },
  };
}
