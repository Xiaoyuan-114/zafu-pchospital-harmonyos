/**
 * M5 内部可见性与展示名规则（M5 任务书 §8.3）。
 *
 * 这里是**纯函数**，不做任何查询：内部榜单的展示名回退顺序与
 * 「哪些成员可以进入当前榜单」的判断都集中在此，便于单测锁定。
 *
 * ⚠️ 本文件的展示名规则**不是 M7 的公开隐私策略**。M7 上线前必须另行实现
 * 管理员可配置的公开策略与公开 DTO，不得直接复用这里的返回值对外展示。
 */

/** 所有回退都失败时使用的中性展示名，避免出现空字符串或泄露账号字段。 */
export const DISPLAY_NAME_FALLBACK = "成员";

/**
 * 进入当前成员排行榜所需的档案状态。
 *
 * 单独定义为常量，使原生 SQL 与 `isRankableMember()` 共用同一个取值，
 * 避免两处各写一遍字面量后发生漂移。
 */
export const RANKABLE_MEMBER_STATUS = "ACTIVE";

export type DisplayNameSource = {
  nickname: string | null;
  realName: string | null;
  displayName: string | null;
};

/**
 * 展示名回退链：`nickname → realName → User.displayName → "成员"`。
 *
 * 注意回退的是**展示名**，不是身份：QQ、手机号、学号、班级与 `userId`
 * 一律不参与，且**永不**作为兜底值返回。
 */
export function resolveDisplayName(source: DisplayNameSource): string {
  for (const candidate of [source.nickname, source.realName, source.displayName]) {
    const trimmed = candidate?.trim();
    if (trimmed) return trimmed;
  }
  return DISPLAY_NAME_FALLBACK;
}

/** 只有 `ACTIVE` 且未软删除的成员档案才进入当前成员排行榜（历史数据仍保留）。 */
export function isRankableMember(profile: { status: string; deletedAt: Date | null }): boolean {
  return profile.deletedAt === null && profile.status === RANKABLE_MEMBER_STATUS;
}

/**
 * 排行榜条目的取值字段类型。
 *
 * 数据库聚合可能以字符串返回 `BIGINT` / `DECIMAL`，这里统一做显式数值转换，
 * 防止驱动值以 `"12"` 这类字符串泄漏到 API（M5 任务书 §7）。
 */
export function toSafeInteger(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
  }
  if (value && typeof value === "object" && "toString" in value) {
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
  }
  return 0;
}

/** 时长聚合允许 `null`（历史记录缺时长），一律按 0 分钟计入，不让整个榜单失败。 */
export function toSafeDuration(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return toSafeInteger(value);
}
