import { randomUUID } from "node:crypto";

import { paginationMeta } from "@/lib/api/pagination";
import { AppError } from "@/lib/api/errors";
import { appendAuditLog } from "@/lib/audit/audit-service";
import { requirePermission } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db/client";
import { inSerializableTransaction } from "@/lib/db/transaction";
import { assertCanReadRepair } from "@/features/repairs/repair-policy";
import { repairRepository } from "@/features/repairs/repair-repository";
import { toFavoriteView } from "./community-view";
import type {
  FavoriteListResult,
  FavoriteView,
  RepairFavoriteServiceContract,
} from "@/types/contracts";
import { MEMBER_DASHBOARD_FAVORITE_LIMIT } from "@/types/contracts";

const favoriteInclude = {
  record: {
    include: {
      category: { select: { name: true } },
      memberProfile: { include: { user: { select: { displayName: true } } } },
    },
  },
} as const;

function notFound(): never {
  throw new AppError("FAVORITE_NOT_FOUND", "收藏不存在");
}

export const repairFavoriteService: RepairFavoriteServiceContract = {
  async list(input, actor): Promise<FavoriteListResult> {
    requirePermission(actor, "favorite:manage");
    const self = await repairRepository.activeMemberForUser(actor.userId);
    const where = { memberProfileId: self.id, deletedAt: null };
    const [total, rows] = await Promise.all([
      getDb().repairFavorite.count({ where }),
      getDb().repairFavorite.findMany({
        where,
        include: favoriteInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
    ]);
    return { items: rows.map(toFavoriteView), pagination: paginationMeta(input, total) };
  },

  async add(repairRecordId, actor): Promise<FavoriteView> {
    requirePermission(actor, "favorite:manage");
    const self = await repairRepository.activeMemberForUser(actor.userId);
    const record = await repairRepository.getById(repairRecordId);
    assertCanReadRepair(actor, record);
    const now = new Date();
    const row = await inSerializableTransaction(async (tx) => {
      const existing = await tx.repairFavorite.findUnique({
        where: {
          memberProfileId_repairRecordId: {
            memberProfileId: self.id,
            repairRecordId,
          },
        },
      });
      if (existing && !existing.deletedAt) {
        return tx.repairFavorite.findUniqueOrThrow({
          where: { id: existing.id },
          include: favoriteInclude,
        });
      }
      const saved = existing
        ? await tx.repairFavorite.update({
            where: { id: existing.id },
            data: { deletedAt: null, createdAt: now, updatedAt: now },
            include: favoriteInclude,
          })
        : await tx.repairFavorite.create({
            data: {
              id: randomUUID(),
              memberProfileId: self.id,
              repairRecordId,
              createdAt: now,
            },
            include: favoriteInclude,
          });
      await appendAuditLog(tx, {
        actor,
        actorType: "USER",
        actorUserId: actor.userId,
        action: "repair.favorite.added",
        targetType: "RepairFavorite",
        targetId: saved.id,
        result: "SUCCESS",
        after: { repairRecordId, restored: Boolean(existing) },
      });
      return saved;
    });
    return toFavoriteView(row);
  },

  async remove(repairRecordId, actor): Promise<void> {
    requirePermission(actor, "favorite:manage");
    const self = await repairRepository.activeMemberForUser(actor.userId);
    const now = new Date();
    await inSerializableTransaction(async (tx) => {
      const existing = await tx.repairFavorite.findUnique({
        where: {
          memberProfileId_repairRecordId: {
            memberProfileId: self.id,
            repairRecordId,
          },
        },
      });
      if (!existing || existing.deletedAt) notFound();
      await tx.repairFavorite.update({
        where: { id: existing.id },
        data: { deletedAt: now },
      });
      await appendAuditLog(tx, {
        actor,
        actorType: "USER",
        actorUserId: actor.userId,
        action: "repair.favorite.removed",
        targetType: "RepairFavorite",
        targetId: existing.id,
        result: "SUCCESS",
        after: { repairRecordId, deleted: true },
      });
    });
  },
};

export async function summarizeFavorites(memberProfileId: string) {
  const where = { memberProfileId, deletedAt: null };
  const [count, latest] = await Promise.all([
    getDb().repairFavorite.count({ where }),
    getDb().repairFavorite.findMany({
      where,
      include: favoriteInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: MEMBER_DASHBOARD_FAVORITE_LIMIT,
    }),
  ]);
  return { count, latest: latest.map(toFavoriteView) };
}

export async function isFavorited(memberProfileId: string, repairRecordId: string): Promise<boolean> {
  const row = await getDb().repairFavorite.findFirst({
    where: { memberProfileId, repairRecordId, deletedAt: null },
    select: { id: true },
  });
  return Boolean(row);
}
