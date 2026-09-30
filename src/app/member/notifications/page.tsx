import type { Metadata } from "next";

import { NotificationInbox } from "@/components/community/NotificationInbox";
import { PageHead } from "@/components/layout/PageHead";
import { Section } from "@/components/ui/Section";
import { communityCopy } from "@/config/community";
import { requireActiveMemberPage } from "@/lib/auth/member-page";

export const metadata: Metadata = { title: communityCopy.notifications.title };

export default async function MemberNotificationsPage() {
  await requireActiveMemberPage();
  const copy = communityCopy.notifications;
  return (
    <>
      <PageHead id="member-notifications-title" index="11" label={copy.label} title={copy.title} lead={copy.lead} />
      <Section labelledBy="member-notifications-content">
        <h2 className="sr-only" id="member-notifications-content">
          {copy.title}
        </h2>
        <NotificationInbox />
      </Section>
    </>
  );
}
