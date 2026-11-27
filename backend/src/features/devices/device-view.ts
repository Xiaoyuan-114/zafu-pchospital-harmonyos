import { shanghaiToday } from "@/lib/shanghai-date";
import { calendarDateString, type BenefitKind } from "./device-validation";

/** 设备对外形状（列表与详情共用）。不含 ownerUserId：归属由服务端判定，不外泄账号 ID。 */
export type DeviceView = {
  id: string;
  label: string;
  brand: string;
  model: string;
  serialNumber: string | null;
  purchaseOn: string | null;
  source: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  /** 该设备关联的报修单数量（含历史单），列表页用于显示「N 次报修」 */
  repairOrderCount: number;
};

/**
 * 权益的**实际生效状态**：由 `state` 与 `endOn` 现场算出，不落库。
 *
 * 之所以要分「人工作废」和「自然到期」两条轴：
 * `VOID` 是人填错了撤销，`EXPIRED` 是日期过了，两者对客户的解释完全不同，
 * 不能合并成一个 `INACTIVE`。
 */
export const benefitStatusValues = ["EFFECTIVE", "EXPIRED", "VOID"] as const;
export type BenefitStatus = (typeof benefitStatusValues)[number];

export type BenefitView = {
  id: string;
  deviceId: string;
  kind: BenefitKind;
  name: string;
  provider: string;
  startOn: string;
  /** null = 长期有效 */
  endOn: string | null;
  region: string;
  /** null = 不限次 */
  totalUses: number | null;
  usedUses: number;
  remainingUses: number | null;
  status: BenefitStatus;
  /** 距到期天数；长期有效或已作废为 null；已过期为负数 */
  daysRemaining: number | null;
  note: string | null;
  createdAt: string;
};

type DeviceRow = {
  id: string;
  label: string;
  brand: string;
  model: string;
  serialNumber: string | null;
  purchaseOn: Date | null;
  source: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { orders: number };
};

type BenefitRow = {
  id: string;
  deviceId: string;
  kind: string;
  name: string;
  provider: string;
  startOn: Date;
  endOn: Date | null;
  region: string;
  totalUses: number | null;
  usedUses: number;
  state: string;
  note: string | null;
  createdAt: Date;
};

export function toDeviceView(row: DeviceRow): DeviceView {
  return {
    id: row.id,
    label: row.label,
    brand: row.brand,
    model: row.model,
    serialNumber: row.serialNumber,
    purchaseOn: calendarDateString(row.purchaseOn),
    source: row.source,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    repairOrderCount: row._count?.orders ?? 0,
  };
}

/** 两个 `YYYY-MM-DD` 之间相差的天数（`to - from`，可为负）。 */
function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((end - start) / 86_400_000);
}

export function toBenefitView(row: BenefitRow, today: string = shanghaiToday()): BenefitView {
  const endOn = calendarDateString(row.endOn);
  let status: BenefitStatus = "EFFECTIVE";
  if (row.state === "VOID") status = "VOID";
  else if (endOn !== null && endOn < today) status = "EXPIRED";

  const daysRemaining = endOn === null ? null : daysBetween(today, endOn);
  const remainingUses =
    row.totalUses === null ? null : Math.max(row.totalUses - row.usedUses, 0);

  return {
    id: row.id,
    deviceId: row.deviceId,
    kind: row.kind as BenefitKind,
    name: row.name,
    provider: row.provider,
    startOn: calendarDateString(row.startOn) ?? "",
    endOn,
    region: row.region,
    totalUses: row.totalUses,
    usedUses: row.usedUses,
    remainingUses,
    status,
    daysRemaining,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

/** 详情页用的「最近报修」摘要：只带客户需要看的状态与时间。 */
export type DeviceOrderSummary = {
  id: string;
  status: string;
  faultDescription: string;
  createdAt: string;
};

export type DeviceDetailView = DeviceView & {
  benefits: BenefitView[];
  recentOrders: DeviceOrderSummary[];
};
