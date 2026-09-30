import { memberCopy } from "@/config/member";
import type { SkillView } from "@/types/contracts";

/**
 * MemberSkillList —— 技能标签（只读展示态）
 *
 * 工作台、个人资料页与他人主页共用。空集合显示明确空态文案，不占位假数据。
 */

export type MemberSkillListProps = {
  skills: readonly SkillView[];
  /** 空态文案（工作台与个人资料页的措辞略有不同） */
  emptyLabel?: string;
};

export function MemberSkillList({ skills, emptyLabel = memberCopy.dashboard.noSkills }: MemberSkillListProps) {
  if (!skills.length) {
    return <p className="member-section__note">{emptyLabel}</p>;
  }

  return (
    <ul className="member-skills">
      {skills.map((skill) => (
        <li className="member-tag" key={skill.id}>
          {skill.name}
        </li>
      ))}
    </ul>
  );
}
