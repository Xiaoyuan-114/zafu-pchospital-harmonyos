import Link from "next/link";
import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

/**
 * 工作台视觉件（成员 / 管理首页共用）
 *
 * 三个原语：待办数字卡（`DashStat`）、快捷入口砖（`DashTile`）、分组目录（`DashGroup`）。
 * 颜色全部走语义令牌，两种主题自动适配；「需要行动」的卡用 `--active` 的
 * accent 淡底表达，数字本身是主要信息，颜色只是强化。
 */

export type DashStatProps = {
  label: string;
  /** null = 暂时查不出来（显示「—」，不画成 0） */
  value: number | null;
  unit?: string;
  hint?: string;
  href: string;
  /** 有需要行动的数量（> 0 且语义上要求用户处理）时给 accent 淡底 */
  active?: boolean;
  /** 大数字 aria 标签覆盖（读屏时把单位与含义说全） */
  ariaLabel?: string;
};

export function DashStat({ label, value, unit, hint, href, active, ariaLabel }: DashStatProps) {
  return (
    <Link
      className={cn("dash-stat", active && value !== null && value > 0 && "dash-stat--active")}
      href={href}
      aria-label={ariaLabel}
    >
      <span className="dash-stat__value">
        {value === null ? "—" : value}
        {unit && value !== null ? <span className="dash-stat__unit">{unit}</span> : null}
      </span>
      <span className="dash-stat__label">{label}</span>
      {hint ? <span className="dash-stat__hint">{hint}</span> : null}
    </Link>
  );
}

export function DashStats({ children }: { children: ReactNode }) {
  return <div className="dash-stats">{children}</div>;
}

export type DashTileProps = {
  icon: IconName;
  label: string;
  desc?: string;
  href: string;
};

export function DashTile({ icon, label, desc, href }: DashTileProps) {
  return (
    <Link className="dash-tile" href={href}>
      <span className="dash-tile__icon">
        <Icon name={icon} />
      </span>
      <span className="dash-tile__text">
        <span className="dash-tile__label">{label}</span>
        {desc ? <span className="dash-tile__desc">{desc}</span> : null}
      </span>
    </Link>
  );
}

export type DashGroupProps = {
  title: string;
  /** 区块无障碍名 id（标题元素 id） */
  id: string;
  children: ReactNode;
  className?: string;
};

export function DashGroup({ title, id, children, className }: DashGroupProps) {
  return (
    <section className={cn("dash-group", className)} aria-labelledby={id}>
      <h2 className="dash-group__title" id={id}>
        {title}
      </h2>
      <div className="dash-group__grid">{children}</div>
    </section>
  );
}
