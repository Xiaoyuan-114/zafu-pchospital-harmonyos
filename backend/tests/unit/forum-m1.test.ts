import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";

import {
  createForumImageService,
  detectForumImageType,
  type ForumImageRepository,
} from "../../src/features/forum/forum-image-service";
import type { ForumImageStorage } from "../../src/features/forum/forum-image-storage";
import { forumDisplayName } from "../../src/features/forum/forum-view";
import { normalizeAndValidateComment, normalizeAndValidatePost } from "../../src/features/forum/forum-validation";
import { AppError } from "../../src/lib/api/errors";
import { permissionsForRoles } from "../../src/lib/auth/permissions";
import type { AuthorizedActor } from "../../src/types/contracts";

const AUTHOR_ID = "forum-author";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);

function actor(permissions: AuthorizedActor["permissions"] = []): AuthorizedActor {
  return { requestId: "forum-unit", actorType: "USER", userId: AUTHOR_ID, userStatus: "ACTIVE", permissions };
}

function file(bytes: Uint8Array, type = "image/png"): File {
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new File([body], "forum-image", { type });
}

function digest(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return createHash("sha256").update(bytes).digest();
}

test("论坛固定分类、正文与幂等键验证", () => {
  const post = normalizeAndValidatePost({
    category: "question",
    title: "  电脑   无法开机 ",
    body: "  按电源没有反应  ",
    createRequestKey: " request-1 ",
  });
  assert.deepEqual(post, {
    category: "QUESTION",
    title: "电脑 无法开机",
    body: "按电源没有反应",
    createRequestKey: "request-1",
  });
  assert.throws(
    () => normalizeAndValidatePost({ ...post, category: "CMS_MANAGED" }),
    (error) => error instanceof AppError && error.code === "VALIDATION_FAILED",
  );
  assert.throws(
    () => normalizeAndValidateComment({ body: "   ", createRequestKey: "comment-1" }),
    AppError,
  );
});

test("forum:moderate 只授予 ADMIN，公开作者不取实名或学号", () => {
  assert.equal(permissionsForRoles(["MEMBER"]).includes("forum:moderate"), false);
  assert.equal(permissionsForRoles(["ADMIN"]).includes("forum:moderate"), true);
  assert.equal(permissionsForRoles([]).includes("forum:moderate"), false);
  const serialized = JSON.stringify({
    displayName: forumDisplayName({
      id: "u1",
      displayName: "账号显示名",
      customerProfile: null,
      memberProfile: { nickname: "公开昵称" },
    }),
  });
  assert.equal(serialized.includes("公开昵称"), true);
  assert.equal(/realName|studentId/.test(serialized), false);
});

test("图片只接受 JPEG/PNG/WebP 魔数", () => {
  assert.equal(detectForumImageType(PNG), "image/png");
  assert.equal(detectForumImageType(JPEG), "image/jpeg");
  assert.equal(detectForumImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])), "image/webp");
  assert.equal(detectForumImageType(new Uint8Array([1, 2, 3])), null);
});

type ImageRow = {
  id: string;
  postId: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  sha256Digest: Uint8Array;
  uploadKey: string;
  sortOrder: number;
  createdAt: Date;
  deletedAt: Date | null;
};

