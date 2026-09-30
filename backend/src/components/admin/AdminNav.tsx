"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AccountMenu } from "@/components/layout/AccountMenu";
import { ShellTabBar, type ShellTab } from "@/components/layout/ShellTabBar";
import { Icon } from "@/components/ui/Icon";
import { adminCopy, adminNavGroups } from "@/config/admin";
import type { AdminDashboardSummary } from "@/features/admin/admin-dashboard";

/**
 * 后台导航（工作台重构版）
 *
 * 桌面（≥1100px）：左侧栏，11 个模块按「待办 / 维修业务 / 成员与账号 / 内容配置 / 数据」
 * 平铺，足部只有账号菜单。窄屏：侧栏收成顶部一条（品牌 + 账号菜单），导航交给底部
 * 固定的标签栏（首页 / 审核 / 招募 / 成员 / 更多），其余 8 个模块收进「更多」抽屉。
 *
 * 「维修审核」与「招募审核」带待办角标（待审核数 / 待跟进报名数），
 * 侧栏条目与底部标签共用同一份数据：挂载时从 `/api/v1/admin/dashboard` 取一次，
 * 让管理员在后台任何页面都能看到积压。请求失败就不显示角标（角标是增强信息）。
 *
 * 渲染在 `src/app/admin/layout.tsx`：客户端切页侧栏不重建、角标不丢。
 * prefetch 按意图触发（hover / focus / touchstart），挂载不全量预取。
 */

export type AdminNavProps = {
  /** 服务端已认证的展示名，交给账号菜单做首屏乐观渲染 */
  displayName?: string | null;
};

/** 底部标签栏占位的 href；「更多」抽屉列出其余入口。 */
const TAB_HREFS = ["/admin", "/admin/repairs", "/admin/join-applications", "/admin/members"];

export function AdminNav({ displayName = null }: AdminNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/v1/admin/dashboard", { cache: "no-store" });
        const json = await response.json();
        if (!cancelled && json?.success) setSummary(json.data as AdminDashboardSummary);
      } catch {
        // 角标是增强信息：失败静默。
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const badges: Record<string, number | null> = {
    "/admin/repairs": summary?.repairsPending ?? null,
    "/admin/join-applications": summary?.recruitmentFollowup ?? null,
  };

  const tabs: readonly ShellTab[] = [
    { href: "/admin", label: "首页", icon: "home", exact: true },
    { href: "/admin/repairs", label: "审核", icon: "check", badge: badges["/admin/repairs"] },
    {
      href: "/admin/join-applications",
      label: "招募",
      icon: "clipboard",
      badge: badges["/admin/join-applications"],
    },
    { href: "/admin/members", label: "成员", icon: "users" },
  ];

  const moreGroups = adminNavGroups
    .map((group) => ({
      id: group.id,
      title: group.title,
      items: group.items.filter((item) => !TAB_HREFS.includes(item.href)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      <nav className="admin-nav" aria-label={adminCopy.navLabel}>
        <Link className="admin-nav__brand" href="/admin" prefetch={false}>
          <span className="admin-nav__brand-en">{adminCopy.titleEn}</span>
          <span className="admin-nav__brand-cn">{adminCopy.title}</span>
        </Link>

        <div className="admin-nav__groups">
          {adminNavGroups.map((group) => (
            <div key={group.id} className="admin-nav__group">
              <p className="admin-nav__group-title">{group.title}</p>
              <ul className="admin-nav__list">
                {group.items.map((item) => {
                  const current =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const raw = badges[item.href];
                  const badge = typeof raw === "number" && raw > 0 ? raw : null;
                  return (
                    <li key={item.href}>
                      <Link
                        className="admin-nav__link"
                        href={item.href}
                        prefetch={false}
                        onMouseEnter={() => router.prefetch(item.href)}
                        onFocus={() => router.prefetch(item.href)}
                        aria-current={current ? "page" : undefined}
                      >
                        <span className="nav-icon">
                          <Icon name={item.icon ?? "fileText"} />
                        </span>
                        <span className="admin-nav__label">{item.label}</span>
                        {badge !== null ? (
                          <span className="nav-badge">{badge > 99 ? "99+" : badge}</span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="admin-nav__foot">
          <AccountMenu variant="nav" initialDisplayName={displayName ?? null} />
        </div>
      </nav>

      <ShellTabBar
        tabs={tabs}
        ariaLabel={adminCopy.tabbarLabel}
        more={{
          label: adminCopy.moreLabel,
          menuLabel: adminCopy.moreMenuLabel,
          closeLabel: adminCopy.moreCloseLabel,
          groups: moreGroups,
        }}
      />
    </>
  );
}
