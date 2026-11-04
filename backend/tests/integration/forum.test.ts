import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";

import { DELETE as deleteComment } from "../../src/app/api/v1/forum/comments/[id]/route";
import { GET as readForumImage } from "../../src/app/api/v1/forum/images/[imageId]/content/route";
import { GET as listMyPosts } from "../../src/app/api/v1/forum/me/posts/route";
import { DELETE as deletePost, GET as getPost } from "../../src/app/api/v1/forum/posts/[id]/route";
import { GET as listComments, POST as createComment } from "../../src/app/api/v1/forum/posts/[id]/comments/route";
import { POST as uploadImages } from "../../src/app/api/v1/forum/posts/[id]/images/route";
import { GET as listPosts, POST as createPost } from "../../src/app/api/v1/forum/posts/route";
import { localForumImageStorage } from "../../src/features/forum/forum-image-storage";
import { disconnectDb, getDb } from "../../src/lib/db/client";
import { digestSessionToken } from "../../src/lib/security/secrets";
import type { RoleCode } from "../../src/types/contracts";
import { integrationTestsEnabled } from "./db-guard";
import { callRoute } from "./http-harness";

const enabled = integrationTestsEnabled();
const dbTest = enabled ? test : test.skip;
const AUTHOR_ID = "c1000000-0000-4000-8000-000000000085";
const OTHER_ID = "c2000000-0000-4000-8000-000000000085";
const MEMBER_ID = "c3000000-0000-4000-8000-000000000085";
const ADMIN_ID = "c4000000-0000-4000-8000-000000000085";
const USER_IDS = [AUTHOR_ID, OTHER_ID, MEMBER_ID, ADMIN_ID];
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);

type Json = Record<string, unknown>;
type Envelope = {
  data?: unknown;
  error?: { code?: string; fieldErrors?: Record<string, string[]> };
  meta?: { pagination?: { total?: number; page?: number; pageSize?: number } };
};
function dataOf(json: Json): Json {
  return ((json as Envelope).data ?? {}) as Json;
}
function listOf(json: Json): Json[] {
  const data = (json as Envelope).data;
  assert.ok(Array.isArray(data));
  return data as Json[];
}
function errorCode(json: Json): string | undefined {
  return (json as Envelope).error?.code;
}

async function cleanup() {
  const db = getDb();
  const images = await db.forumPostImage.findMany({
    where: { post: { authorId: { in: USER_IDS } } },
    select: { storageKey: true },
  });
  await Promise.allSettled(images.map((image) => localForumImageStorage.delete(image.storageKey)));
  await db.forumPostImage.deleteMany({ where: { post: { authorId: { in: USER_IDS } } } });
  await db.forumComment.deleteMany({ where: { authorId: { in: USER_IDS } } });
  await db.forumPost.deleteMany({ where: { authorId: { in: USER_IDS } } });
  await db.repairPhoto.deleteMany({ where: { uploadedByUserId: MEMBER_ID } });
  await db.repairRecord.deleteMany({ where: { memberProfile: { userId: MEMBER_ID } } });
  await db.authSession.deleteMany({ where: { userId: { in: USER_IDS } } });
  await db.passwordCredential.deleteMany({ where: { userId: { in: USER_IDS } } });
  await db.userRole.deleteMany({ where: { userId: { in: USER_IDS } } });
  await db.memberProfile.deleteMany({ where: { userId: { in: USER_IDS } } });
  await db.user.deleteMany({ where: { id: { in: USER_IDS } } });
}

before(async () => {
  if (!enabled) return;
  await cleanup();
  const db = getDb();
  const now = new Date();
  for (const [id, displayName] of [
    [AUTHOR_ID, "作者账号"],
    [OTHER_ID, "同学账号"],
    [MEMBER_ID, "成员账号"],
    [ADMIN_ID, "纯管理员"],
  ] as const)
    await db.user.create({ data: { id, displayName, status: "ACTIVE", createdAt: now, updatedAt: now } });
  await grantRole(MEMBER_ID, "MEMBER");
  await grantRole(ADMIN_ID, "ADMIN");
  // 纯 ADMIN 刻意不建 MemberProfile；MEMBER 档案含敏感字段，用于检查公开 DTO 不泄露。
  await db.memberProfile.create({
    data: {
      id: randomUUID(), userId: MEMBER_ID, realName: "内部真实姓名", studentId: "20269999",
      nickname: "成员公开昵称", status: "ACTIVE", joinedAt: now, createdAt: now, updatedAt: now,
    },
  });
});

