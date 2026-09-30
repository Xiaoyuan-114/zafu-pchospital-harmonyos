import { createElement, type CSSProperties, type ElementType, type ReactNode } from "react";

import { cn, revealIndex } from "@/lib/utils";

/**
 * Reveal —— 进场揭示容器
 *
 * 对应设计系统中的 `.reveal` + `--i` 错位序号。
 * 实际触发由 SiteEffects 里的 IntersectionObserver 负责，这里只负责标记与序号。
 * index 决定同一屏内多个元素的先后顺序（每级 70ms）。
 */

export type RevealTag =
  "div" | "p" | "span" | "li" | "header" | "ul" | "ol" | "section" | "article";

export type RevealProps = {
  as?: RevealTag;
  index?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export function Reveal({ as = "div", index = 0, className, style, children }: RevealProps) {
  const Tag = as as ElementType;

  return createElement(
    Tag,
    {
      className: cn("reveal", className),
      style: { ...revealIndex(index), ...style },
    },
    children,
  );
}
