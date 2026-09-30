import type { ReactNode } from "react";

import { cn, revealIndex } from "@/lib/utils";

/**
 * SectionTitle —— 区块主标题
 *
 * 对应设计系统中的 `.sec-title`（H2 层级）。
 * 内页的页面标题同理使用 H1 + `.sec-title`，保持同一视觉层级。
 */

export type SectionTitleProps = {
  id?: string;
  /** H1 用于内页页面标题，H2 用于区块标题 */
  as?: "h1" | "h2" | "h3";
  /** 进场错位序号 */
  index?: number;
  className?: string;
  children: ReactNode;
};

export function SectionTitle({ id, as = "h2", index = 1, className, children }: SectionTitleProps) {
  const Tag = as;

  return (
    <Tag id={id} className={cn("sec-title reveal", className)} style={revealIndex(index)}>
      {children}
    </Tag>
  );
}
