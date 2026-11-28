import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { getDb, disconnectDb } from "../../src/lib/db/client";
import { inSerializableTransaction } from "../../src/lib/db/transaction";
import {
  communityPoints,
  reconcileActivityPoints,
} from "../../src/features/forum/community-points";
import { communityService } from "../../src/features/forum/community-service";
import { forumService } from "../../src/features/forum/forum-service";
import { integrationTestsEnabled } from "./db-guard";
import type { AuthorizedActor } from "../../src/types/contracts";
import { AppError } from "../../src/lib/api/errors";
import { POST as createCircle } from "../../src/app/api/v1/forum/circles/route";
import {
  POST as followUser,
  DELETE as unfollowUser,
} from "../../src/app/api/v1/forum/users/[id]/follow/route";
import { callRoute, sessionCookie } from "./http-harness";
const dbTest = integrationTestsEnabled() ? test : test.skip;
const a = randomUUID(),
  b = randomUUID(),
  activityId = randomUUID();
const actor = (userId: string, admin = false): AuthorizedActor => ({
  requestId: "issue103-test",
  actorType: "USER",
  userId,
  userStatus: "ACTIVE",
  permissions: admin ? ["forum.circle:manage"] : [],
});
let circleId = "";
before(async () => {
  if (!integrationTestsEnabled()) return;
  const now = new Date();
  for (const id of [a, b])
    await getDb().user.create({
      data: { id, status: "ACTIVE", displayName: "课设测试", createdAt: now, updatedAt: now },
    });
});
after(async () => {
  if (!integrationTestsEnabled()) return;
  const db = getDb();
  await db.communityPointEntry.deleteMany({ where: { userId: { in: [a, b] } } });
  await db.communityDailyCheckIn.deleteMany({ where: { userId: { in: [a, b] } } });
  await db.communityActivityReward.deleteMany({ where: { userId: { in: [a, b] } } });
  await db.repairActivityRegistration.deleteMany({ where: { activityId } });
  await db.repairActivity.deleteMany({ where: { id: activityId } });
  await db.forumPost.deleteMany({ where: { authorId: { in: [a, b] } } });
  await db.forumCircleMembership.deleteMany({ where: { userId: { in: [a, b] } } });
  await db.forumFollow.deleteMany({ where: { userId: { in: [a, b] } } });
  await db.forumCircle.deleteMany({ where: { createdBy: a } });
  await db.authSession.deleteMany({ where: { userId: { in: [a, b] } } });
  await db.passwordCredential.deleteMany({ where: { userId: { in: [a, b] } } });
  await db.userRole.deleteMany({ where: { userId: { in: [a, b] } } });
  await db.user.deleteMany({ where: { id: { in: [a, b] } } });
  await disconnectDb();
});

dbTest("圈子并发同键创建重放，同键不同内容返回冲突", async () => {
  const input = {
    name: "并发测试圈",
    description: "测试",
    category: "电脑",
    createRequestKey: randomUUID(),
  };
  const results = await Promise.all(
    Array.from({ length: 4 }, () => communityService.saveCircle(null, input, actor(a, true))),
  );
  assert.equal(new Set(results.map((row) => row.id)).size, 1);
  assert.equal(
    await getDb().forumCircle.count({
      where: { createdBy: a, createRequestKey: input.createRequestKey },
    }),
    1,
  );
  const conflictKey = randomUUID();
  const conflicting = await Promise.allSettled(
    ["甲圈", "乙圈"].map((name) =>
      communityService.saveCircle(
        null,
        { ...input, name, createRequestKey: conflictKey },
        actor(a, true),
      ),
    ),
  );
  assert.equal(conflicting.filter((row) => row.status === "fulfilled").length, 1);
  const rejected = conflicting.find((row) => row.status === "rejected");
  assert.ok(rejected?.status === "rejected" && rejected.reason instanceof AppError);
  assert.equal(rejected.reason.code, "IDEMPOTENCY_CONFLICT");
});