after(async () => {
  if (!enabled) return;
  await cleanup();
  await disconnectDb();
});

async function grantRole(userId: string, code: RoleCode) {
  const role = await getDb().role.findUnique({ where: { code } });
  if (!role) throw new Error(`角色 ${code} 不存在，先跑 db:seed:test`);
  const now = new Date();
  await getDb().userRole.create({
    data: {
      id: randomUUID(), userId, roleId: role.id, sourceType: "ADMIN_CREATED", sourceId: userId,
      grantedAt: now, activeKey: `${userId}:${role.id}`,
    },
  });
}

async function bearerFor(userId: string) {
  const db = getDb();
  const now = new Date();
  const raw = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  await db.passwordCredential.upsert({
    where: { userId },
    update: { mustChangePassword: false, passwordChangedAt: now },
    create: {
      userId, passwordHash: "integration-placeholder-hash", mustChangePassword: false,
      passwordChangedAt: now, createdAt: now, updatedAt: now,
    },
  });
  await db.authSession.create({
    data: {
      id: randomUUID(), userId, tokenDigest: digestSessionToken(raw), createdAt: now,
      lastSeenAt: now, expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
    },
  });
  return { authorization: `Bearer ${raw}`, "x-client-type": "native" };
}

function postBody(overrides: Json = {}): Json {
  return {
    category: "GENERAL", title: `论坛测试-${randomUUID()}`, body: "论坛集成测试正文",
    createRequestKey: randomUUID(), ...overrides,
  };
}

async function createPostAs(headers: Record<string, string>, overrides: Json = {}) {
  const response = await callRoute(createPost, "http://localhost/api/v1/forum/posts", {
    method: "POST", headers, body: postBody(overrides),
  });
  assert.equal(response.status, 201, JSON.stringify(response.json));
  return dataOf(response.json);
}

async function upload(
  headers: Record<string, string>, postId: string,
  files: Array<{ bytes: Uint8Array; type: string; key: string }>,
) {
  const form = new FormData();
  for (const item of files) {
    const body = item.bytes.buffer.slice(
      item.bytes.byteOffset,
      item.bytes.byteOffset + item.bytes.byteLength,
    ) as ArrayBuffer;
    form.append("photos", new File([body], `${item.key}.bin`, { type: item.type }));
    form.append("uploadKeys", item.key);
  }
  const response = await uploadImages(
    new Request(`http://localhost/api/v1/forum/posts/${postId}/images`, {
      method: "POST", headers, body: form,
    }),
    { params: Promise.resolve({ id: postId }) },
  );
  return { status: response.status, json: (await response.json()) as Json };
}

