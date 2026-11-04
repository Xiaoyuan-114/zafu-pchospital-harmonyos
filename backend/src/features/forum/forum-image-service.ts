import { createHash, randomUUID } from "node:crypto";
import { AppError } from "@/lib/api/errors";
import type { AuthorizedActor } from "@/types/contracts";
import { forumImageMaxBytes, localForumImageStorage, type ForumImageStorage } from "./forum-image-storage";
import { forumRepository, isForumUniqueViolation } from "./forum-repository";
import { forumLimits } from "./forum-validation";
import { toForumImageView } from "./forum-view";
import { forumUserId } from "./forum-policy";

export function detectForumImageType(
  bytes: Uint8Array,
): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])
  )
    return "image/png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}

export type ForumImageRepository = Pick<
  typeof forumRepository,
  "findPostById" | "createPostImages" | "findReadableImage"
>;

export function createForumImageService(
  storage: ForumImageStorage,
  repository: ForumImageRepository = forumRepository,
) {
  return {
    async upload(
      postId: string,
      files: File[],
      uploadKeys: string[],
      actor: AuthorizedActor,
    ) {
      const authorId = forumUserId(actor);
      const post = await repository.findPostById(postId);
      if (!post || post.deletedAt) throw new AppError("FORUM_POST_NOT_FOUND", "帖子不存在");
      if (post.authorId !== authorId) throw new AppError("FORBIDDEN", "只能给自己的帖子上传图片");
      if (!files.length || files.length !== uploadKeys.length)
        throw new AppError("VALIDATION_FAILED", "每张图片必须对应一个 uploadKey");
      if (files.length > forumLimits.maxImagesPerPost)
        throw new AppError("FORUM_IMAGE_LIMIT_EXCEEDED", "每帖最多上传 9 张图片");
      const normalizedKeys = uploadKeys.map((key) => key.trim());
      if (normalizedKeys.some((key) => !key || key.length > forumLimits.requestKeyMaxLength))
        throw new AppError("VALIDATION_FAILED", "uploadKey 必填且不能超过 128 字");
      if (new Set(normalizedKeys).size !== normalizedKeys.length)
        throw new AppError("VALIDATION_FAILED", "同一次上传不能使用重复的 uploadKey", {
          fieldErrors: { uploadKeys: ["不能重复"] },
        });

      const maxBytes = forumImageMaxBytes();
      const prepared = await Promise.all(
        files.map(async (file, index) => {
          if (file.size > maxBytes) throw new AppError("FORUM_IMAGE_TOO_LARGE", "图片超过大小上限");
          const bytes = new Uint8Array(await file.arrayBuffer());
          const mimeType = detectForumImageType(bytes);
          if (!mimeType || mimeType !== file.type)
            throw new AppError("FORUM_IMAGE_TYPE_UNSUPPORTED", "仅支持真实的 JPEG、PNG 或 WebP 图片");
          return {
            bytes,
            mimeType,
            sha256Digest: createHash("sha256").update(bytes).digest(),
            uploadKey: normalizedKeys[index],
          };
        }),
      );

      const stored: Array<{ storageKey: string }> = [];
      try {
        for (const item of prepared) stored.push(await storage.put(item));
        const now = new Date();
        const input = {
          postId,
          authorId,
          maxFiles: forumLimits.maxImagesPerPost,
          rows: prepared.map((item, index) => ({
            id: randomUUID(),
            storageKey: stored[index].storageKey,
            mimeType: item.mimeType,
            sizeBytes: item.bytes.byteLength,
            sha256Digest: item.sha256Digest,
            uploadKey: item.uploadKey,
            now,
          })),
        };
        let result: Awaited<ReturnType<ForumImageRepository["createPostImages"]>>;
        try {
          result = await repository.createPostImages(input);
        } catch (error) {
          // 唯一索引兜底并发同键：输家事务回滚后重读，同图重放，不同图仍 409。
          if (!isForumUniqueViolation(error)) throw error;
          result = await repository.createPostImages(input);
        }
        if (result.outcome === "post-not-found")
          throw new AppError("FORUM_POST_NOT_FOUND", "帖子不存在");
        if (result.outcome === "forbidden")
          throw new AppError("FORBIDDEN", "只能给自己的帖子上传图片");
        if (result.outcome === "limit-exceeded")
          throw new AppError("FORUM_IMAGE_LIMIT_EXCEEDED", "每帖最多上传 9 张图片");
        if (result.outcome === "idempotency-conflict")
          throw new AppError("IDEMPOTENCY_CONFLICT", "uploadKey 已用于其他图片");
        await Promise.allSettled(result.discardStorageKeys.map((key) => storage.delete(key)));
        return result.images.map(toForumImageView);
      } catch (error) {
        await Promise.allSettled(stored.map((entry) => storage.delete(entry.storageKey)));
        if (error instanceof AppError) throw error;
        throw new AppError("FORUM_IMAGE_STORAGE_FAILED", "图片保存失败", { cause: error });
      }
    },

    async open(imageId: string) {
      const image = await repository.findReadableImage(imageId);
      if (!image) throw new AppError("RESOURCE_NOT_FOUND", "图片不存在");
      try {
        const bytes = await storage.open(image.storageKey);
        if (bytes.byteLength !== image.sizeBytes) throw new Error("stored image size mismatch");
        return { image, bytes };
      } catch (error) {
        throw new AppError("FORUM_IMAGE_STORAGE_FAILED", "图片暂时不可读取", { cause: error });
      }
    },
  };
}

export const forumImageService = createForumImageService(localForumImageStorage);