dbTest("圈子批量列表保留计数、本人权限、归档和已加入筛选", async () => {
  const circle = await communityService.saveCircle(
    null,
    { name: "列表测试圈", description: "测试", category: "电脑", createRequestKey: randomUUID() },
    actor(a, true),
  );
  await communityService.join(circle.id, true, actor(a));
  await communityService.join(circle.id, true, actor(b));
  const post = await forumService.create(
    {
      category: "GENERAL",
      title: "列表计数",
      body: "正文",
      circleId: circle.id,
      createRequestKey: randomUUID(),
    },
    actor(a),
  );
  await forumService
    .create(
      {
        category: "GENERAL",
        title: "删除计数",
        body: "正文",
        circleId: circle.id,
        createRequestKey: randomUUID(),
      },
      actor(a),
    )
    .then((row) => forumService.deletePost(row.id, actor(a)));
  const page = { page: 1, pageSize: 100 };
  const listed = (await communityService.circles(actor(a, true), page, true)).items.find(
    (row) => row.id === circle.id,
  );
  assert.deepEqual(listed, await communityService.circle(circle.id, actor(a, true)));
  assert.equal(listed?.memberCount, 2);
  assert.equal(listed?.postCount, 1);
  assert.equal(listed?.canPost, true);
  assert.equal(listed?.canManage, true);
  const guest = (await communityService.circles(null, page)).items.find(
    (row) => row.id === circle.id,
  );
  assert.equal(guest?.joined, false);
  assert.equal(guest?.canPost, false);
  await getDb().user.update({ where: { id: b }, data: { status: "DISABLED" } });
  try {
    assert.equal(
      (await communityService.circles(null, page)).items.find((row) => row.id === circle.id)
        ?.memberCount,
      1,
    );
  } finally {
    await getDb().user.update({ where: { id: b }, data: { status: "ACTIVE" } });
  }
  await communityService.saveCircle(
    circle.id,
    {
      name: circle.name,
      description: circle.description,
      category: circle.category,
      archived: true,
    },
    actor(a, true),
  );
  assert.equal(
    (await communityService.circles(actor(a), page, true)).items.find((row) => row.id === circle.id)
      ?.canPost,
    false,
  );
  assert.equal(
    (await getDb().forumPost.findUnique({ where: { id: post.id } }))?.circleId,
    circle.id,
  );
  await communityService.join(circle.id, false, actor(a));
  await communityService.join(circle.id, false, actor(b));
  assert.ok(
    !(await communityService.circles(actor(a), page, true)).items.some(
      (row) => row.id === circle.id,
    ),
  );
});

