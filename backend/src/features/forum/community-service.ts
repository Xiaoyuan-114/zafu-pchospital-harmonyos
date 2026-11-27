import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/api/errors";
import { paginationMeta } from "@/lib/api/pagination";
import { requirePermission } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db/client";
import { inSerializableTransaction } from "@/lib/db/transaction";
import type { AuthorizedActor, PaginationInput } from "@/types/contracts";
import { forumUserId } from "./forum-policy";
import { forumDisplayName } from "./forum-view";

export const publicUserSelect = {
  id: true, displayName: true,
  customerProfile: { select: { nickname: true } },
  memberProfile: { select: { nickname: true } },
} satisfies Prisma.UserSelect;

function activeUser(id: string) {
  return getDb().user.findFirst({ where: { id, status: "ACTIVE", deletedAt: null }, select: publicUserSelect });
}

export const communityService = {
  async following(actor: AuthorizedActor, pagination: PaginationInput) {
    const where = { userId: forumUserId(actor), target: { status: "ACTIVE", deletedAt: null } };
    const [items, total] = await Promise.all([
      getDb().forumFollow.findMany({ where, include: { target: { select: publicUserSelect } },
        orderBy: [{ createdAt: "desc" }, { targetId: "desc" }],
        skip: (pagination.page - 1) * pagination.pageSize, take: pagination.pageSize }),
      getDb().forumFollow.count({ where }),
    ]);
    return { items: items.map(row => ({ id: row.targetId, displayName: forumDisplayName(row.target), following: true })),
      pagination: paginationMeta(pagination, total) };
  },

  async follow(targetId: string, followed: boolean, actor: AuthorizedActor) {
    const userId = forumUserId(actor);
    if (userId === targetId) throw new AppError("VALIDATION_FAILED", "不能关注自己");
    if (!await activeUser(targetId)) throw new AppError("RESOURCE_NOT_FOUND", "用户不存在");
    if (followed) await getDb().forumFollow.upsert({
      where: { userId_targetId: { userId, targetId } }, update: {}, create: { userId, targetId },
    });
    else await getDb().forumFollow.deleteMany({ where: { userId, targetId } });
    return { id: targetId, following: followed };
  },

  async circle(id: string, actor: AuthorizedActor | null) {
    const row = await getDb().forumCircle.findUnique({ where: { id }, include: {
      _count: { select: { memberships: { where: { user: { status: "ACTIVE", deletedAt: null } } },
        posts: { where: { deletedAt: null } } } },
      memberships: { where: { userId: actor?.userId ?? "" }, select: { userId: true } },
    } });
    if (!row) throw new AppError("RESOURCE_NOT_FOUND", "圈子不存在");
    return { id: row.id, name: row.name, description: row.description, category: row.category,
      coverUrl: row.coverUrl, archived: row.archived, joined: row.memberships.length > 0,
      memberCount: row._count.memberships, postCount: row._count.posts,
      canManage: Boolean(actor?.permissions.includes("forum.circle:manage")),
      canPost: !row.archived && row.memberships.length > 0 };
  },

  async circles(actor: AuthorizedActor | null, pagination: PaginationInput, joined = false) {
    if (joined && !actor) throw new AppError("UNAUTHENTICATED", "请先登录查看已加入圈子");
    const where: Prisma.ForumCircleWhereInput = joined
      ? { memberships: { some: { userId: forumUserId(actor!) } } } : {};
    const [rows, total] = await Promise.all([
      getDb().forumCircle.findMany({ where, orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: (pagination.page - 1) * pagination.pageSize, take: pagination.pageSize, select: { id: true } }),
      getDb().forumCircle.count({ where }),
    ]);
    return { items: await Promise.all(rows.map(row => this.circle(row.id, actor))),
      pagination: paginationMeta(pagination, total) };
  },

  async join(circleId: string, joined: boolean, actor: AuthorizedActor) {
    const userId = forumUserId(actor);
    await inSerializableTransaction(async tx => {
      await tx.$queryRaw`SELECT id FROM forum_circles WHERE id = ${circleId} FOR UPDATE`;
      const circle = await tx.forumCircle.findUnique({ where: { id: circleId } });
      if (!circle) throw new AppError("RESOURCE_NOT_FOUND", "圈子不存在");
      if (joined && circle.archived) throw new AppError("STATE_TRANSITION_INVALID", "圈子已归档");
      if (joined) await tx.forumCircleMembership.upsert({
        where: { userId_circleId: { userId, circleId } }, update: {}, create: { userId, circleId },
      });
      else await tx.forumCircleMembership.deleteMany({ where: { userId, circleId } });
    });
    return this.circle(circleId, actor);
  },

  async saveCircle(id: string | null, input: Record<string, unknown>, actor: AuthorizedActor) {
    requirePermission(actor, "forum.circle:manage");
    const text = (key: string, max: number) => {
      if (typeof input[key] !== "string" || !(input[key] as string).trim() || (input[key] as string).trim().length > max)
        throw new AppError("VALIDATION_FAILED", key + " 必填且不能超过 " + max + " 字");
      return (input[key] as string).trim();
    };
    const coverUrl = typeof input.coverUrl === "string" ? input.coverUrl.trim() || null : null;
    if (coverUrl && (coverUrl.length > 1000 || !/^https:\/\//i.test(coverUrl)))
      throw new AppError("VALIDATION_FAILED", "封面需为 HTTPS 图片地址");
    if (input.archived !== undefined && typeof input.archived !== "boolean")
      throw new AppError("VALIDATION_FAILED", "archived 必须为布尔值");
    const data = { name: text("name", 60), description: text("description", 1000),
      category: text("category", 40), coverUrl, archived: input.archived === true };
    const userId = forumUserId(actor);
    const circleId = await inSerializableTransaction(async tx => {
      if (id) {
        await tx.$queryRaw`SELECT id FROM forum_circles WHERE id = ${id} FOR UPDATE`;
        if (!await tx.forumCircle.findUnique({ where: { id } })) throw new AppError("RESOURCE_NOT_FOUND", "圈子不存在");
        await tx.forumCircle.update({ where: { id }, data });
        return id;
      }
      const key = text("createRequestKey", 128);
      const existing = await tx.forumCircle.findUnique({ where: { createdBy_createRequestKey: { createdBy: userId, createRequestKey: key } } });
      if (existing) {
        if (Object.entries(data).some(([key, value]) => existing[key as keyof typeof existing] !== value))
          throw new AppError("IDEMPOTENCY_CONFLICT", "本次创建键已用于其他圈子内容");
        return existing.id;
      }
      return (await tx.forumCircle.create({ data: { ...data, id: randomUUID(), createdBy: userId, createRequestKey: key } })).id;
    });
    return this.circle(circleId, actor);
  },
};
