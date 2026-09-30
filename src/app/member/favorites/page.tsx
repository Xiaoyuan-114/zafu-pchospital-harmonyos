import type { Metadata } from "next";

import { FavoriteList } from "@/components/community/FavoriteList";
import { PageHead } from "@/components/layout/PageHead";
import { Section } from "@/components/ui/Section";
import { communityCopy } from "@/config/community";
import { requireActiveMemberPage } from "@/lib/auth/member-page";

export const metadata: Metadata = { title: communityCopy.favorites.title };

export default async function MemberFavoritesPage() {
  await requireActiveMemberPage();
  const copy = communityCopy.favorites;
  return (
    <>
      <PageHead id="member-favorites-title" index="12" label={copy.label} title={copy.title} lead={copy.lead} />
      <Section labelledBy="member-favorites-content">
        <h2 className="sr-only" id="member-favorites-content">
          {copy.title}
        </h2>
        <FavoriteList />
      </Section>
    </>
  );
}