dbTest("圈子创建返回 201，关注与取消返回公开昵称和当前状态", async () => {
  const cookie = await sessionCookie(a);
  const input = {
    name: "路由测试圈",
    description: "测试",
    category: "电脑",
    createRequestKey: randomUUID(),
  };
  const created = await callRoute(createCircle, "http://localhost/api/v1/forum/circles", {
    method: "POST",
    headers: { cookie },
    body: input,
  });
  assert.equal(created.status, 201);
  assert.equal(created.headers.get("cache-control"), "private, no-store");
  const replay = await callRoute(createCircle, "http://localhost/api/v1/forum/circles", {
    method: "POST",
    headers: { cookie },
    body: input,
  });
  assert.equal(replay.status, 201);
  assert.equal((replay.json.data as { id: string }).id, (created.json.data as { id: string }).id);
  const conflict = await callRoute(createCircle, "http://localhost/api/v1/forum/circles", {
    method: "POST",
    headers: { cookie },
    body: { ...input, name: "冲突" },
  });
  assert.equal(conflict.status, 409);
  for (const [handler, method, following] of [
    [followUser, "POST", true],
    [unfollowUser, "DELETE", false],
  ] as const) {
    const result = await callRoute(handler, `http://localhost/api/v1/forum/users/${b}/follow`, {
      method,
      headers: { cookie },
      params: { id: b },
    });
    assert.equal(result.status, 200);
    assert.deepEqual(result.json.data, { id: b, displayName: "课设测试", following });
  }
});
dbTest("关注、圈子权限与合并频道去重", async () => {
  const c = await communityService.saveCircle(
    null,
    { name: "测试圈", description: "测试", category: "电脑", createRequestKey: randomUUID() },
    actor(a, true),
  );
  circleId = c.id;
  await assert.rejects(
    communityService.join(circleId, true, actor(a)).then(async () => {
      await communityService.saveCircle(
        null,
        { name: "无权", description: "测试", category: "电脑", createRequestKey: randomUUID() },
        actor(b),
      );
    }),
  );
  await assert.rejects(
    forumService.create(
      {
        category: "GENERAL",
        title: "禁止",
        body: "正文",
        circleId,
        createRequestKey: randomUUID(),
      },
      actor(b),
    ),
  );
  await communityService.join(circleId, true, actor(b));
  await communityService.follow(a, true, actor(b));
  const post = await forumService.create(
    {
      category: "GENERAL",
      title: "测试帖子",
      body: "正文",
      circleId,
      createRequestKey: randomUUID(),
    },
    actor(a),
  );
  const list = await forumService.listPublic(
    { channel: "following" },
    { page: 1, pageSize: 20 },
    actor(b),
  );
  assert.equal(list.items.filter((x) => x.id === post.id).length, 1);
  const hot = await forumService.listPublic(
    { circleId, sort: "hot" },
    { page: 1, pageSize: 20 },
    null,
  );
  assert.ok(hot.items.some((x) => x.id === post.id));
  await communityService.join(circleId, false, actor(b));
  await communityService.follow(a, false, actor(b));
  assert.equal(
    (await forumService.listPublic({ channel: "following" }, { page: 1, pageSize: 20 }, actor(b)))
      .items.length,
    0,
  );
});
dbTest("上海日历日打卡重试、跨日和中断", async () => {
  const t = new Date("2026-11-26T16:00:00Z");
  await Promise.all([communityPoints.checkIn(actor(b), t), communityPoints.checkIn(actor(b), t)]);
  assert.equal((await communityPoints.status(actor(b), t)).points, 1);
  await communityPoints.checkIn(actor(b), new Date("2026-11-27T16:00:00Z"));
  assert.equal(
    (await communityPoints.status(actor(b), new Date("2026-11-27T16:00:00Z"))).streak,
    2,
  );
  assert.equal(
    (await communityPoints.status(actor(b), new Date("2026-11-29T16:00:00Z"))).streak,
    0,
  );
});
dbTest("同账号多条报名，撤回与恢复只记录一次现场积分", async () => {
  const db = getDb(),
    now = new Date();
  await db.repairActivity.create({
    data: {
      id: activityId,
      title: "测试活动",
      activityAt: now,
      signupOpensAt: now,
      signupClosesAt: now,
      capacity: 10,
      createdAt: now,
    },
  });
  const ids = [randomUUID(), randomUUID()];
  for (const [i, id] of ids.entries())
    await db.repairActivityRegistration.create({
      data: {
        id,
        activityId,
        userId: b,
        name: "测试",
        phone: "1000000000" + i,
        phoneLast4: "000" + i,
        issueType: "OTHER",
        status: "CHECKED_IN",
        pointsEligible: true,
        createdAt: now,
      },
    });
  const sync = () =>
    inSerializableTransaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM repair_activities WHERE id = ${activityId} FOR UPDATE`;
      await reconcileActivityPoints(tx, activityId, [b]);
    });
  await sync();
  await sync();
  assert.equal(
    (
      await db.communityPointEntry.aggregate({
        where: { userId: b, source: "ACTIVITY" },
        _sum: { amount: true },
      })
    )._sum.amount,
    10,
  );
  await db.repairActivityRegistration.update({
    where: { id: ids[0] },
    data: { status: "REGISTERED" },
  });
  await sync();
  await db.repairActivityRegistration.update({
    where: { id: ids[1] },
    data: { status: "REGISTERED" },
  });
  await sync();
  assert.equal(
    (
      await db.communityPointEntry.aggregate({
        where: { userId: b, source: "ACTIVITY" },
        _sum: { amount: true },
      })
    )._sum.amount,
    0,
  );
  await db.repairActivityRegistration.update({
    where: { id: ids[0] },
    data: { status: "CHECKED_IN" },
  });
  await sync();
  assert.equal(
    (
      await db.communityPointEntry.aggregate({
        where: { userId: b, source: "ACTIVITY" },
        _sum: { amount: true },
      })
    )._sum.amount,
    10,
  );
});
