import { randomUUID } from "node:crypto";
import { AppError } from "@/lib/api/errors";
import type { AuthorizedActor } from "@/types/contracts";
import { assertCanRegisterBenefit, assertCanVoidBenefit } from "./device-policy";
import { deviceRepository } from "./device-repository";
import {
  normalizeBenefitInput,
  parseCalendarDate,
  validateBenefitInput,
  type BenefitDraftInput,
} from "./device-validation";
import { toBenefitView, type BenefitView } from "./device-view";

/**
 * 设备权益：登记由工作人员完成，作废只给管理员。
 *
 * 这里没有「客户自己填保修」的路径，也没有到期自动改状态的任务：
 * 权益是否有效由 `endOn` 与当天日期在读取时算（`toBenefitView`），
 * 不做定时任务去改库，避免「任务没跑 → 过期记录仍显示有效」。
 */
export const benefitService = {
  async register(
    actor: AuthorizedActor,
    deviceId: string,
    input: BenefitDraftInput,
  ): Promise<BenefitView> {
    assertCanRegisterBenefit(actor);

    const device = await deviceRepository.findById(deviceId);
    if (!device || device.deletedAt !== null) throw new AppError("DEVICE_NOT_FOUND", "设备不存在");

    const normalized = normalizeBenefitInput(input);
    validateBenefitInput(normalized);

    const created = await deviceRepository.createBenefit({
      id: randomUUID(),
      deviceId: device.id,
      kind: normalized.kind,
      name: normalized.name,
      provider: normalized.provider,
      startOn: parseCalendarDate(normalized.startOn) as Date,
      endOn: normalized.endOn === undefined ? null : parseCalendarDate(normalized.endOn),
      region: normalized.region as string,
      totalUses: normalized.totalUses ?? null,
      note: normalized.note ?? null,
      createdByUserId: actor.userId as string,
      now: new Date(),
    });
    return toBenefitView(created);
  },

  /**
   * 作废一条权益（管理员）。
   *
   * 重复作废幂等：返回当前状态而不是报错——管理员连点两次不该看到失败提示。
   * 作废只改 `state`，记录本身保留，客户侧仍能看到「已作废」及原因备注，
   * 与直接删行相比可追溯。
   */
  async voidBenefit(actor: AuthorizedActor, benefitId: string): Promise<BenefitView> {
    assertCanVoidBenefit(actor);
    const benefit = await deviceRepository.findBenefitById(benefitId);
    if (!benefit) throw new AppError("BENEFIT_NOT_FOUND", "权益记录不存在");
    if (benefit.state === "VOID") return toBenefitView(benefit);
    const updated = await deviceRepository.voidBenefit(benefit.id, new Date());
    return toBenefitView(updated);
  },
};
