"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AccountMenu } from "@/components/layout/AccountMenu";
import { ShellTabBar, type ShellTab } from "@/components/layout/ShellTabBar";
import { Icon } from "@/components/ui/Icon";
import {
  MEMBER_NOTIFICATIONS_CHANGED_EVENT,
  memberCopy,
  memberNav,
} from "@/config/member";

/**
 * 成员端导航（工作台重构版）
 *
 * 桌面（≥1100px）：左侧栏，9 个入口按「概览 / 维修 / 互动 / 账户」平铺，
 * 足部只有账号菜单。窄屏：侧栏收成顶部一条（品牌 + 账号菜单），
 * 导航交给底部固定的标签栏（工作台 / 维修 / 新增 / 消息 / 我的），
 * 活动 / 案例库 / 收藏 / 排行从工作台首页的快捷入口进。
 *
 * 「消息通知」的未读数同时显示在侧栏条目与底部「消息」标签上：
 * 挂载时取一次，收到 `MEMBER_NOTIFICATIONS_CHANGED_EVENT`（列表页标记已读 / 删除后
 * 派发）时刷新。角标是增强信息，请求失败就静默不显示。
 *
 * 渲染在 `src/app/member/layout.tsx`：客户端切页侧栏不重建、角标不丢。
 * prefetch 按意图触发（hover / focus / touchstart），挂载不全量预取。
 */

export type MemberNavProps = {
  /** 服务端已认证的展示名，交给账号菜单做首屏乐观渲染 */
  displayName?: string | null;
};

function isCurrent(pathname: string, href: string): boolean {
  if (href === "/member") return pathname === "/member";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MemberNav({ displayName = null }: MemberNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const shell = memberCopy.shell;
  const [unread, setUnread] = useState<number | null>(null);

  const loadUnread = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/member/notifications?status=UNREAD&pageSize=1", {
        cache: "no-store",
      });
      const json = await response.json();
      if (json?.success && typeof json.data?.unreadCount === "number") {
        setUnread(json.data.unreadCount);
      }
    } catch {
      // 角标是增强信息：失败静默，不影响导航本身。
    }
  }, []);

  useEffect(() => {
    void loadUnread();
    const onChanged = () => void loadUnread();
    window.addEventListener(MEMBER_NOTIFICATIONS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(MEMBER_NOTIFICATIONS_CHANGED_EVENT, onChanged);
  }, [loadUnread]);

  const tabs: readonly ShellTab[] = [
    { href: "/member", label: "工作台", icon: "home", exact: true },
    { href: "/member/repairs", label: "维修", icon: "fileText" },
    { href: "/member/repairs/new", label: "新增", icon: "plus", primary: true },
    { href: "/member/notifications", label: "消息", icon: "bell", badge: unread },
    { href: "/member/profile", label: "我的", icon: "user" },
  ];

  return (
    <>
      <nav className="member-nav" aria-label={shell.navLabel}>
        <Link className="member-nav__brand" href="/member" prefetch={false}>
          <span className="member-nav__brand-en">{shell.titleEn}</span>
          <span className="member-nav__brand-cn">{shell.title}</span>
        </Link>

        <div className="member-nav__groups">
          {memberNav.map((group) => (
            <div key={group.id} className="member-nav__group">
              <p className="member-nav__group-title">{group.title}</p>
              <ul className="member-nav__list">
                {group.items.map((item) => {
                  const current = isCurrent(pathname, item.href);
                  const badge =
                    item.href === "/member/notifications" && unread !== null && unread > 0
                      ? unread
                      : null;
                  return (
                    <li key={item.href}>
                      <Link
                        className="member-nav__link"
                        href={item.href}
                        prefetch={false}
                        onMouseEnter={() => router.prefetch(item.href)}
                        onFocus={() => router.prefetch(item.href)}
                        aria-current={current ? "page" : undefined}
                      >
                        <span className="nav-icon">
                          <Icon name={item.icon ?? "fileText"} />
                        </span>
                        <span className="member-nav__label">{item.label}</span>
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

        <div className="member-nav__foot">
          <AccountMenu variant="nav" initialDisplayName={displayName ?? null} />
        </div>
      </nav>

      <ShellTabBar tabs={tabs} ariaLabel={shell.tabbarLabel} />
    </>
  );
}
