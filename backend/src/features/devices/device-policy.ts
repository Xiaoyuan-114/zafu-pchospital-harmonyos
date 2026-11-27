import { AppError } from "@/lib/api/errors";
import { requirePermission } from "@/lib/auth/permissions";
import type { AuthorizedActor } from "@/types/contracts";

type DeviceOwnership = {
  ownerUserId: string;
  deletedAt: Date | null;
};

function has(actor: AuthorizedActor, permission: Parameters<typeof requirePermission>[1]): boolean {
  return actor.permissions.includes(permission);
}

/**
 * 读设备：本人可读自己的，工作人员（`device:read`）可读全部。
 *
 * 非本人且非工作人员抛 `DEVICE_NOT_FOUND` 而不是 `FORBIDDEN`：
 * 403 会告诉调用方「这个 ID 存在但不是你的」，等于给出可枚举存在性的接口。
 * 与 `repair-order-policy.ts` 的 `assertCanReadRepairOrder` 保持同一口径。
 *
 * 工作人员账号自己也可能是客户（有报修单），此时走「本人」分支，
 * 因此除 `device:read_self` 外也接受 `device:read`，不让人被自己的角色挡住。
 */
export function assertCanReadDevice(actor: AuthorizedActor, device: DeviceOwnership): void {
  if (device.deletedAt !== null) throw new AppError("DEVICE_NOT_FOUND", "设备不存在");
  if (device.ownerUserId === actor.userId) {
    if (!has(actor, "device:read_self") && !has(actor, "device:read"))
      throw new AppError("FORBIDDEN", "没有执行该操作的权限");
    return;
  }
  if (!has(actor, "device:read")) throw new AppError("DEVICE_NOT_FOUND", "设备不存在");
}

/**
 * 改设备 / 解绑：**只有本人**。
 *
 * 工作人员有 `device:read` 但没有 `device:manage_self`，因此不能替客户改机型或解绑——
 * 设备归属是客户的，工作人员改错无法追溯。工作人员账号若自己拥有设备，
 * 走「本人」分支放行，理由同上。
 */
export function assertCanManageDevice(actor: AuthorizedActor, device: DeviceOwnership): void {
  if (device.deletedAt !== null) throw new AppError("DEVICE_NOT_FOUND", "设备不存在");
  if (device.ownerUserId !== actor.userId) throw new AppError("DEVICE_NOT_FOUND", "设备不存在");
  if (!has(actor, "device:manage_self") && !has(actor, "device:read"))
    throw new AppError("FORBIDDEN", "没有执行该操作的权限");
}

/** 登记权益：工作人员与管理员（`benefit:write`）。受理时补录也走这里。 */
export function assertCanRegisterBenefit(actor: AuthorizedActor): void {
  requirePermission(actor, "benefit:write");
  if (!actor.userId) throw new AppError("UNAUTHENTICATED", "登录状态无效");
}

/**
 * 新增设备：任何登录账号都能给自己绑一台。
 *
 * 客户靠 `device:manage_self`，工作人员账号靠 `device:read`（他们是客户的同时也是工作人员），
 * 两者都只作用于 `ownerUserId = 自己`，所以不需要把客户权限码发给全部角色。
 */
export function assertCanCreateDevice(actor: AuthorizedActor): void {
  if (!actor.userId) throw new AppError("UNAUTHENTICATED", "登录状态无效");
  if (!has(actor, "device:manage_self") && !has(actor, "device:read"))
    throw new AppError("FORBIDDEN", "没有执行该操作的权限");
}

/** 作废权益：仅管理员（`benefit:void`）。作废会改变客户看到的结果，不与登记同权。 */
export function assertCanVoidBenefit(actor: AuthorizedActor): void {
  requirePermission(actor, "benefit:void");
  if (!actor.userId) throw new AppError("UNAUTHENTICATED", "登录状态无效");
}
