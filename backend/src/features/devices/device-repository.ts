import { getDb } from "@/lib/db/client";
import type { Prisma } from "@/generated/prisma/client";

/** 未结束的报修状态：有这些单据的设备不允许解绑。 */
export const deviceBusyOrderStatuses = ["SUBMITTED", "ACCEPTED", "REPAIRING"] as const;

/** 列表与详情共用的关联计数：报修次数用于「N 次报修」。 */
const deviceWithCount = {
  // 计数要过滤软删：`recentOrders` 只列 `deletedAt: null` 的单，
  // 计数不过滤就会出现「5 次报修」但列表只有 4 条。
  _count: { select: { orders: { where: { deletedAt: null } } } },
} satisfies Prisma.CustomerDeviceInclude;

export type DeviceWithCount = Prisma.CustomerDeviceGetPayload<{ include: typeof deviceWithCount }>;

export const deviceRepository = {
  /** 本人设备分页。归属在此处收口，不依赖上层传参正确。 */
  async listByOwner(
    ownerUserId: string,
    options: { skip: number; take: number; status?: string },
  ): Promise<{ items: DeviceWithCount[]; total: number }> {
    // 查历史（`status=RETIRED`）时必须放开软删过滤：解绑是 `deletedAt` 与
    // `status=RETIRED` 同时置位，两个条件互斥，带着 `deletedAt: null` 永远查不到。
    const where: Prisma.CustomerDeviceWhereInput = {
      ownerUserId,
      ...(options.status === "RETIRED" ? {} : { deletedAt: null }),
      ...(options.status ? { status: options.status } : {}),
    };
    const db = getDb();
    const [items, total] = await Promise.all([
      db.customerDevice.findMany({
        where,
        include: deviceWithCount,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: options.skip,
        take: options.take,
      }),
      db.customerDevice.count({ where }),
    ]);
    return { items, total };
  },

  async findById(id: string) {
    return getDb().customerDevice.findUnique({ where: { id }, include: deviceWithCount });
  },

  /**
   * 按「本人 + 序列号」查，**包含已解绑的**。
   *
   * 唯一索引是 `(owner_user_id, serial_number)`，软删不会释放它；
   * 重新添加同一台机器时命中这条记录并复活，而不是撞唯一约束报 500。
   *
   * 用 `findFirst` 而不是 `findUnique({ ownerUserId_serialNumber })`：
   * 复合唯一索引里 `serial_number` 可空，Prisma 不会为含可空字段的复合索引
   * 生成 `WhereUniqueInput`，写 `findUnique` 会直接类型不通过。
   */
  async findByOwnerSerial(ownerUserId: string, serialNumber: string) {
    return getDb().customerDevice.findFirst({
      where: { ownerUserId, serialNumber },
      include: deviceWithCount,
    });
  },

  /** 工作人员按序列号找设备（到店登记保修）：序列号只在单账号内唯一，故返回多条。 */
  async listBySerial(serialNumber: string) {
    return getDb().customerDevice.findMany({
      where: { serialNumber, deletedAt: null },
      include: { ...deviceWithCount, owner: { select: { displayName: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
    });
  },

  /** 未结束的报修单数量：> 0 时禁止解绑（客户还在等服务）。 */
  async countBusyOrders(deviceId: string): Promise<number> {
    return getDb().repairOrder.count({
      where: {
        deviceId,
        deletedAt: null,
        status: { in: [...deviceBusyOrderStatuses] },
      },
    });
  },

  async recentOrders(deviceId: string, take: number) {
    return getDb().repairOrder.findMany({
      where: { deviceId, deletedAt: null },
      select: { id: true, status: true, faultDescription: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
    });
  },

  async create(data: {
    id: string;
    ownerUserId: string;
    label: string;
    brand: string;
    model: string;
    serialNumber: string | null;
    purchaseOn: Date | null;
    source: string;
    now: Date;
  }) {
    return getDb().customerDevice.create({
      data: {
        id: data.id,
        ownerUserId: data.ownerUserId,
        label: data.label,
        brand: data.brand,
        model: data.model,
        serialNumber: data.serialNumber,
        purchaseOn: data.purchaseOn,
        source: data.source,
        status: "ACTIVE",
        createdAt: data.now,
        updatedAt: data.now,
      },
      include: deviceWithCount,
    });
  },

  async update(
    id: string,
    data: {
      label: string;
      brand: string;
      model: string;
      serialNumber: string | null;
      purchaseOn: Date | null;
    },
  ) {
    return getDb().customerDevice.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
      include: deviceWithCount,
    });
  },

  /** 解绑：软删 + 置 RETIRED，历史报修单仍能指回这台设备。 */
  async softDelete(id: string, now: Date) {
    return getDb().customerDevice.update({
      where: { id },
      data: { deletedAt: now, status: "RETIRED", updatedAt: now },
      include: deviceWithCount,
    });
  },

  /** 复活已解绑的记录：重新绑定同一序列号时复用原行，历史单据关联不断。 */
  async revive(
    id: string,
    data: {
      label: string;
      brand: string;
      model: string;
      purchaseOn: Date | null;
      source: string;
      now: Date;
    },
  ) {
    return getDb().customerDevice.update({
      where: { id },
      data: {
        label: data.label,
        brand: data.brand,
        model: data.model,
        purchaseOn: data.purchaseOn,
        source: data.source,
        status: "ACTIVE",
        deletedAt: null,
        updatedAt: data.now,
      },
      include: deviceWithCount,
    });
  },

  async listBenefits(deviceId: string) {
    return getDb().deviceBenefit.findMany({
      where: { deviceId },
      orderBy: [{ state: "asc" }, { endOn: "desc" }, { createdAt: "desc" }],
    });
  },

  async createBenefit(data: {
    id: string;
    deviceId: string;
    kind: string;
    name: string;
    provider: string;
    startOn: Date;
    endOn: Date | null;
    region: string;
    totalUses: number | null;
    note: string | null;
    createdByUserId: string;
    now: Date;
  }) {
    // `now` 只是调用方的「当前时间」，不是列：展开前必须摘掉，
    // 否则 Prisma 会把它当成未知字段直接抛错。
    const { now, ...fields } = data;
    return getDb().deviceBenefit.create({
      data: {
        ...fields,
        usedUses: 0,
        state: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      },
    });
  },

  async findBenefitById(id: string) {
    return getDb().deviceBenefit.findUnique({ where: { id } });
  },

  async voidBenefit(id: string, now: Date) {
    return getDb().deviceBenefit.update({
      where: { id },
      data: { state: "VOID", updatedAt: now },
    });
  },
};