function createImageHarness(seed = 0) {
  const postId = randomUUID();
  const post = { id: postId, authorId: AUTHOR_ID, deletedAt: null as Date | null };
  const images: ImageRow[] = Array.from({ length: seed }, (_, index) => ({
    id: `seed-${index}`,
    postId,
    storageKey: `forum/seed-${index}.png`,
    mimeType: "image/png",
    sizeBytes: PNG.length,
    sha256Digest: digest(PNG),
    uploadKey: `seed-${index}`,
    sortOrder: index,
    createdAt: new Date(),
    deletedAt: null,
  }));
  const live = new Set<string>();
  const opened: string[] = [];
  const storage: ForumImageStorage = {
    async put() {
      const storageKey = `forum/${randomUUID()}.png`;
      live.add(storageKey);
      return { storageKey };
    },
    async open(storageKey) {
      opened.push(storageKey);
      return PNG;
    },
    async delete(storageKey) {
      live.delete(storageKey);
    },
  };
  let chain: Promise<unknown> = Promise.resolve();
  const repository = {
    async findPostById(id: string) {
      return id === postId ? post : null;
    },
    createPostImages(input: Parameters<ForumImageRepository["createPostImages"]>[0]) {
      const run = chain.then(async () => {
        if (post.deletedAt) return { outcome: "post-not-found" as const };
        if (post.authorId !== input.authorId) return { outcome: "forbidden" as const };
        const result: Array<{ id: string; sortOrder: number }> = [];
        const pending: typeof input.rows = [];
        const discardStorageKeys: string[] = [];
        for (const row of input.rows) {
          const existing = images.find((image) => image.uploadKey === row.uploadKey);
          if (existing) {
            if (existing.deletedAt || !existing.sha256Digest.every((v, i) => v === row.sha256Digest[i]))
              return { outcome: "idempotency-conflict" as const };
            result.push({ id: existing.id, sortOrder: existing.sortOrder });
            discardStorageKeys.push(row.storageKey);
          } else {
            pending.push(row);
            result.push({ id: row.id, sortOrder: -1 });
          }
        }
        if (images.filter((image) => !image.deletedAt).length + pending.length > input.maxFiles)
          return { outcome: "limit-exceeded" as const };
        let sortOrder = images.reduce((max, image) => Math.max(max, image.sortOrder), -1) + 1;
        const created = new Map<string, { id: string; sortOrder: number }>();
        for (const row of pending) {
          const image: ImageRow = { ...row, postId, sortOrder: 0, createdAt: row.now, deletedAt: null };
          image.sortOrder = sortOrder++;
          images.push(image);
          created.set(row.id, { id: row.id, sortOrder: image.sortOrder });
        }
        return {
          outcome: "created" as const,
          images: result.map((image) => created.get(image.id) ?? image),
          discardStorageKeys,
        };
      });
      chain = run.then(() => undefined, () => undefined);
      return run;
    },
    async findReadableImage(id: string) {
      const image = images.find((item) => item.id === id);
      return image && !image.deletedAt && !post.deletedAt ? image : null;
    },
  };
  return {
    post,
    postId,
    images,
    live,
    opened,
    service: createForumImageService(storage, repository as unknown as ForumImageRepository),
  };
}

test("图片配额并发：8 张时两个请求只成功一个，失败文件全部清理", async () => {
  const harness = createImageHarness(8);
  const results = await Promise.allSettled([
    harness.service.upload(harness.postId, [file(PNG)], ["quota-a"], actor()),
    harness.service.upload(harness.postId, [file(PNG)], ["quota-b"], actor()),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const failure = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
  assert.ok(failure?.reason instanceof AppError);
  assert.equal(failure.reason.code, "FORUM_IMAGE_LIMIT_EXCEEDED");
  assert.equal(harness.images.filter((image) => !image.deletedAt).length, 9);
  assert.equal(harness.live.size, 1);
});

test("uploadKey 同图重放复用原图并清理新文件，不同图返回 409", async () => {
  const harness = createImageHarness();
  const first = await harness.service.upload(harness.postId, [file(PNG)], ["same-upload"], actor());
  const replay = await harness.service.upload(harness.postId, [file(PNG)], ["same-upload"], actor());
  assert.deepEqual(replay, first);
  assert.equal(harness.images.length, 1);
  assert.equal(harness.live.size, 1);
  await assert.rejects(
    () => harness.service.upload(harness.postId, [file(JPEG, "image/jpeg")], ["same-upload"], actor()),
    (error) => error instanceof AppError && error.code === "IDEMPOTENCY_CONFLICT",
  );
  assert.equal(harness.images.length, 1);
  assert.equal(harness.live.size, 1);
});

test("同批重复 uploadKey 在写存储前返回 400，同图与不同图都不留文件", async () => {
  for (const files of [[file(PNG), file(PNG)], [file(PNG), file(JPEG, "image/jpeg")]]) {
    const harness = createImageHarness();
    await assert.rejects(
      () => harness.service.upload(harness.postId, files, ["duplicate", " duplicate "], actor()),
      (error) => error instanceof AppError && error.code === "VALIDATION_FAILED",
    );
    assert.equal(harness.live.size, 0);
    assert.equal(harness.images.length, 0);
  }
});

test("软删图片与父帖不可公开读取，也不会打开底层内部资源", async () => {
  const harness = createImageHarness();
  const [image] = await harness.service.upload(harness.postId, [file(PNG)], ["read-once"], actor());
  harness.images[0].deletedAt = new Date();
  await assert.rejects(
    () => harness.service.open(image.id),
    (error) => error instanceof AppError && error.code === "RESOURCE_NOT_FOUND",
  );
  assert.equal(harness.opened.length, 0);
  harness.images[0].deletedAt = null;
  harness.post.deletedAt = new Date();
  await assert.rejects(() => harness.service.open(image.id), AppError);
  assert.equal(harness.opened.length, 0);
});
