import { randomUUID } from "node:crypto";
import { AppError } from "@/lib/api/errors";
import { paginationMeta } from "@/lib/api/pagination";
import type { AuthorizedActor, PaginationInput } from "@/types/contracts";
import {
  assertCanCreateDevice,
  assertCanManageDevice,
  assertCanReadDevice,
} from "./device-policy";
import { deviceRepository, type DeviceWithCount } from "./device-repository";
import {
  normalizeDeviceInput,
  parseCalendarDate,
  validateDeviceInput,
  type DeviceDraftInput,
} from "./device-validation";
import {
  toBenefitView,
  toDeviceView,
  type DeviceDetailView,
  type DeviceOrderSummary,
  type DeviceView,
} from "./device-view";

/** 详情页最多带 5 条历史报修：够回答「这台机器修过几次」，不把详情页做成列表页。 */
const RECENT_ORDER_LIMIT = 5;

function serialOf(input: DeviceDraftInput): string | null {
  return input.serialNumber ?? null;
}

function purchaseOf(input: DeviceDraftInput): Date | null {
  return input.purchaseOn === undefined ? null : parseCalendarDate(input.purchaseOn);
}

export const deviceService = {
  /** 本人设备列表。默认只列在用的（解绑后的设备留在库里供历史单据引用，不进列表）。 */
  async list(
    actor: AuthorizedActor,
    pagination: PaginationInput,
    options: { status?: string } = {},
  ): Promise<{ items: DeviceView[]; pagination: ReturnType<typeof paginationMeta> }> {
    if (!actor.userId) throw new AppError("UNAUTHENTICATED", "登录状态无效");
    const { items, total } = await deviceRepository.listByOwner(actor.userId, {
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
      status: options.status ?? "ACTIVE",
    });
    return {
      items: items.map(toDeviceView),
      pagination: paginationMeta(pagination, total),
    };
  },

  /** 详情：设备 + 权益（按实际生效状态现算）+ 最近报修。 */
  async detail(actor: AuthorizedActor, id: string): Promise<DeviceDetailView> {
    const device = await deviceRepository.findById(id);
    if (!device) throw new AppError("DEVICE_NOT_FOUND", "设备不存在");
    assertCanReadDevice(actor, device);

    const [benefits, orders] = await Promise.all([
      deviceRepository.listBenefits(device.id),
      deviceRepository.recentOrders(device.id, RECENT_ORDER_LIMIT),
    ]);
    const recentOrders: DeviceOrderSummary[] = orders.map((order) => ({
      id: order.id,
      status: order.status,
      faultDescription: order.faultDescription,
      createdAt: order.createdAt.toISOString(),
    }));
    return {
      ...toDeviceView(device),
      benefits: benefits.map((benefit) => toBenefitView(benefit)),
      recentOrders,
    };
  },

  /**
   * 新增设备。
   *
   * `source` 由服务端决定，**不接收客户端自报**：客户在表单里新增一律是 `SELF`；
   * `REPAIR_IMPORT` 只在「从报修单带入」那条路径上由服务端写入。
   *
   * 序列号撞到自己已解绑的同一台机器时复活原记录，不再新建一行——
   * 唯一索引 `(owner, serial)` 不因软删释放，硬新建会直接撞约束。
   */
  async create(
    actor: AuthorizedActor,
    input: DeviceDraftInput & { source?: string },
  ): Promise<DeviceView> {
    assertCanCreateDevice(actor);
    const userId = actor.userId as string;

    const normalized = normalizeDeviceInput(input);
    validateDeviceInput(normalized);

    const serial = serialOf(normalized);
    if (serial !== null) {
      const existing = await deviceRepository.findByOwnerSerial(userId, serial);
      if (existing && existing.deletedAt === null)
        throw new AppError("DEVICE_SERIAL_CONFLICT", "这台设备已经绑定过了");
      if (existing) {
        const revived = await deviceRepository.revive(existing.id, {
          label: normalized.label,
          brand: normalized.brand,
          model: normalized.model,
          purchaseOn: purchaseOf(normalized),
          source: input.source === "REPAIR_IMPORT" ? "REPAIR_IMPORT" : "SELF",
          now: new Date(),
        });
        return toDeviceView(revived);
      }
    }

    const created = await deviceRepository.create({
      id: randomUUID(),
      ownerUserId: userId,
      label: normalized.label,
      brand: normalized.brand,
      model: normalized.model,
      serialNumber: serial,
      purchaseOn: purchaseOf(normalized),
      source: input.source === "REPAIR_IMPORT" ? "REPAIR_IMPORT" : "SELF",
      now: new Date(),
    });
    return toDeviceView(created);
  },

  /** 编辑设备：只改归属人自己的可编辑字段，状态与来源不接收客户端输入。 */
  async update(actor: AuthorizedActor, id: string, input: DeviceDraftInput): Promise<DeviceView> {
    const device = await deviceRepository.findById(id);
    if (!device) throw new AppError("DEVICE_NOT_FOUND", "设备不存在");
    assertCanManageDevice(actor, device);

    const normalized = normalizeDeviceInput(input);
    validateDeviceInput(normalized);

    const serial = serialOf(normalized);
    if (serial !== null && serial !== device.serialNumber) {
      const conflict = await deviceRepository.findByOwnerSerial(device.ownerUserId, serial);
      if (conflict && conflict.id !== device.id)
        throw new AppError("DEVICE_SERIAL_CONFLICT", "这台设备已经绑定过了");
    }

    const updated = await deviceRepository.update(device.id, {
      label: normalized.label,
      brand: normalized.brand,
      model: normalized.model,
      serialNumber: serial,
      purchaseOn: purchaseOf(normalized),
    });
    return toDeviceView(updated);
  },

  /**
   * 解绑。
   *
   * 有未结束的报修单时拒绝：设备正在维修中，解绑会让客户在最需要看到进度的时候
   * 失去入口，也让工作人员核对机型时找不到设备。
   */
  async remove(actor: AuthorizedActor, id: string): Promise<{ id: string; status: string }> {
    const device = await deviceRepository.findById(id);
    if (!device) throw new AppError("DEVICE_NOT_FOUND", "设备不存在");
    assertCanManageDevice(actor, device);

    const busy = await deviceRepository.countBusyOrders(device.id);
    if (busy > 0) throw new AppError("DEVICE_IN_USE", "该设备还有未完成的报修，暂不能解绑");

    const removed = await deviceRepository.softDelete(device.id, new Date());
    return { id: removed.id, status: removed.status };
  },

  /** 设备的权益列表（客户本人或工作人员可读）。 */
  async listBenefits(actor: AuthorizedActor, deviceId: string) {
    const device = await deviceRepository.findById(deviceId);
    if (!device) throw new AppError("DEVICE_NOT_FOUND", "设备不存在");
    assertCanReadDevice(actor, device);
    const benefits = await deviceRepository.listBenefits(device.id);
    return benefits.map((benefit) => toBenefitView(benefit));
  },

  /**
   * 工作人员按序列号查设备（到店登记权益前的核对步骤）。
   *
   * 序列号在单账号内唯一，不同客户可能填了同一个串号，因此返回列表而不是单条，
   * 由工作人员按机型和报修记录自己认领。
   */
  async staffLookup(actor: AuthorizedActor, serial: string): Promise<Array<DeviceView & { ownerDisplayName: string }>> {
    if (!actor.permissions.includes("device:read"))
      throw new AppError("FORBIDDEN", "没有执行该操作的权限");
    const keyword = serial.trim();
    if (keyword === "") throw new AppError("VALIDATION_FAILED", "请填写序列号");
    const rows = await deviceRepository.listBySerial(keyword);
    return rows.map((row) => ({
      ...toDeviceView(row as DeviceWithCount),
      ownerDisplayName: row.owner.displayName ?? "客户",
    }));
  },
};
