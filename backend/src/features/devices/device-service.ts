import { randomUUID } from "node:crypto";
import { AppError } from "@/lib/api/errors";
import { paginationMeta } from "@/lib/api/pagination";
import { hasPrismaCode } from "@/lib/db/prisma-errors";
import type { AuthorizedActor, PaginationInput } from "@/types/contracts";
import {
  assertCanCreateDevice,
  assertCanManageDevice,
  assertCanReadBenefits,
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

/**
 * 设备来源：本期只有「客户自填」这一条写入路径。
 *
 * 保留 `source` 列是为了将来「从报修单带入」能区分数据来历，
 * 但在真正实现那条路径之前，服务端不接受任何来自请求体的来源声明。
 */
const DEVICE_SOURCE_SELF = "SELF";

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
    // 详情页一半内容是权益，读权益的权限码要在这里也生效，
    // 否则 `benefit:read_self` 只在权益子接口上起作用，等于可以绕过。
    assertCanReadBenefits(actor, device);

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
   * `source` 由服务端写死为 `SELF`，**不接收客户端自报**：客户在表单里新增一台机器，
   * 来源就是自填。`REPAIR_IMPORT` 是「从报修单带入」那条路径的来源值，本期没有实现
   * 那条路径，所以这里也不该有能写进去的入口——否则任何人改个请求体就能把设备
   * 标成「系统从报修单认出来的」，与「不冒充真实业务」相悖。
   *
   * 序列号撞到自己已解绑的同一台机器时复活原记录，不再新建一行——
   * 唯一索引 `(owner, serial)` 不因软删释放，硬新建会直接撞约束。
   */
  async create(
    actor: AuthorizedActor,
    input: DeviceDraftInput,
  ): Promise<{ device: DeviceView; created: boolean }> {
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
          source: DEVICE_SOURCE_SELF,
          now: new Date(),
        });
        return { device: toDeviceView(revived), created: false };
      }
    }

    try {
      const created = await deviceRepository.create({
        id: randomUUID(),
        ownerUserId: userId,
        label: normalized.label,
        brand: normalized.brand,
        model: normalized.model,
        serialNumber: serial,
        purchaseOn: purchaseOf(normalized),
        source: DEVICE_SOURCE_SELF,
        now: new Date(),
      });
      return { device: toDeviceView(created), created: true };
    } catch (error) {
      // 两个请求同时绑同一台机器时，「先查后插」两次都查不到，第二条由唯一索引挡住。
      // 不翻译的话 Prisma 的 P2002 会冒到 INTERNAL_ERROR，客户端拿到 500 而不是冲突。
      if (hasPrismaCode(error, "P2002"))
        throw new AppError("DEVICE_SERIAL_CONFLICT", "这台设备已经绑定过了");
      throw error;
    }
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
      if (conflict && conflict.id !== device.id) {
        // 撞上已解绑的记录时不能直接放行：唯一索引 `(owner, serial)` 不因软删释放，
        // 而「编辑」不像「新增」那样有复活语义，硬写会撞约束报 500。
        // 这里给出可操作的指引，而不是一句「已经绑定过了」。
        throw new AppError(
          "DEVICE_SERIAL_CONFLICT",
          conflict.deletedAt === null
            ? "这个序列号已被你另一台设备占用"
            : "这个序列号属于你已解绑的设备；请先在新增页用同一序列号把它绑回来，再编辑信息",
        );
      }
    }

    try {
      const updated = await deviceRepository.update(device.id, {
        label: normalized.label,
        brand: normalized.brand,
        model: normalized.model,
        serialNumber: serial,
        purchaseOn: purchaseOf(normalized),
      });
      return toDeviceView(updated);
    } catch (error) {
      if (hasPrismaCode(error, "P2002"))
        throw new AppError("DEVICE_SERIAL_CONFLICT", "这个序列号已被你另一台设备占用");
      throw error;
    }
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
    assertCanReadBenefits(actor, device);
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
