import type { Metadata } from "next";
import type { ReactNode } from "react";

import { MemberShell } from "@/components/member/MemberShell";
import { memberCopy } from "@/config/member";
import { requireMemberPage } from "@/lib/auth/member-page";

export const metadata: Metadata = {
  title: memberCopy.shell.title,
  robots: { index: false, follow: false },
};

/**
 * `/member/**` 的统一外壳（T-P0-3）。
 *
 * 守卫用较弱的 `requireMemberPage()`（登录 + 已改密），与 `/member` 首页空态一致；
 * 需要有效成员档案的子页继续各自调用 `requireActiveMemberPage()`。
 * 外壳放 layout：客户端切页侧栏不重建、AccountMenu 在所有子页可达。
 */
export default async function MemberLayout({ children }: { children: ReactNode }) {
  const principal = await requireMemberPage();
  return (
    <MemberShell displayName={principal.displayName ?? null}>{children}</MemberShell>
  );
}
