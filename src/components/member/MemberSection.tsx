import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * MemberSection —— 成员工作台/主页内的一致区块
 *
 * 标题 + 英文小标签（可选）+ 备注/脚注（可选）。标题 id 用于区块 aria-labelledby。
 */

export type MemberSectionProps = {
  /** 标题元素 id，供外层 `<section aria-labelledby>` 引用 */
  id: string;
  title: string;
  /** 英文小标签，沿用全站 `.sec-head__en` 的书写习惯 */
  tag?: string;
  /** 标题下方的补充说明 */
  note?: string;
  /** 区块底部的脚注（如统计口径说明） */
  foot?: string;
  className?: string;
  children: ReactNode;
};

export function MemberSection({
  id,
  title,
  tag,
  note,
  foot,
  className,
  children,
}: MemberSectionProps) {
  return (
    <div className={cn("member-section", className)}>
      <header className="member-section__head">
        <h2 className="member-section__title" id={id}>
          {title}
        </h2>
        {tag ? <span className="member-section__tag">{tag}</span> : null}
      </header>
      {note ? <p className="member-section__note">{note}</p> : null}
      {children}
      {foot ? <p className="member-section__foot">{foot}</p> : null}
    </div>
  );
}
