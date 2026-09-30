import { randomUUID } from "node:crypto";

import { nextSortOrder } from "@/features/admin/reorder";
import { skillRepository } from "@/features/skills/skill-repository";
import { AppError } from "@/lib/api/errors";
import { appendAuditLog } from "@/lib/audit/audit-service";
import { requirePermission } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db/client";
import { inSerializableTransaction } from "@/lib/db/transaction";
import { stableCodeFromName } from "@/lib/stable-code";
import { SKILL_NAME_MAX_LENGTH, type AuthorizedActor, type SkillView } from "@/types/contracts";

/**
 * 技能标签服务（M3 任务书 §9、§10.3）。
 *
 * 读取一直是成员侧能力（M3 只开放只读）；issue #68 起新增**成员自建标签**
 * （`createFromMember`，业务确认无需审核）：标签库不可能预先覆盖所有人的技能，
 * 成员在资料编辑器里输入一个新名字即可新建并立即选中它。
 * 标签库的完整增删改（含停用、排序、描述）仍然只属于 M6 的 `skillAdminService`。
 */
export const skillService = {
  /** `GET /api/v1/skills` —— 启用中、未软删除的技能，按 sortOrder 升序。 */
  async listActive(): Promise<SkillView[]> {
    const rows = await skillRepository.listActive();
    return rows.map(toSkillView);
  },

  /**
   * `POST /api/v1/skills` —— 成员自建标签（issue #68）。
   *
   * 三条规则：
   * 1. **同名即复用**：已有同名且启用中的标签时直接返回它，不新建、不写审计。
   *    成员输入的是「我想要的标签名」，库里已经有就不该再多出一行 ——
   *    重复提交也因此天然幂等，不会攒出一堆同名标签。
   * 2. **同名但已停用**：明确拒绝（`SKILL_INACTIVE`）。停用是管理员的决定，
   *    不能靠成员重新输入同一个名字把它复活。
   * 3. 只接受名称，且与管理员新建同一上限（{@link SKILL_NAME_MAX_LENGTH}）；
   *    描述、排序、`code` 都不由成员提供。
   */
  async createFromMember(name: unknown, actor: AuthorizedActor): Promise<SkillView> {
    requirePermission(actor, "member.skill.assign_self");
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (!trimmed || trimmed.length > SKILL_NAME_MAX_LENGTH) {
      throw new AppError("VALIDATION_FAILED", "技能名称无效", {
        fieldErrors: { name: [`技能名称需为 1-${SKILL_NAME_MAX_LENGTH} 个字符`] },
      });
    }
    const existing = await getDb().skill.findFirst({ where: { deletedAt: null, name: trimmed } });
    if (existing) {
      if (!existing.isActive) {
        throw new AppError("SKILL_INACTIVE", "该标签已被管理员停用，请换一个名称");
      }
      return toSkillView(existing);
    }

    const code = stableCodeFromName(trimmed, "SK");
    try {
      return await inSerializableTransaction(async (tx) => {
        const created = await tx.skill.create({
          data: {
            id: randomUUID(),
            code,
            name: trimmed,
            // 追加到末尾：成员新建不插队，顺序由管理端的排序决定。
            sortOrder: await nextSortOrder(tx, "skills"),
            isActive: true,
            createdBy: actor.userId,
            createdAt: new Date(),
          },
        });
        await appendAuditLog(tx, {
          actor,
          actorType: "USER",
          actorUserId: actor.userId,
          action: "skill.created",
          targetType: "Skill",
          targetId: created.id,
          result: "SUCCESS",
          after: { code, name: trimmed },
        });
        return toSkillView(created);
      });
    } catch (error) {
      // 两个成员同时新建同一个名字时会在 `code` 唯一键上撞车：复用先写入的那行，
      // 对调用方仍然表现为「成功拿到这个标签」。
      if (!hasPrismaCode(error, "P2002")) throw error;
      const raced = await getDb().skill.findFirst({ where: { code, deletedAt: null } });
      if (raced && raced.name === trimmed) return toSkillView(raced);
      // 名称不同却算出同一个 code（纯 ASCII 名称折叠后相同，如 `A/B` 与 `A B`）：
      // 这不是同名复用，报冲突比悄悄返回另一个名字的标签安全。
      throw new AppError("SKILL_CODE_CONFLICT", "标签标识冲突，请换一个名称", { cause: error });
    }
  },
};

function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

export function toSkillView(row: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}): SkillView {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}
