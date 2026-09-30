import { getDb } from "@/lib/db/client";

/**
 * 技能标签数据访问（M3 任务书 §9）。
 *
 * 只负责读取与默认软删除过滤，不做权限、校验或事务。
 * M3 不提供技能库管理写能力（`/admin/skills` 属于 M6）。
 */

const skillSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  sortOrder: true,
  isActive: true,
} as const;

export type SkillRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

export const skillRepository = {
  /** 启用中且未软删除的技能，用于成员可选项与技能选择下拉。 */
  async listActive(): Promise<SkillRow[]> {
    return getDb().skill.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: skillSelect,
    });
  },

  /** 按 id 集合读取未软删除技能（含已停用），用于校验与回显历史关联。 */
  async listByIds(ids: readonly string[]): Promise<SkillRow[]> {
    if (ids.length === 0) return [];
    return getDb().skill.findMany({
      where: { id: { in: [...ids] }, deletedAt: null },
      select: skillSelect,
    });
  },

  /** 某成员当前生效的技能关联（未软删除），按技能排序。 */
  async listMemberSkills(memberProfileId: string): Promise<SkillRow[]> {
    const rows = await getDb().userSkill.findMany({
      where: { memberProfileId, deletedAt: null, skill: { deletedAt: null } },
      select: { skill: { select: skillSelect } },
    });
    return rows
      .map((row) => row.skill)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "zh-Hans-CN"));
  },
};
