import type { Metadata } from "next";

import { MemberRepairActivityList } from "@/components/repair-activities/MemberRepairActivityList";
import { Section } from "@/components/ui/Section";
import { memberRepairActivitiesCopy } from "@/config/repair-activities";
import { requireActiveMemberPage } from "@/lib/auth/member-page";

export const metadata: Metadata = { title: memberRepairActivitiesCopy.list.title };

export default async function MemberRepairActivitiesPage() {
  await requireActiveMemberPage();
  const copy = memberRepairActivitiesCopy.list;
  return (
    <Section variant="page-head" className="member-workspace" labelledBy="member-activities-title">
      <header className="member-page-head">
        <p className="member-section__tag">{copy.label}</p>
        <h1 className="sec-title" id="member-activities-title">
          {copy.title}
        </h1>
        <p className="muted">{copy.lead}</p>
      </header>
      <MemberRepairActivityList />
    </Section>
  );
}
