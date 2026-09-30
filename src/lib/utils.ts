import type { CSSProperties } from "react";

/**
 * 拼接 className，过滤掉 false / null / undefined。
 * 项目刻意不引入 clsx / tailwind-merge：组件类名以设计系统的固定类为主，
 * 冲突合并需求很低，保持零额外依赖。
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * 生成进场动画的错位序号。
 * 对应设计系统中 `.reveal` 使用的 `--i` 变量。
 */
export function revealIndex(index: number): CSSProperties {
  return { "--i": index } as CSSProperties;
}

/**
 * 两位补零。
 * 设计系统里的编号一律是两位（01 / 02 ...），索引栏、章节头、列表序号共用。
 */
export function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}
