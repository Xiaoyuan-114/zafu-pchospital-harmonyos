import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db/client";

/** 详情与列表都带上设备名称：客户更认「我的办公本」而不是一串 UUID。 */
const sessionWithDevice = {
  device: { select: { label: true, model: true } },
} satisfies Prisma.DiagnosticSessionInclude;

export type DiagnosticSessionRow = Prisma.DiagnosticSessionGetPayload<{
  include: typeof sessionWithDevice;
}>;

export const diagnosticRepository = {
  async create(data: {
    id: string;
    userId: string;
    deviceId: string | null;
    categoryCode: string;
    answers: Prisma.InputJsonValue;
    outcome: string;
    now: Date;
  }): Promise<DiagnosticSessionRow> {
    return getDb().diagnosticSession.create({
      data: {
        id: data.id,
        userId: data.userId,
        deviceId: data.deviceId,
        categoryCode: data.categoryCode,
        answers: data.answers,
        outcome: data.outcome,
        createdAt: data.now,
      },
      include: sessionWithDevice,
    });
  },

  async listByUser(
    userId: string,
    options: { skip: number; take: number },
  ): Promise<{ items: DiagnosticSessionRow[]; total: number }> {
    const db = getDb();
    const [items, total] = await Promise.all([
      db.diagnosticSession.findMany({
        where: { userId },
        include: sessionWithDevice,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: options.skip,
        take: options.take,
      }),
      db.diagnosticSession.count({ where: { userId } }),
    ]);
    return { items, total };
  },

  async findOwned(id: string, userId: string): Promise<DiagnosticSessionRow | null> {
    return getDb().diagnosticSession.findFirst({ where: { id, userId }, include: sessionWithDevice });
  },
};
