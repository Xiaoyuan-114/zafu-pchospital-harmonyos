import { AppError } from "@/lib/api/errors";
import { shanghaiToday } from "@/lib/shanghai-date";

/**
 * 设备与权益字段上限，与 `schema.prisma` 的 VarChar 长度逐字对齐。
 *
 * 客户端 `DeviceContract.ets` 里有一份同值常量用于提交前提示；
 * 服务端这份才是判定依据，两处改一处必须同步另一处。
 */
export const deviceFieldLimits = {
  labelMaxLength: 40,
  brandMaxLength: 40,
  modelMaxLength: 60,
  serialMaxLength: 120,
  benefitNameMaxLength: 60,
  providerMaxLength: 60,
  regionMaxLength: 80,
  noteMaxLength: 200,
  maxTotalUses: 999,
} as const;

/** 设备来源：客户自己新增，或从历史报修单带入（客户确认后写入，不自动生成）。 */
export const deviceSourceValues = ["SELF", "REPAIR_IMPORT"] as const;
export type DeviceSource = (typeof deviceSourceValues)[number];

/** 设备状态：ACTIVE 在用；RETIRED 已解绑（软删时一并置位）。 */
export const deviceStatusValues = ["ACTIVE", "RETIRED"] as const;

/** 权益类型：保修 / 延保 / 到店服务 / 意外保障。 */
export const benefitKindValues = ["WARRANTY", "EXTENDED", "SERVICE", "ACCIDENT"] as const;
export type BenefitKind = (typeof benefitKindValues)[number];

/** 权益人工状态：ACTIVE 未作废；VOID 已作废。**到期与否不存这里**。 */
export const benefitStateValues = ["ACTIVE", "VOID"] as const;

export type DeviceDraftInput = {
  label: string;
  brand: string;
  model: string;
  serialNumber?: string;
  /** 上海日历日 `YYYY-MM-DD`；不填表示未记录购买日期 */
  purchaseOn?: string;
};

export type BenefitDraftInput = {
  kind: string;
  name: string;
  provider: string;
  startOn: string;
  /** 不填表示长期有效 */
  endOn?: string;
  region?: string;
  /** 不填表示不限次 */
  totalUses?: number;
  note?: string;
};

