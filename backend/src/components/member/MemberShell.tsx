import type { ReactNode } from "react";

import { MemberNav } from "@/components/member/MemberNav";

/**
 * MemberShell —— 成员端外壳（T-P0-3）
 *
 * 左导航 + 主内容槽，对标 `admin-shell`。渲染在 `app/member/layout.tsx`，
 * 客户端导航之间保持挂载，切页时侧栏不重建。
 */
export type MemberShellProps = {
  children: ReactNode;
  /** 服务端已认证的展示名，传给侧栏足部 AccountMenu */
  displayName?: string | null;
};

export function MemberShell({ children, displayName = null }: MemberShellProps) {
  return (
    <div className="member-shell">
      <MemberNav displayName={displayName} />
      <div className="member-shell__main">{children}</div>
    </div>
  );
}
