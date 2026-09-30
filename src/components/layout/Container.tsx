import type { ElementType, HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Container —— 页面内容容器
 *
 * 对应设计系统中的 `.shell`：居中、限制最大宽度、左右留出响应式边距。
 * 页面内容一律放在 Container 内，不要自行写 max-width 与 padding。
 */

export type ContainerProps = {
  as?: ElementType;
  className?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "className" | "children">;

export function Container({ as, className, children, ...rest }: ContainerProps) {
  const Tag = (as ?? "div") as ElementType;

  return (
    <Tag className={cn("shell", className)} {...rest}>
      {children}
    </Tag>
  );
}
