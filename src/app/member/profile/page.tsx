import type { Metadata } from "next";

import { MemberAnalytics } from "@/components/member/MemberAnalytics";
import { MemberProfileView } from "@/components/member/MemberProfileView";
import { Section } from "@/components/ui/Section";
import { memberCopy } from "@/config/member";
import { requireActiveMemberPage } from "@/lib/auth/member-page";

export const metadata: Metadata = { title: memberCopy.profile.title };

/** `/member/profile` —— 个人资料页（自己）。 */
export default async function MemberProfilePage() {
  const principal = await requireActiveMemberPage();

  return (
    <Section variant="page-head" className="member-workspace" labelledBy="member-profile-title">
      <MemberProfileView
        initialDisplayName={principal.displayName ?? memberCopy.common.fallbackName}
      />
      {/* M5：分类分布与 12 个月趋势，与工作台摘要共用同一统计口径 */}
      <MemberAnalytics />
    </Section>
  );
}
