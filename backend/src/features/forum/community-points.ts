import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { paginationMeta } from "@/lib/api/pagination";
import { getDb } from "@/lib/db/client";
import { inSerializableTransaction } from "@/lib/db/transaction";
import type { AuthorizedActor, PaginationInput } from "@/types/contracts";
import { forumUserId } from "./forum-policy";

export const dailyRewards = [1, 1, 1, 2, 2, 2, 3] as const;
export const ACTIVITY_CHECKIN_POINTS = 10;
export function shanghaiDay(now: Date): Date {
  return new Date(
    new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10) + "T00:00:00.000Z",
  );
}
export function checkInReward(streak: number): number {
  return dailyRewards[(streak - 1) % dailyRewards.length];
}
async function lockUser(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
}

/** 调用方已持有活动行锁；与签到、撤回、软删同事务，不从历史签到补发。 */
export async function reconcileActivityPoints(
  tx: Prisma.TransactionClient,
  activityId: string,
  userIds: string[],
) {
  const activity = await tx.repairActivity.findUnique({ where: { id: activityId } });
  for (const userId of [...new Set(userIds)].sort()) {
    await lockUser(tx, userId);
    const previous = await tx.communityActivityReward.findUnique({
      where: { userId_activityId: { userId, activityId } },
    });
    const active =
      !activity?.deletedAt &&
      (await tx.repairActivityRegistration.count({
        where: {
          userId,
          activityId,
          deletedAt: null,
          pointsEligible: true,
          status: { in: ["CHECKED_IN", "SERVED"] },
        },
      })) > 0;
    if (Boolean(previous?.awarded) === Boolean(active)) continue;
    const revision = (previous?.revision ?? 0) + 1;
    await tx.communityActivityReward.upsert({
      where: { userId_activityId: { userId, activityId } },
      create: { userId, activityId, awarded: Boolean(active), revision },
      update: { awarded: Boolean(active), revision },
    });
    await tx.communityPointEntry.create({
      data: {
        id: randomUUID(),
        userId,
        activityId,
        source: "ACTIVITY",
        sourceKey: activityId + ":" + revision,
        amount: active ? ACTIVITY_CHECKIN_POINTS : -ACTIVITY_CHECKIN_POINTS,
        description:
          (active ? "活动现场签到：" : "撤销活动现场积分：") + (activity?.title ?? "活动"),
      },
    });
  }
}

export const communityPoints = {
  async status(actor: AuthorizedActor, now = new Date()) {
    const userId = forumUserId(actor);
    const day = shanghaiDay(now);
    const [last, total] = await Promise.all([
      getDb().communityDailyCheckIn.findFirst({
        where: { userId, day: { lte: day } },
        orderBy: { day: "desc" },
      }),
      getDb().communityPointEntry.aggregate({ where: { userId }, _sum: { amount: true } }),
    ]);
    const checkedIn = last?.day.getTime() === day.getTime();
    const yesterday = day.getTime() - 86400000;
    const streak = last && (checkedIn || last.day.getTime() === yesterday) ? last.streak : 0;
    return {
      day: day.toISOString().slice(0, 10),
      checkedIn,
      streak,
      points: total._sum.amount ?? 0,
      rewards: [...dailyRewards],
      nextReward: checkInReward(checkedIn ? streak : streak + 1),
      nextDayAt: new Date(day.getTime() + 16 * 3600000).toISOString(),
    };
  },
  async checkIn(actor: AuthorizedActor, now = new Date()) {
    const userId = forumUserId(actor);
    const day = shanghaiDay(now);
    await inSerializableTransaction(async (tx) => {
      await lockUser(tx, userId);
      if (await tx.communityDailyCheckIn.findUnique({ where: { userId_day: { userId, day } } }))
        return;
      const previous = await tx.communityDailyCheckIn.findUnique({
        where: { userId_day: { userId, day: new Date(day.getTime() - 86400000) } },
      });
      const streak = (previous?.streak ?? 0) + 1;
      const points = checkInReward(streak);
      await tx.communityDailyCheckIn.create({
        data: { userId, day, streak, points, createdAt: now },
      });
      await tx.communityPointEntry.create({
        data: {
          id: randomUUID(),
          userId,
          source: "DAILY",
          sourceKey: day.toISOString().slice(0, 10),
          amount: points,
          description: "社区每日打卡",
          createdAt: now,
        },
      });
    });
    return this.status(actor, now);
  },
  async entries(actor: AuthorizedActor, pagination: PaginationInput) {
    const where = { userId: forumUserId(actor) };
    const [items, total] = await Promise.all([
      getDb().communityPointEntry.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        select: { id: true, source: true, amount: true, description: true, createdAt: true },
      }),
      getDb().communityPointEntry.count({ where }),
    ]);
    return { items, pagination: paginationMeta(pagination, total) };
  },
};
