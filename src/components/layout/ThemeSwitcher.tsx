"use client";

import { useSyncExternalStore } from "react";

import { Icon, type IconName } from "@/components/ui/Icon";
import { themeModeOptions, type ThemeMode } from "@/config/theme";
import {
  getServerThemeModeSnapshot,
  getThemeModeSnapshot,
  setThemeMode,
  subscribeThemeMode,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * ThemeSwitcher —— 显示模式切换入口
 *
 * 设计约束：
 * - 只暴露「正常 / 深色」两个模式，不出现 Swiss Cobalt、Black Yellow 这类具体主题名。
 * - 形态沿用设计系统的克制风格：2px 圆角、1px 描边、等宽小字，
 *   当前项用强调色文字 + 描边 + 淡底标记，不做成设置面板。
 * - 无障碍：`role="group"` + `aria-pressed` 让当前状态可被读出，
 *   键盘可 Tab 到达、可用空格/回车触发，最小点按面积与其他控件一致。
 *
 * 状态来源是 `src/lib/theme.ts` 里的外部 store，不是 React state ——
 * 因为桌面索引栏与移动端索引浮层会各自渲染一个实例，两者必须保持同步。
 * 服务端快照返回默认模式，hydration 后再切到真实值，因此不会产生 mismatch 警告。
 */

const MODE_ICONS: Record<ThemeMode, IconName> = {
  normal: "sun",
  dark: "moon",
};

export type ThemeSwitcherProps = {
  /** 桌面左侧索引栏（纵向堆叠）或移动端索引浮层（横向一行） */
  variant?: "rail" | "inline";
  /** 传入时作为组件根的附加类名 */
  className?: string;
};

export function ThemeSwitcher({ variant = "inline", className }: ThemeSwitcherProps) {
  const mode = useSyncExternalStore(
    subscribeThemeMode,
    getThemeModeSnapshot,
    getServerThemeModeSnapshot,
  );

  return (
    <div
      className={cn("theme-switch", `theme-switch--${variant}`, className)}
      role="group"
      aria-label="显示模式"
    >
      {themeModeOptions.map((option) => {
        const current = mode === option.mode;
        return (
          <button
            key={option.mode}
            className="theme-switch__btn"
            type="button"
            aria-pressed={current}
            aria-label={`切换到${option.label}模式`}
            title={`${option.label}模式`}
            onClick={() => setThemeMode(option.mode)}
          >
            <Icon name={MODE_ICONS[option.mode]} />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
