// 客户设备与保修权益契约（Issue #102）：字段与后端 /api/v1/customer/devices 一一对应。
//
// ⚠️ 三条边界，改动前先读：
// 1. 设备是客户**自己填**的绑定记录，不是从报修单反推出来的。后端另有
//    repairOrderCount 表示关联单数，但它只是计数，不代表设备由单据生成。
// 2. 权益（保修）**只能由工作人员登记**，客户侧是只读的。所以本文件里
//    没有任何「提交权益」的方法，DeviceService 也没有对应的写接口。
// 3. 权益状态由服务端按当日日期现算（EFFECTIVE / EXPIRED / VOID），
//    客户端不自己判断是否过期 —— 手机时间不可信，也不该由客户端定义业务状态。

/**
 * 设备绑定来源，与后端 deviceSourceValues 对齐。
 * 由服务端写入，客户端不提交此字段 —— SELF 是表单新增，REPAIR_IMPORT 是从历史报修单带入。
 */
export const DEVICE_SOURCE_SELF: string = 'SELF';
export const DEVICE_SOURCE_REPAIR_IMPORT: string = 'REPAIR_IMPORT';

/** 设备状态：RETIRED 为解绑后的历史记录，列表默认不返回。 */
export const DEVICE_STATUS_ACTIVE: string = 'ACTIVE';
export const DEVICE_STATUS_RETIRED: string = 'RETIRED';

/** 权益的实际生效状态，与后端 benefitStatusValues 对齐。 */
export const BENEFIT_STATUS_EFFECTIVE: string = 'EFFECTIVE';
export const BENEFIT_STATUS_EXPIRED: string = 'EXPIRED';
export const BENEFIT_STATUS_VOID: string = 'VOID';

/** 权益类型，与后端 benefitKindValues 对齐。 */
export const BENEFIT_KIND_WARRANTY: string = 'WARRANTY';
export const BENEFIT_KIND_EXTENDED: string = 'EXTENDED';
export const BENEFIT_KIND_SERVICE: string = 'SERVICE';
export const BENEFIT_KIND_ACCIDENT: string = 'ACCIDENT';

/** 设备对外形状（列表与详情共用）。 */
export interface DeviceView {
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
  /** 该设备关联的报修单数量（含历史单） */
  repairOrderCount: number;
}

/** 权益对外形状。状态与剩余天数是服务端算好的，界面直接展示。 */
export interface BenefitView {
  id: string;
  deviceId: string;
  kind: string;
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
  status: string;
  /** 距到期天数；长期有效或已作废为 null；已过期为负数 */
  daysRemaining: number | null;
  note: string | null;
  createdAt: string;
}

/** 详情页的「最近报修」摘要。只带客户需要看的字段。 */
export interface DeviceOrderSummary {
  id: string;
  status: string;
  faultDescription: string;
  createdAt: string;
}

/** 设备详情：设备本体 + 权益列表 + 最近报修。 */
export interface DeviceDetailView {
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
  repairOrderCount: number;
  benefits: BenefitView[];
  recentOrders: DeviceOrderSummary[];
}

/** POST /api/v1/customer/devices 的请求体。 */
export interface DeviceCreateRequest {
  label: string;
  brand: string;
  model: string;
  serialNumber?: string;
  purchaseOn?: string;
}

/** PATCH /api/v1/customer/devices/{id} 的请求体：全部可选，只传要改的字段。 */
export interface DeviceUpdateRequest {
  label?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  purchaseOn?: string;
}

/**
 * 客户端侧字段上限：与后端 device-validation.ts 对齐，用于提交前即时提示。
 * 用显式 interface（不是 Record 字面量）—— ArkTS 不允许无声明类型的对象字面量。
 */
export interface DeviceLimits {
  labelMaxLength: number;
  brandMaxLength: number;
  modelMaxLength: number;
  serialNumberMaxLength: number;
}

export const DEVICE_LIMITS: DeviceLimits = {
  labelMaxLength: 40,
  brandMaxLength: 40,
  modelMaxLength: 60,
  serialNumberMaxLength: 120,
};

/** 设备状态 → 界面文案。状态值是服务端契约，界面上不直接展示英文。 */
export function deviceStatusLabel(status: string): string {
  if (status === DEVICE_STATUS_ACTIVE) {
    return '使用中';
  }
  if (status === DEVICE_STATUS_RETIRED) {
    return '已解绑';
  }
  // 未知状态原样展示，好过在界面上凭空猜一个中文名。
  return status;
}

/** 权益状态 → 界面文案。VOID 与 EXPIRED 分开表述，客户才知道该找谁。 */
export function benefitStatusLabel(status: string): string {
  if (status === BENEFIT_STATUS_EFFECTIVE) {
    return '有效';
  }
  if (status === BENEFIT_STATUS_EXPIRED) {
    return '已过保修期';
  }
  if (status === BENEFIT_STATUS_VOID) {
    return '已作废';
  }
  return status;
}

/** 权益类型 → 界面文案。 */
export function benefitKindLabel(kind: string): string {
  if (kind === BENEFIT_KIND_WARRANTY) {
    return '整机保修';
  }
  if (kind === BENEFIT_KIND_EXTENDED) {
    return '延长保修';
  }
  if (kind === BENEFIT_KIND_SERVICE) {
    return '服务权益';
  }
  if (kind === BENEFIT_KIND_ACCIDENT) {
    return '意外保障';
  }
  return kind;
}

/**
 * 状态 → 卡片排序权重：有效在前、已过期居中、已作废垫底。
 * 后端已按同样顺序排过，前端再排一次是为了本地编辑后立即重排时不跳序。
 */
export function benefitStatusRank(status: string): number {
  if (status === BENEFIT_STATUS_EFFECTIVE) {
    return 0;
  }
  if (status === BENEFIT_STATUS_EXPIRED) {
    return 1;
  }
  return 2;
}

/**
 * 日历日期显示：后端给的是 `YYYY-MM-DD`（DATE 列，无时区），
 * 直接展示即可，**不要**走 `new Date()` —— 那会被当成 UTC 午夜再转本地时区，
 * 在东八区之外的机器上会退回前一天。
 */
export function formatCalendarDate(value: string | null): string {
  if (value === null || value === undefined || value === '') {
    return '长期有效';
  }
  return value;
}

/** 购买日期这类「可以为空」的日历日期，空值显示为占位破折号。 */
export function formatOptionalDate(value: string | null, emptyText: string): string {
  if (value === null || value === undefined || value === '') {
    return emptyText;
  }
  return value;
}

/**
 * 剩余天数 → 界面文案。
 * 已过期的天数由服务端给成负数，这里区分「已过期 N 天」和「还有 N 天」，
 * 避免把 -3 直接渲染成「还有 -3 天」。
 */
export function daysRemainingLabel(days: number | null, status: string): string {
  if (status === BENEFIT_STATUS_VOID) {
    return '—';
  }
  if (days === null || days === undefined) {
    return '长期有效';
  }
  if (days < 0) {
    return `已过期 ${-days} 天`;
  }
  if (days === 0) {
    return '今日到期';
  }
  return `还有 ${days} 天`;
}

/** 可用次数 → 界面文案。null 表示不限次。 */
export function remainingUsesLabel(remaining: number | null, total: number | null): string {
  if (total === null || total === undefined) {
    return '不限次';
  }
  const left: number = remaining === null || remaining === undefined ? 0 : remaining;
  return `${left} / ${total} 次`;
}