dbTest("游客列表分类/正文搜索与稳定分页；作者来自服务端，公开 DTO 不含实名学号", async () => {
  const author = await bearerFor(AUTHOR_ID);
  const member = await bearerFor(MEMBER_ID);
  const marker = randomUUID();
  const first = await createPostAs(author, { title: `${marker}-标题`, category: "QUESTION" });
  const second = await createPostAs(member, { body: `${marker}-正文`, category: "EXPERIENCE" });
  const anonymous = await callRoute(createPost, "http://localhost/api/v1/forum/posts", {
    method: "POST", headers: { "x-client-type": "native" }, body: postBody(),
  });
  assert.equal(anonymous.status, 401);

  const list = await callRoute(
    listPosts,
    `http://localhost/api/v1/forum/posts?q=${marker}&page=1&pageSize=1`,
  );
  assert.equal(list.status, 200);
  assert.equal(listOf(list.json).length, 1);
  assert.equal((list.json as Envelope).meta?.pagination?.total, 2);
  const page2 = await callRoute(
    listPosts,
    `http://localhost/api/v1/forum/posts?q=${marker}&page=2&pageSize=1`,
  );
  assert.notEqual(listOf(list.json)[0].id, listOf(page2.json)[0].id);
  const category = await callRoute(
    listPosts, `http://localhost/api/v1/forum/posts?q=${marker}&category=QUESTION`,
  );
  assert.deepEqual(listOf(category.json).map((item) => item.id), [first.id]);
  const invalid = await callRoute(listPosts, "http://localhost/api/v1/forum/posts?category=OTHER");
  assert.equal(invalid.status, 400);

  const detail = await callRoute(getPost, `http://localhost/api/v1/forum/posts/${second.id}`, {
    params: { id: second.id as string },
  });
  assert.equal((dataOf(detail.json).author as Json).displayName, "成员公开昵称");
  assert.doesNotMatch(JSON.stringify(detail.json), /内部真实姓名|20269999|realName|studentId/);
  assert.equal((dataOf(detail.json).actions as Json).canDelete, false);
  assert.equal(first.author && (first.author as Json).id, AUTHOR_ID);
});

dbTest("帖子与评论幂等：同键同 payload 重放，不同 payload 409，删除不复活", async () => {
  const author = await bearerFor(AUTHOR_ID);
  const key = randomUUID();
  const input = postBody({ createRequestKey: key, title: "幂等原帖" });
  const original = await callRoute(createPost, "http://localhost/api/v1/forum/posts", {
    method: "POST", headers: author, body: input,
  });
  const replay = await callRoute(createPost, "http://localhost/api/v1/forum/posts", {
    method: "POST", headers: author, body: input,
  });
  assert.equal(dataOf(replay.json).id, dataOf(original.json).id);
  const conflict = await callRoute(createPost, "http://localhost/api/v1/forum/posts", {
    method: "POST", headers: author, body: { ...input, body: "不同正文" },
  });
  assert.equal(conflict.status, 409);
  assert.equal(errorCode(conflict.json), "IDEMPOTENCY_CONFLICT");

  const postId = dataOf(original.json).id as string;
  const commentInput = { body: "幂等评论", createRequestKey: randomUUID() };
  const comment = await callRoute(createComment, `http://localhost/api/v1/forum/posts/${postId}/comments`, {
    method: "POST", headers: author, params: { id: postId }, body: commentInput,
  });
  const commentReplay = await callRoute(createComment, `http://localhost/api/v1/forum/posts/${postId}/comments`, {
    method: "POST", headers: author, params: { id: postId }, body: commentInput,
  });
  assert.equal(dataOf(commentReplay.json).id, dataOf(comment.json).id);
  const commentConflict = await callRoute(createComment, `http://localhost/api/v1/forum/posts/${postId}/comments`, {
    method: "POST", headers: author, params: { id: postId },
    body: { ...commentInput, body: "换了内容" },
  });
  assert.equal(commentConflict.status, 409);

  const commentId = dataOf(comment.json).id as string;
  assert.equal((await callRoute(deleteComment, `http://localhost/api/v1/forum/comments/${commentId}`, {
    method: "DELETE", headers: author, params: { id: commentId },
  })).status, 200);
  const deletedCommentReplay = await callRoute(createComment, `http://localhost/api/v1/forum/posts/${postId}/comments`, {
    method: "POST", headers: author, params: { id: postId }, body: commentInput,
  });
  assert.equal(deletedCommentReplay.status, 404);
  assert.equal(errorCode(deletedCommentReplay.json), "FORUM_COMMENT_NOT_FOUND");
  assert.equal(JSON.stringify(deletedCommentReplay.json).includes("幂等评论"), false);

  const parentReplayInput = { body: "父帖删除后不得重放", createRequestKey: randomUUID() };
  assert.equal((await callRoute(createComment, `http://localhost/api/v1/forum/posts/${postId}/comments`, {
    method: "POST", headers: author, params: { id: postId }, body: parentReplayInput,
  })).status, 201);
  assert.equal((await callRoute(deletePost, `http://localhost/api/v1/forum/posts/${postId}`, {
    method: "DELETE", headers: author, params: { id: postId },
  })).status, 200);
  const afterDeleteReplay = await callRoute(createPost, "http://localhost/api/v1/forum/posts", {
    method: "POST", headers: author, body: input,
  });
  assert.equal(afterDeleteReplay.status, 404);
  assert.equal(errorCode(afterDeleteReplay.json), "FORUM_POST_NOT_FOUND");
  assert.equal(JSON.stringify(afterDeleteReplay.json).includes("幂等原帖"), false);
  const afterParentDeleteReplay = await callRoute(createComment, `http://localhost/api/v1/forum/posts/${postId}/comments`, {
    method: "POST", headers: author, params: { id: postId }, body: parentReplayInput,
  });
  assert.equal(afterParentDeleteReplay.status, 404);
  assert.equal(errorCode(afterParentDeleteReplay.json), "FORUM_POST_NOT_FOUND");
  assert.equal(JSON.stringify(afterParentDeleteReplay.json).includes("父帖删除后不得重放"), false);
  assert.equal((await getDb().forumPost.findUnique({ where: { id: postId } }))?.deletedAt !== null, true);
  assert.equal((await callRoute(getPost, `http://localhost/api/v1/forum/posts/${postId}`, {
    params: { id: postId },
  })).status, 404);
});

