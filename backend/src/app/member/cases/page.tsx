import type { Metadata } from "next";

import { CaseLibrary } from "@/components/cases/CaseLibrary";
import { PageHead } from "@/components/layout/PageHead";
import { Section } from "@/components/ui/Section";
import { casesCopy } from "@/config/cases";
import { requireActiveMemberPage } from "@/lib/auth/member-page";

export const metadata: Metadata = { title: casesCopy.title };

export default async function MemberCasesPage() {
  await requireActiveMemberPage();
  return (
    <>
      <PageHead
        id="member-cases-title"
        index="10"
        label={casesCopy.label}
        title={casesCopy.title}
        lead={casesCopy.lead}
      />
      <Section labelledBy="member-cases-content">
        <h2 className="sr-only" id="member-cases-content">
          {casesCopy.title}
        </h2>
        <CaseLibrary />
      </Section>
    </>
  );
}
