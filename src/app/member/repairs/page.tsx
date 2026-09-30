import { Suspense } from "react";
import type { Metadata } from "next";
import { RepairList } from "@/components/repairs/RepairList";
import { Section } from "@/components/ui/Section";
import { repairResultLabels, repairStatusLabels } from "@/config/repairs";
import { requireActiveMemberPage } from "@/lib/auth/member-page";
export const metadata: Metadata = { title: "维修记录" };
export default async function RepairsPage() {
  await requireActiveMemberPage();
  return (
    <Section variant="page-head" className="repair-workspace" labelledBy="repairs-title">
      <Suspense fallback={null}>
        <RepairList statusLabels={repairStatusLabels} resultLabels={repairResultLabels} />
      </Suspense>
    </Section>
  );
}