dbTest("评论真实计数、游客分页、作者/管理员删除边界与重复删除 404", async () => {
  const author = await bearerFor(AUTHOR_ID);
  const other = await bearerFor(OTHER_ID);
  const member = await bearerFor(MEMBER_ID);
  const admin = await bearerFor(ADMIN_ID);
  const post = await createPostAs(author);
  const postId = post.id as string;
  const first = await callRoute(createComment, `http://localhost/api/v1/forum/posts/${postId}/comments`, {
    method: "POST", headers: other, params: { id: postId },
    body: { body: "第一条", createRequestKey: randomUUID() },
  });
  await callRoute(createComment, `http://localhost/api/v1/forum/posts/${postId}/comments`, {
    method: "POST", headers: author, params: { id: postId },
    body: { body: "第二条", createRequestKey: randomUUID() },
  });
  const comments = await callRoute(listComments, `http://localhost/api/v1/forum/posts/${postId}/comments?pageSize=1`, {
    params: { id: postId },
  });
  assert.equal(comments.status, 200);
  assert.equal(listOf(comments.json).length, 1);
  assert.equal((comments.json as Envelope).meta?.pagination?.total, 2);
  const detail = await callRoute(getPost, `http://localhost/api/v1/forum/posts/${postId}`, {
    headers: other, params: { id: postId },
  });
  assert.equal(dataOf(detail.json).commentCount, 2);
  assert.equal((dataOf(detail.json).actions as Json).canComment, true);

  const commentId = dataOf(first.json).id as string;
  for (const headers of [author, member]) {
    const denied = await callRoute(deleteComment, `http://localhost/api/v1/forum/comments/${commentId}`, {
      method: "DELETE", headers, params: { id: commentId },
    });
    assert.equal(denied.status, 403);
  }
  const removed = await callRoute(deleteComment, `http://localhost/api/v1/forum/comments/${commentId}`, {
    method: "DELETE", headers: admin, params: { id: commentId },
  });
  assert.equal(removed.status, 200, "纯 ADMIN 无 MemberProfile 也应可管理");
  assert.equal((await callRoute(deleteComment, `http://localhost/api/v1/forum/comments/${commentId}`, {
    method: "DELETE", headers: admin, params: { id: commentId },
  })).status, 404);
  const after = await callRoute(getPost, `http://localhost/api/v1/forum/posts/${postId}`, {
    params: { id: postId },
  });
  assert.equal(dataOf(after.json).commentCount, 1);
});

