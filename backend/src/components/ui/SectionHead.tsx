import { cn } from "@/lib/utils";

import { Reveal } from "./Reveal";

/**
 * SectionHead —— 章节头
 *
 * 对应设计系统中的 `.sec-head`：编号 + 走线 + 英文标签。
 * 编号沿用「两位数字」的展示规则，与页面的主序号体系保持一致。
 */

export type SectionHeadProps = {
  /** 两位编号，例如 "02" */
  index: string;
  /** 英文标签，例如 "About" */
  label: string;
  className?: string;
};

export function SectionHead({ index, label, className }: SectionHeadProps) {
  return (
    <Reveal as="header" className={cn("sec-head", className)}>
      <span className="sec-head__num">{index}</span>
      <span className="sec-head__rule" aria-hidden="true" />
      <span className="sec-head__en">{label}</span>
    </Reveal>
  );
}
