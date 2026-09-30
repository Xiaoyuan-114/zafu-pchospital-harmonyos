import type { Metadata } from "next";

import { RepairActivityList } from "@/components/repair-activities/RepairActivityList";
import { PageHead } from "@/components/layout/PageHead";
import { Section } from "@/components/ui/Section";
import { repairActivitiesPage } from "@/config/repair-activities";

export const metadata: Metadata = {
  title: repairActivitiesPage.title,
  description: repairActivitiesPage.lead,
};

export default function RepairActivitiesPage() {
  return (
    <>
      <PageHead
        id="repair-activities-page-title"
        index="02"
        label={repairActivitiesPage.label}
        title={repairActivitiesPage.title}
        lead={repairActivitiesPage.lead}
      />
      <Section labelledBy="repair-activities-page-title">
        <RepairActivityList />
      </Section>
    </>
  );
}