function clean(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * 严格解析 `YYYY-MM-DD`：格式与真实日期都要成立（`2026-02-30` 不算）。
 *
 * 返回 UTC 零点：数据库列是 `DATE`，用 UTC 零点存、按 UTC 读回，
 * 跨时区不会把 3 月 1 日变成 2 月 28 日。
 */
export function parseCalendarDate(value: string): Date | null {
  const matched = CALENDAR_DATE.exec(value);
  if (!matched) return null;
  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed;
}

/** `DATE` 列 → `YYYY-MM-DD`；空值原样返回 null。 */
export function calendarDateString(value: Date | null): string | null {
  return value === null ? null : value.toISOString().slice(0, 10);
}

/** 归一化：去多余空白；空串与未填视为同一件事（可选字段存 null）。 */
export function normalizeDeviceInput(input: DeviceDraftInput): DeviceDraftInput {
  const serial = clean(input.serialNumber);
  const purchaseOn = clean(input.purchaseOn);
  return {
    label: clean(input.label),
    brand: clean(input.brand),
    model: clean(input.model),
    serialNumber: serial === "" ? undefined : serial,
    purchaseOn: purchaseOn === "" ? undefined : purchaseOn,
  };
}

/**
 * 校验设备字段。一次性收集全部错误再抛，客户端可一次标完所有问题。
 * 购买日期不允许晚于今天 —— 那是录入错误，不是「未来才买」。
 */
export function validateDeviceInput(input: DeviceDraftInput): void {
  const errors: Record<string, string[]> = {};
  const limits = deviceFieldLimits;

  if (input.label === "") errors.label = ["请填写设备名称"];
  else if (input.label.length > limits.labelMaxLength)
    errors.label = [`设备名称不能超过 ${limits.labelMaxLength} 字`];

  if (input.brand === "") errors.brand = ["请填写品牌"];
  else if (input.brand.length > limits.brandMaxLength)
    errors.brand = [`品牌不能超过 ${limits.brandMaxLength} 字`];

  if (input.model === "") errors.model = ["请填写型号"];
  else if (input.model.length > limits.modelMaxLength)
    errors.model = [`型号不能超过 ${limits.modelMaxLength} 字`];

  if (input.serialNumber !== undefined && input.serialNumber.length > limits.serialMaxLength)
    errors.serialNumber = [`序列号不能超过 ${limits.serialMaxLength} 字`];

  if (input.purchaseOn !== undefined) {
    const purchase = parseCalendarDate(input.purchaseOn);
    if (purchase === null) errors.purchaseOn = ["购买日期格式应为 YYYY-MM-DD"];
    else if (input.purchaseOn > shanghaiToday()) errors.purchaseOn = ["购买日期不能晚于今天"];
  }

  if (Object.keys(errors).length)
    throw new AppError("VALIDATION_FAILED", "设备信息填写不完整", { fieldErrors: errors });
}

/** 归一化权益输入：类型统一大写，地区缺省为「中国大陆」，次数取整。 */
export function normalizeBenefitInput(input: BenefitDraftInput): BenefitDraftInput {
  const endOn = clean(input.endOn);
  const note = clean(input.note);
  const region = clean(input.region);
  const uses = Number(input.totalUses);
  return {
    kind: (input.kind ?? "").trim().toUpperCase(),
    name: clean(input.name),
    provider: clean(input.provider),
    startOn: clean(input.startOn),
    endOn: endOn === "" ? undefined : endOn,
    region: region === "" ? "中国大陆" : region,
    totalUses: input.totalUses === undefined || input.totalUses === null || Number.isNaN(uses)
      ? undefined
      : Math.trunc(uses),
    note: note === "" ? undefined : note,
  };
}

/**
 * 校验权益字段。
 *
 * `endOn` 允许为空（长期有效），但一旦填写就必须不早于 `startOn`：
 * 起止倒置的权益在列表里会算出负数剩余天数，属于录入错误。
 */
export function validateBenefitInput(input: BenefitDraftInput): void {
  const errors: Record<string, string[]> = {};
  const limits = deviceFieldLimits;

  if (!(benefitKindValues as readonly string[]).includes(input.kind))
    errors.kind = ["权益类型不在可选范围内"];

  if (input.name === "") errors.name = ["请填写权益名称"];
  else if (input.name.length > limits.benefitNameMaxLength)
    errors.name = [`权益名称不能超过 ${limits.benefitNameMaxLength} 字`];

  if (input.provider === "") errors.provider = ["请填写提供方"];
  else if (input.provider.length > limits.providerMaxLength)
    errors.provider = [`提供方不能超过 ${limits.providerMaxLength} 字`];

  const start = input.startOn === undefined ? null : parseCalendarDate(input.startOn);
  if (start === null) errors.startOn = ["生效日期格式应为 YYYY-MM-DD"];

  let end: Date | null = null;
  if (input.endOn !== undefined) {
    end = parseCalendarDate(input.endOn);
    if (end === null) errors.endOn = ["截止日期格式应为 YYYY-MM-DD"];
    else if (start !== null && end.getTime() < start.getTime())
      errors.endOn = ["截止日期不能早于生效日期"];
  }

  if ((input.region ?? "").length > limits.regionMaxLength)
    errors.region = [`适用区域不能超过 ${limits.regionMaxLength} 字`];

  if (input.totalUses !== undefined) {
    if (!Number.isInteger(input.totalUses) || input.totalUses < 0 || input.totalUses > limits.maxTotalUses)
      errors.totalUses = [`可用次数应为 0–${limits.maxTotalUses} 的整数`];
  }

  if ((input.note ?? "").length > limits.noteMaxLength)
    errors.note = [`备注不能超过 ${limits.noteMaxLength} 字`];

  if (Object.keys(errors).length)
    throw new AppError("VALIDATION_FAILED", "权益信息填写不完整", { fieldErrors: errors });
}
