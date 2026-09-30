import type { ReactNode } from "react";

import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/utils";

/**
 * Section —— 页面区块
 *
 * 对应设计系统中的 `.band`：统一的上下留白与底部分隔线。
 * 页面内容区块一律用它包裹，不要自行写 padding-block。
 *
 * 内页页面头请使用 `Section variant="page-head"`（不带 Container 内的额外留白）。
 */

export type SectionProps = {
  id?: string;
  /** 该区块的标题元素 id，用于 aria-labelledby */
  labelledBy?: string;
  /** band（默认，常规区块） / page-head（内页顶部）/ plain（无样式，仅语义） */
  variant?: "band" | "page-head" | "plain";
  /** 是否用 Container 包裹内容，默认 true */
  contained?: boolean;
  className?: string;
  children: ReactNode;
};

const variantClass = {
  band: "band",
  "page-head": "page-head",
  plain: "",
} as const;

export function Section({
  id,
  labelledBy,
  variant = "band",
  contained = true,
  className,
  children,
}: SectionProps) {
  return (
    <section id={id} className={cn(variantClass[variant], className)} aria-labelledby={labelledBy}>
      {contained ? <Container>{children}</Container> : children}
    </section>
  );
}