dbTest("删帖仅作者或 ADMIN：事务软删评论图片，公开详情/评论/我的列表一致且重复 404", async () => {
  const author = await bearerFor(AUTHOR_ID);
  const other = await bearerFor(OTHER_ID);
  const member = await bearerFor(MEMBER_ID);
  const admin = await bearerFor(ADMIN_ID);
  const post = await createPostAs(author);
  const postId = post.id as string;
  const image = await upload(author, postId, [{ bytes: PNG, type: "image/png", key: randomUUID() }]);
  assert.equal(image.status, 201);
  const imageId = (dataOf(image.json) as unknown as Json[])[0].id as string;
  await callRoute(createComment, `http://localhost/api/v1/forum/posts/${postId}/comments`, {
    method: "POST", headers: other, params: { id: postId },
    body: { body: "随帖删除", createRequestKey: randomUUID() },
  });
  for (const headers of [other, member]) {
    assert.equal((await callRoute(deletePost, `http://localhost/api/v1/forum/posts/${postId}`, {
      method: "DELETE", headers, params: { id: postId },
    })).status, 403);
  }
  assert.equal((await callRoute(deletePost, `http://localhost/api/v1/forum/posts/${postId}`, {
    method: "DELETE", headers: admin, params: { id: postId },
  })).status, 200);
  assert.equal((await callRoute(deletePost, `http://localhost/api/v1/forum/posts/${postId}`, {
    method: "DELETE", headers: admin, params: { id: postId },
  })).status, 404);
  const db = getDb();
  assert.ok((await db.forumComment.findFirst({ where: { postId } }))?.deletedAt);
  assert.ok((await db.forumPostImage.findUnique({ where: { id: imageId } }))?.deletedAt);
  assert.equal((await callRoute(getPost, `http://localhost/api/v1/forum/posts/${postId}`, {
    params: { id: postId },
  })).status, 404);
  assert.equal((await callRoute(listComments, `http://localhost/api/v1/forum/posts/${postId}/comments`, {
    params: { id: postId },
  })).status, 404);
  const content = await readForumImage(new Request(`http://localhost/api/v1/forum/images/${imageId}/content`), {
    params: Promise.resolve({ imageId }),
  });
  assert.equal(content.status, 404, "文件即使仍存在，软删后也绝不能公开读取");
  const mine = await callRoute(listMyPosts, "http://localhost/api/v1/forum/me/posts", { headers: author });
  assert.equal(listOf(mine.json).some((item) => item.id === postId), false);
});

dbTest("图片作者权限、魔数、幂等、no-store/nosniff 与九张配额", async () => {
  const author = await bearerFor(AUTHOR_ID);
  const other = await bearerFor(OTHER_ID);
  const post = await createPostAs(author);
  const postId = post.id as string;
  assert.equal((await upload(other, postId, [{ bytes: PNG, type: "image/png", key: "denied" }])).status, 403);
  const bad = await upload(author, postId, [{ bytes: new Uint8Array([1, 2, 3]), type: "image/png", key: "bad" }]);
  assert.equal(bad.status, 415);
  assert.equal(errorCode(bad.json), "FORUM_IMAGE_TYPE_UNSUPPORTED");

  const first = await upload(author, postId, [{ bytes: PNG, type: "image/png", key: "same-image" }]);
  const replay = await upload(author, postId, [{ bytes: PNG, type: "image/png", key: "same-image" }]);
  assert.equal(first.status, 201);
  assert.deepEqual(dataOf(replay.json), dataOf(first.json));
  const imageId = (dataOf(first.json) as unknown as Json[])[0].id as string;
  const conflict = await upload(author, postId, [{ bytes: JPEG, type: "image/jpeg", key: "same-image" }]);
  assert.equal(conflict.status, 409);
  const duplicateKeys = await upload(author, postId, [
    { bytes: PNG, type: "image/png", key: "duplicate-in-batch" },
    { bytes: PNG, type: "image/png", key: "duplicate-in-batch" },
  ]);
  assert.equal(duplicateKeys.status, 400);
  assert.equal(errorCode(duplicateKeys.json), "VALIDATION_FAILED");
  const malformed = await uploadImages(new Request(`http://localhost/api/v1/forum/posts/${postId}/images`, {
    method: "POST",
    headers: { ...author, "content-type": "multipart/form-data; boundary=broken" },
    body: "not-a-multipart-body",
  }), { params: Promise.resolve({ id: postId }) });
  assert.equal(malformed.status, 400);
  assert.equal(errorCode((await malformed.json()) as Json), "VALIDATION_FAILED");
  const content = await readForumImage(new Request(`http://localhost/api/v1/forum/images/${imageId}/content`), {
    params: Promise.resolve({ imageId }),
  });
  assert.equal(content.status, 200);
  assert.equal(content.headers.get("x-content-type-options"), "nosniff");
  assert.equal(content.headers.get("cache-control"), "private, no-store");

  const quotaPost = await createPostAs(author);
  const over = await upload(author, quotaPost.id as string, Array.from({ length: 10 }, (_, index) => ({
    bytes: PNG, type: "image/png", key: `over-${index}`,
  })));
  assert.equal(over.status, 400);
  assert.equal(errorCode(over.json), "FORUM_IMAGE_LIMIT_EXCEEDED");
});

