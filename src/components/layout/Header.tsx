"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { Icon } from "@/components/ui/Icon";
import { mainNav, memberLoginLink } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * Header —— 全站统一导航
 *
 * 严格对应设计基准的两套表现，二者不重复实现：
 * - 桌面（>= 1100px）：左侧固定竖排索引栏 `.rail`
 * - 移动 / 平板：顶部栏 `.topbar` + 全屏索引浮层 `.menu`
 *
 * 断点由设计系统统一决定，页面不要自行改动。
 * 导航项来自 src/config/navigation.ts，新增页面只改配置。
 * 「成员登录」是独立账号入口（T-P0-1），不进 mainNav。
 *
 * 显示模式切换入口（ThemeSwitcher）挂在两处导航的收尾位置：
 * 桌面索引栏底部、移动端顶栏右侧，两处共用同一份状态。
 */

function isCurrent(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  /* 路由变化后收起浮层 */
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  /* 浮层打开时锁定滚动、把焦点交给关闭按钮；关闭时归还焦点 */
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";

    if (open) {
      closeButtonRef.current?.focus();
    } else if (wasOpenRef.current) {
      openButtonRef.current?.focus();
    }
    wasOpenRef.current = open;

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  /* Esc 关闭 */
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      {/* ------------------------------------------------ 移动端顶栏 */}
      <header className="topbar">
        <Link className="topbar__brand" href="/">
          ZAFU<em>·</em>PC HOSPITAL
        </Link>
        <button
          ref={openButtonRef}
          className="topbar__toggle"
          type="button"
          aria-expanded={open}
          aria-controls="site-menu"
          onClick={() => setOpen(true)}
        >
          <Icon name="menu" />
          索引
        </button>
      </header>

      {/* -------------------------------------------- 移动端索引浮层 */}
      <div className="menu" id="site-menu" data-open={open ? "true" : "false"}>
        <button
          ref={closeButtonRef}
          className="menu__close"
          type="button"
          onClick={() => setOpen(false)}
        >
          <Icon name="close" />
          关闭
        </button>

        <nav aria-label="站点导航">
          <ol className="menu__list">
            {mainNav.map((item, i) => (
              <li
                className="menu__item"
                key={item.href}
                style={{ "--i": i } as React.CSSProperties}
              >
                <Link
                  className="menu__link"
                  href={item.href}
                  aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
                >
                  <span>{item.index}</span>
                  <strong>{item.label}</strong>
                </Link>
              </li>
            ))}
          </ol>
        </nav>

        {/* 成员登录：放在浮层底部（靠近主题切换），不进 mainNav 编号列表。 */}
        <div
          className="menu__item menu__login-row"
          style={{ "--i": mainNav.length } as React.CSSProperties}
        >
          <Link
            className="menu__login"
            href={memberLoginLink.href}
            aria-current={
              isCurrent(pathname, memberLoginLink.href) ? "page" : undefined
            }
          >
            {memberLoginLink.label}
          </Link>
        </div>

        {/* 显示模式切换：放在浮层里而不是顶栏 —— 顶栏在窄屏已被品牌字标与
            「索引」按钮占满，再加一个入口会挤压出横向溢出。 */}
        <div
          className="menu__item menu__foot"
          style={{ "--i": mainNav.length + 1 } as React.CSSProperties}
        >
          <span className="menu__foot-label">显示模式</span>
          <ThemeSwitcher variant="inline" />
        </div>
      </div>

      {/* ---------------------------------------------- 桌面左侧索引栏 */}
      <aside className="rail">
        <Link className="rail__brand" href="/" aria-label={`${siteConfig.name} · 回到首页`}>
          <b>PC</b>
          <span>ZAFU</span>
        </Link>

        <nav aria-label="站点导航">
          <ol className="rail__list">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link
                  className={cn("rail__link")}
                  href={item.href}
                  aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
                  title={`${item.index} ${item.label} · ${item.labelEn}`}
                >
                  <span className="rail__num">{item.index}</span>
                  <span className="rail__label">{item.shortLabel}</span>
                </Link>
              </li>
            ))}
          </ol>
        </nav>

        <div className="rail__foot">
          <Link
            className="rail__login"
            href={memberLoginLink.href}
            title={`${memberLoginLink.label} · ${memberLoginLink.labelEn}`}
            aria-current={
              isCurrent(pathname, memberLoginLink.href) ? "page" : undefined
            }
          >
            {memberLoginLink.label}
          </Link>
          <ThemeSwitcher variant="rail" />
          <div className="rail__meta" aria-hidden="true">
            <i />
            <span>ZAFU</span>
          </div>
        </div>
      </aside>
    </>
  );
}
