import type { Metadata } from "next";
import { PageHead } from "@/components/layout/PageHead";
import { CreateRepairDraft } from "@/components/repairs/CreateRepairDraft";
import { Section } from "@/components/ui/Section";
import { repairCopy } from "@/config/repairs";
import { requireActiveMemberPage } from "@/lib/auth/member-page";
export const metadata: Metadata = { title: "新建维修记录" };
export default async function NewRepairPage() {
  await requireActiveMemberPage();
  return (
    <div className="repair-page">
      <PageHead
        id="new-repair-title"
        index="08"
        label={repairCopy.create.label}
        title={repairCopy.create.title}
        lead={repairCopy.create.lead}
      />
      <Section labelledBy="new-repair-panel">
        <h2 className="sr-only" id="new-repair-panel">
          创建维修草稿
        </h2>
        <CreateRepairDraft />
      </Section>
    </div>
  );
}
