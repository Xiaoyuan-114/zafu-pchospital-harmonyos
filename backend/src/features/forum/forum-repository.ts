import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db/client";
import { inSerializableTransaction } from "@/lib/db/transaction";
import type { ForumPostDraft } from "./forum-validation";

const userDisplaySelect = {
  id: true,
  displayName: true,
  customerProfile: { select: { nickname: true } },
  memberProfile: { select: { nickname: true } },
} satisfies Prisma.UserSelect;

export const forumPostInclude = {
  author: { select: userDisplaySelect },
  images: {
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }, { id: "asc" as const }],
    select: { id: true, sortOrder: true },
  },
  _count: { select: { comments: { where: { deletedAt: null } } } },
} satisfies Prisma.ForumPostInclude;

export const forumCommentInclude = {
  author: { select: userDisplaySelect },
} satisfies Prisma.ForumCommentInclude;

export type ForumPostRow = Prisma.ForumPostGetPayload<{ include: typeof forumPostInclude }>;
export type ForumCommentRow = Prisma.ForumCommentGetPayload<{
  include: typeof forumCommentInclude;
}>;
export type ForumPostImageRow = { id: string; sortOrder: number };

export function isForumUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function sameDigest(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((value, index) => value === right[index]);
}

export const forumRepository = {
  async listPublicPosts(options: {
    category?: string;
    q?: string;
    skip: number;
    take: number;
  }) {
    const where: Prisma.ForumPostWhereInput = {
      deletedAt: null,
      ...(options.category ? { category: options.category } : {}),
      ...(options.q
        ? { OR: [{ title: { contains: options.q } }, { body: { contains: options.q } }] }
        : {}),
    };
    const db = getDb();
    const [items, total] = await Promise.all([
      db.forumPost.findMany({
        where,
        include: forumPostInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: options.skip,
        take: options.take,
      }),
      db.forumPost.count({ where }),
    ]);
    return { items, total };
  },

  async listPostsByAuthor(authorId: string, options: { skip: number; take: number }) {
    const where = { authorId, deletedAt: null };
    const db = getDb();
    const [items, total] = await Promise.all([
      db.forumPost.findMany({
        where,
        include: forumPostInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: options.skip,
        take: options.take,
      }),
      db.forumPost.count({ where }),
    ]);
    return { items, total };
  },

  async findPostById(id: string) {
    return getDb().forumPost.findUnique({ where: { id }, include: forumPostInclude });
  },

  async findPostByKey(authorId: string, createRequestKey: string) {
    return getDb().forumPost.findUnique({
      where: { authorId_createRequestKey: { authorId, createRequestKey } },
      include: forumPostInclude,
    });
  },

  async createPost(input: ForumPostDraft & { id: string; authorId: string; now: Date }) {
    return getDb().forumPost.create({
      data: {
        id: input.id,
        authorId: input.authorId,
        category: input.category,
        title: input.title,
        body: input.body,
        createRequestKey: input.createRequestKey,
        createdAt: input.now,
        updatedAt: input.now,
      },
      include: forumPostInclude,
    });
  },

  /** 帖子与其全部评论、图片在同一事务软删；删除竞争由事务内父帖复核处理。 */
  async softDeletePost(
    id: string,
    actor: { userId: string; moderator: boolean },
    now: Date,
  ): Promise<"deleted" | "not-found" | "forbidden"> {
    return inSerializableTransaction(async (tx) => {
      const post = await tx.forumPost.findUnique({ where: { id } });
      if (!post || post.deletedAt) return "not-found" as const;
      if (post.authorId !== actor.userId && !actor.moderator) return "forbidden" as const;
      const updated = await tx.forumPost.updateMany({
        where: { id, deletedAt: null },
        data: { deletedAt: now, updatedAt: now },
      });
      if (updated.count !== 1) return "not-found" as const;
      await tx.forumComment.updateMany({
        where: { postId: id, deletedAt: null },
        data: { deletedAt: now },
      });
      await tx.forumPostImage.updateMany({
        where: { postId: id, deletedAt: null },
        data: { deletedAt: now },
      });
      return "deleted" as const;
    });
  },

  async listComments(postId: string, options: { skip: number; take: number }) {
    const where = { postId, deletedAt: null };
    const db = getDb();
    const [items, total] = await Promise.all([
      db.forumComment.findMany({
        where,
        include: forumCommentInclude,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: options.skip,
        take: options.take,
      }),
      db.forumComment.count({ where }),
    ]);
    return { items, total };
  },

  async findCommentByKey(authorId: string, createRequestKey: string) {
    return getDb().forumComment.findUnique({
      where: { authorId_createRequestKey: { authorId, createRequestKey } },
      include: forumCommentInclude,
    });
  },

  async findCommentById(id: string) {
    return getDb().forumComment.findUnique({ where: { id }, include: forumCommentInclude });
  },

  /** 评论创建先查幂等键，再在同事务复核父帖有效，防止与删帖竞争后新增评论。 */
  async createComment(input: {
    id: string;
    postId: string;
    authorId: string;
    body: string;
    createRequestKey: string;
    now: Date;
  }): Promise<
    | { outcome: "created"; comment: ForumCommentRow }
    | { outcome: "replayed"; comment: ForumCommentRow }
    | { outcome: "post-not-found" }
    | { outcome: "comment-not-found" }
  > {
    return inSerializableTransaction(async (tx) => {
      const existing = await tx.forumComment.findUnique({
        where: {
          authorId_createRequestKey: {
            authorId: input.authorId,
            createRequestKey: input.createRequestKey,
          },
        },
        include: forumCommentInclude,
      });
      if (existing?.deletedAt) return { outcome: "comment-not-found" as const };
      const post = await tx.forumPost.findUnique({ where: { id: input.postId } });
      if (!post || post.deletedAt) return { outcome: "post-not-found" as const };
      if (existing) return { outcome: "replayed" as const, comment: existing };
      const comment = await tx.forumComment.create({
        data: {
          id: input.id,
          postId: input.postId,
          authorId: input.authorId,
          body: input.body,
          createRequestKey: input.createRequestKey,
          createdAt: input.now,
        },
        include: forumCommentInclude,
      });
      return { outcome: "created" as const, comment };
    });
  },

  async softDeleteComment(
    id: string,
    actor: { userId: string; moderator: boolean },
    now: Date,
  ): Promise<"deleted" | "not-found" | "forbidden"> {
    return inSerializableTransaction(async (tx) => {
      const comment = await tx.forumComment.findUnique({ where: { id } });
      if (!comment || comment.deletedAt) return "not-found" as const;
      if (comment.authorId !== actor.userId && !actor.moderator) return "forbidden" as const;
      const result = await tx.forumComment.updateMany({
        where: { id, deletedAt: null },
        data: { deletedAt: now },
      });
      return result.count === 1 ? ("deleted" as const) : ("not-found" as const);
    });
  },

  async countPostImages(postId: string): Promise<number> {
    return getDb().forumPostImage.count({ where: { postId, deletedAt: null } });
  },

  /**
   * 上传行、幂等复核、父帖归属/删除态和图片配额在同一串行事务处理。
   * 同键同摘要复用旧行，并告知服务层删除本次多写的文件；同键不同摘要整体冲突。
   */
  async createPostImages(input: {
    postId: string;
    authorId: string;
    maxFiles: number;
    rows: Array<{
      id: string;
      storageKey: string;
      mimeType: string;
      sizeBytes: number;
      sha256Digest: Uint8Array<ArrayBuffer>;
      uploadKey: string;
      now: Date;
    }>;
  }): Promise<
    | { outcome: "created"; images: ForumPostImageRow[]; discardStorageKeys: string[] }
    | { outcome: "post-not-found" }
    | { outcome: "forbidden" }
    | { outcome: "limit-exceeded" }
    | { outcome: "idempotency-conflict" }
  > {
    return inSerializableTransaction(async (tx) => {
      const post = await tx.forumPost.findUnique({ where: { id: input.postId } });
      if (!post || post.deletedAt) return { outcome: "post-not-found" as const };
      if (post.authorId !== input.authorId) return { outcome: "forbidden" as const };

      const images: ForumPostImageRow[] = [];
      const pending: typeof input.rows = [];
      const discardStorageKeys: string[] = [];
      for (const row of input.rows) {
        const existing = await tx.forumPostImage.findUnique({
          where: { postId_uploadKey: { postId: input.postId, uploadKey: row.uploadKey } },
        });
        if (existing) {
          if (existing.deletedAt || !sameDigest(existing.sha256Digest, row.sha256Digest))
            return { outcome: "idempotency-conflict" as const };
          images.push({ id: existing.id, sortOrder: existing.sortOrder });
          discardStorageKeys.push(row.storageKey);
        } else {
          pending.push(row);
          images.push({ id: row.id, sortOrder: -1 });
        }
      }

      const existingCount = await tx.forumPostImage.count({
        where: { postId: input.postId, deletedAt: null },
      });
      if (existingCount + pending.length > input.maxFiles)
        return { outcome: "limit-exceeded" as const };
      const aggregate = await tx.forumPostImage.aggregate({
        where: { postId: input.postId },
        _max: { sortOrder: true },
      });
      let nextSortOrder = (aggregate._max.sortOrder ?? -1) + 1;
      const created = new Map<string, ForumPostImageRow>();
      for (const row of pending) {
        const image = await tx.forumPostImage.create({
          data: {
            id: row.id,
            postId: input.postId,
            storageKey: row.storageKey,
            mimeType: row.mimeType,
            sizeBytes: row.sizeBytes,
            sha256Digest: row.sha256Digest,
            uploadKey: row.uploadKey,
            sortOrder: nextSortOrder,
            createdAt: row.now,
          },
          select: { id: true, sortOrder: true },
        });
        created.set(row.id, image);
        nextSortOrder += 1;
      }
      return {
        outcome: "created" as const,
        images: images.map((image) => created.get(image.id) ?? image),
        discardStorageKeys,
      };
    });
  },

  async findPostImageById(id: string) {
    return getDb().forumPostImage.findUnique({ where: { id } });
  },

  /** 内容读取同时校验图片和父帖删除态，且不会读取其它业务的资源表。 */
  async findReadableImage(id: string) {
    return getDb().forumPostImage.findFirst({
      where: { id, deletedAt: null, post: { deletedAt: null } },
    });
  },
};
