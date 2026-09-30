import type { Metadata } from "next";

import { MemberRepairActivityBoard } from "@/components/repair-activities/MemberRepairActivityBoard";
import { Section } from "@/components/ui/Section";
import { memberRepairActivitiesCopy } from "@/config/repair-activities";
import { requireActiveMemberPage } from "@/lib/auth/member-page";

export const metadata: Metadata = { title: memberRepairActivitiesCopy.board.title };

export default async function MemberRepairActivityBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireActiveMemberPage();
  const { id } = await params;
  const copy = memberRepairActivitiesCopy.board;
  return (
    <Section
      variant="page-head"
      className="member-workspace"
      labelledBy="member-activity-board-title"
    >
      <header className="member-page-head">
        <p className="member-section__tag">{copy.label}</p>
        <h1 className="sec-title" id="member-activity-board-title">
          {copy.title}
        </h1>
      </header>
      <MemberRepairActivityBoard activityId={id} />
    </Section>
  );
}
