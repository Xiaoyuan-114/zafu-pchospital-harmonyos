import { paginationMeta } from "@/lib/api/pagination";
import { AppError } from "@/lib/api/errors";
import { requirePermission } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db/client";
import { inSerializableTransaction } from "@/lib/db/transaction";
import { repairRepository } from "@/features/repairs/repair-repository";
import { toNotificationView } from "./community-view";
import type {
  NotificationListResult,
  NotificationServiceContract,
  NotificationView,
} from "@/types/contracts";
import { MEMBER_DASHBOARD_NOTIFICATION_LIMIT } from "@/types/contracts";

const notificationInclude = {
  actor: { include: { user: { select: { displayName: true } } } },
  record: { select: { content: true } },
} as const;

function notFound(): never {
  throw new AppError("NOTIFICATION_NOT_FOUND", "通知不存在");
}

export const notificationService: NotificationServiceContract = {
  async list(input, actor): Promise<NotificationListResult> {
    requirePermission(actor, "notification:read");
    const self = await repairRepository.activeMemberForUser(actor.userId);
    const where = {
      recipientMemberProfileId: self.id,
      deletedAt: null,
      status: input.status,
    };
    const [total, unreadCount, rows] = await Promise.all([
      getDb().notification.count({ where }),
      getDb().notification.count({
        where: { recipientMemberProfileId: self.id, deletedAt: null, status: "UNREAD" },
      }),
      getDb().notification.findMany({
        where,
        include: notificationInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
    ]);
    return {
      items: rows.map(toNotificationView),
      unreadCount,
      pagination: paginationMeta(input, total),
    };
  },

  async markRead(notificationId, actor): Promise<NotificationView> {
    requirePermission(actor, "notification:read");
    const self = await repairRepository.activeMemberForUser(actor.userId);
    const now = new Date();
    const row = await inSerializableTransaction(async (tx) => {
      const current = await tx.notification.findFirst({
        where: { id: notificationId, recipientMemberProfileId: self.id, deletedAt: null },
      });
      if (!current) notFound();
      if (current.status === "READ") {
        return tx.notification.findUniqueOrThrow({
          where: { id: current.id },
          include: notificationInclude,
        });
      }
      return tx.notification.update({
        where: { id: current.id },
        data: { status: "READ", readAt: now },
        include: notificationInclude,
      });
    });
    return toNotificationView(row);
  },

  async markAllRead(actor) {
    requirePermission(actor, "notification:read");
    const self = await repairRepository.activeMemberForUser(actor.userId);
    const now = new Date();
    const updated = await getDb().notification.updateMany({
      where: { recipientMemberProfileId: self.id, deletedAt: null, status: "UNREAD" },
      data: { status: "READ", readAt: now },
    });
    return { updatedCount: updated.count };
  },

  async softDelete(notificationId, actor): Promise<void> {
    requirePermission(actor, "notification:read");
    const self = await repairRepository.activeMemberForUser(actor.userId);
    const now = new Date();
    const updated = await getDb().notification.updateMany({
      where: { id: notificationId, recipientMemberProfileId: self.id, deletedAt: null },
      data: { deletedAt: now },
    });
    if (updated.count !== 1) notFound();
  },
};

export async function summarizeNotifications(memberProfileId: string) {
  const where = { recipientMemberProfileId: memberProfileId, deletedAt: null };
  const [unreadCount, latest] = await Promise.all([
    getDb().notification.count({ where: { ...where, status: "UNREAD" } }),
    getDb().notification.findMany({
      where,
      include: notificationInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: MEMBER_DASHBOARD_NOTIFICATION_LIMIT,
    }),
  ]);
  return { unreadCount, latest: latest.map(toNotificationView) };
}
