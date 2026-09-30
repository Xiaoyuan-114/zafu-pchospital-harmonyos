import type { Metadata } from "next";
import { PageHead } from "@/components/layout/PageHead";
import { RepairDetail } from "@/components/repairs/RepairDetail";
import { Section } from "@/components/ui/Section";
import {
  repairCopy,
  repairResultLabels,
  repairStatusLabels,
  repairTimelineLabels,
} from "@/config/repairs";
import { requireActiveMemberPage } from "@/lib/auth/member-page";
export const metadata: Metadata = { title: "维修记录详情" };
export default async function RepairDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireActiveMemberPage();
  const { id } = await params;
  return (
    <div className="repair-page">
      <PageHead
        id="repair-detail-title"
        index="08"
        label={repairCopy.detail.label}
        title={repairCopy.detail.title}
        lead={repairCopy.detail.lead}
      />
      <Section labelledBy="repair-detail-content">
        <h2 className="sr-only" id="repair-detail-content">
          维修记录内容
        </h2>
        <RepairDetail
          recordId={id}
          statusLabels={repairStatusLabels}
          resultLabels={repairResultLabels}
          timelineLabels={repairTimelineLabels}
        />
      </Section>
    </div>
  );
}