dbTest("图片并发配额事务内复核：8 张后两次上传只成功一次且无孤儿行", async () => {
  const author = await bearerFor(AUTHOR_ID);
  const post = await createPostAs(author);
  const postId = post.id as string;
  const seeded = await upload(author, postId, Array.from({ length: 8 }, (_, index) => ({
    bytes: PNG, type: "image/png", key: `seed-${index}`,
  })));
  assert.equal(seeded.status, 201);
  const results = await Promise.all([
    upload(author, postId, [{ bytes: PNG, type: "image/png", key: "race-a" }]),
    upload(author, postId, [{ bytes: PNG, type: "image/png", key: "race-b" }]),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort((a, b) => a - b), [201, 400]);
  assert.equal(await getDb().forumPostImage.count({ where: { postId, deletedAt: null } }), 9);
  assert.equal(await getDb().forumPostImage.count({ where: { postId } }), 9);
});

dbTest("删帖与评论/上传竞争后内容不复活；内部备案照片不能经论坛内容接口读取", async () => {
  const author = await bearerFor(AUTHOR_ID);
  const post = await createPostAs(author);
  const postId = post.id as string;
  const [deleted, commented, uploaded] = await Promise.all([
    callRoute(deletePost, `http://localhost/api/v1/forum/posts/${postId}`, {
      method: "DELETE", headers: author, params: { id: postId },
    }),
    callRoute(createComment, `http://localhost/api/v1/forum/posts/${postId}/comments`, {
      method: "POST", headers: author, params: { id: postId },
      body: { body: "竞争评论", createRequestKey: randomUUID() },
    }),
    upload(author, postId, [{ bytes: PNG, type: "image/png", key: "delete-race" }]),
  ]);
  assert.equal(deleted.status, 200);
  assert.ok([200, 201, 404].includes(commented.status));
  assert.ok([201, 404].includes(uploaded.status));
  assert.ok((await getDb().forumPost.findUnique({ where: { id: postId } }))?.deletedAt);
  assert.equal(await getDb().forumComment.count({ where: { postId, deletedAt: null } }), 0);
  assert.equal(await getDb().forumPostImage.count({ where: { postId, deletedAt: null } }), 0);

  const now = new Date();
  const profile = await getDb().memberProfile.findUniqueOrThrow({ where: { userId: MEMBER_ID } });
  const record = await getDb().repairRecord.create({
    data: {
      id: randomUUID(), memberProfileId: profile.id, status: "DRAFT",
      createRequestKey: randomUUID(), createdAt: now, updatedAt: now,
    },
  });
  const internal = await getDb().repairPhoto.create({
    data: {
      id: randomUUID(), repairRecordId: record.id, storageKey: `repairs/internal-${randomUUID()}.png`,
      mimeType: "image/png", sizeBytes: PNG.length, sha256Digest: Buffer.from(PNG),
      sortOrder: 0, uploadedByUserId: MEMBER_ID, createdAt: now,
    },
  });
  const response = await readForumImage(new Request(`http://localhost/api/v1/forum/images/${internal.id}/content`), {
    params: Promise.resolve({ imageId: internal.id }),
  });
  assert.equal(response.status, 404);
});
