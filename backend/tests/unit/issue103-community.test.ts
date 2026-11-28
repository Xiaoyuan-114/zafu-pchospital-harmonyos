import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  checkInReward,
  communityPoints,
  shanghaiDay,
} from "../../src/features/forum/community-points";
import { communityService } from "../../src/features/forum/community-service";
import { forumPostListQuery } from "../../src/features/forum/forum-http";
import { AppError } from "../../src/lib/api/errors";
import { getDb } from "../../src/lib/db/client";
import type { AuthorizedActor } from "../../src/types/contracts";

const actor: AuthorizedActor = {
  requestId: "community-unit",
  actorType: "USER",
  userId: randomUUID(),
  userStatus: "ACTIVE",
  permissions: ["forum.circle:manage"],
};

async function withDatabase(database: unknown, operation: () => Promise<void>) {
  const state = globalThis as typeof globalThis & { __pcHospitalDb?: ReturnType<typeof getDb> };
  const previous = state.__pcHospitalDb;
  state.__pcHospitalDb = database as ReturnType<typeof getDb>;
  try {
    await operation();
  } finally {
    state.__pcHospitalDb = previous;
  }
}

test("打卡使用上海午夜边界，跨月和跨年保持日历日", () => {
  for (const [instant, day] of [
    ["2026-11-27T15:59:59.999Z", "2026-11-27"],
    ["2026-11-27T16:00:00.000Z", "2026-11-28"],
    ["2026-11-30T16:00:00.000Z", "2026-12-01"],
    ["2026-12-31T16:00:00.000Z", "2027-01-01"],
  ])
    assert.equal(shanghaiDay(new Date(instant)).toISOString(), day + "T00:00:00.000Z");
});

test("连续打卡每七天循环奖励", () => {
  assert.deepEqual(
    Array.from({ length: 15 }, (_, i) => checkInReward(i + 1)),
    [1, 1, 1, 2, 2, 2, 3, 1, 1, 1, 2, 2, 2, 3, 1],
  );
});

test("打卡状态保留当天或昨天连续天数，中断归零", async () => {
  for (const [lastDay, checkedIn, streak, nextReward] of [
    ["2026-11-28", true, 7, 3],
    ["2026-11-27", false, 7, 1],
    ["2026-11-26", false, 0, 1],
    [null, false, 0, 1],
  ] as const) {
    await withDatabase(
      {
        communityDailyCheckIn: {
          findFirst: async () => (lastDay ? { day: new Date(lastDay), streak: 7 } : null),
        },
        communityPointEntry: { aggregate: async () => ({ _sum: { amount: null } }) },
      },
      async () => {
        const status = await communityPoints.status(actor, new Date("2026-11-27T16:00:00Z"));
        assert.deepEqual(
          { checkedIn: status.checkedIn, streak: status.streak, nextReward: status.nextReward },
          { checkedIn, streak, nextReward },
        );
        assert.equal(status.points, 0);
        assert.equal(status.nextDayAt, "2026-11-28T16:00:00.000Z");
      },
    );
  }
});

test("帖子列表默认频道与排序，解析圈子和搜索条件", () => {
  assert.deepEqual(forumPostListQuery(new URLSearchParams()), {
    channel: "recommended",
    sort: "latest",
  });
  const circleId = randomUUID();
  assert.deepEqual(
    forumPostListQuery(
      new URLSearchParams({
        channel: "following",
        sort: "hot",
        circleId: ` ${circleId} `,
        category: " question ",
        q: " 开机  故障 ",
      }),
    ),
    { channel: "following", sort: "hot", circleId, category: "QUESTION", q: "开机 故障" },
  );
  for (const query of [
    "channel=unknown",
    "sort=popular",
    "circleId=bad",
    "category=unknown",
    "q=" + "x".repeat(61),
  ]) {
    assert.throws(
      () => forumPostListQuery(new URLSearchParams(query)),
      (error) => error instanceof AppError && error.code === "VALIDATION_FAILED",
    );
  }
});

test("圈子创建唯一冲突按原键重放，内容冲突和其他数据库错误继续返回错误", async () => {
  const input = {
    name: "测试圈子",
    description: "测试说明",
    category: "电脑",
    createRequestKey: "unit-key",
  };
  const existing = {
    ...input,
    id: randomUUID(),
    coverUrl: null,
    archived: false,
    memberships: [],
    _count: { memberships: 0, posts: 0 },
  };
  const uniqueError = Object.assign(new Error("unique conflict"), { code: "P2002" });
  const database = {
    $transaction: async () => {
      throw uniqueError;
    },
    forumCircle: { findUnique: async () => existing },
  };
  await withDatabase(database, async () => {
    assert.equal((await communityService.saveCircle(null, input, actor)).id, existing.id);
    await assert.rejects(
      communityService.saveCircle(null, { ...input, name: "另一个圈子" }, actor),
      (error) => error instanceof AppError && error.code === "IDEMPOTENCY_CONFLICT",
    );
  });
  await withDatabase({ ...database, forumCircle: { findUnique: async () => null } }, async () => {
    await assert.rejects(
      communityService.saveCircle(null, input, actor),
      (error) => error === uniqueError,
    );
  });
  const otherError = new Error("connection lost");
  await withDatabase(
    {
      ...database,
      $transaction: async () => {
        throw otherError;
      },
    },
    async () => {
      await assert.rejects(
        communityService.saveCircle(null, input, actor),
        (error) => error === otherError,
      );
    },
  );
});
