import { cn } from "@/lib/utils";

/**
 * Card —— 卡片容器
 *
 * 设计基准中「带边框的深色面板」只出现两种稳定形态：
 * - surface（默认）：`--surface-1` 底 + 1px `--line` 边框 + `--r-mid` 圆角
 *   用于文档预览面板、可复用的信息面板
 * - notice：信号黄描边 + 淡黄底，用于须知 / 提示
 *
 * 只有这两种。新增卡片前请先确认是否真的需要第三种形态，
 * 需要的话先补充到 docs/design-system.md。
 */

export type CardVariant = "surface" | "notice";

export type CardProps = {
  variant?: CardVariant;
  className?: string;
  children: React.ReactNode;
};

const variantClass: Record<CardVariant, string> = {
  surface: "card",
  notice: "notice",
};

export function Card({ variant = "surface", className, children }: CardProps) {
  return <div className={cn(variantClass[variant], className)}>{children}</div>;
}
