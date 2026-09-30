import type { Metadata } from "next";

import { AdminHome } from "@/components/admin/AdminHome";
import { Section } from "@/components/ui/Section";
import { adminCopy } from "@/config/admin";

export const metadata: Metadata = { title: adminCopy.title };

/**
 * 后台首页：待办数字带 + 全模块目录（见 `AdminHome`）。
 * 守卫在 `layout.tsx`（`requireAdminPage`），这里不再重复。
 */
export default function AdminHomePage() {
  return (
    <Section variant="page-head" className="admin-workspace" labelledBy="admin-home-title">
      <div className="admin-workspace__content">
        <AdminHome />
      </div>
    </Section>
  );
}
