import type { Metadata } from "next";

import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHead } from "@/components/ui/SectionHead";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { docsPage } from "@/config/docs";

export const metadata: Metadata = {
  title: docsPage.title,
  description: docsPage.metadataDescription,
};

/**
 * /docs 技术文档入口
 *
 * 技术文档由独立仓库维护，并在官网构建时生成到同域 /handbook/，
 * 本页只保留文档站主入口与 GitHub 源文件仓库入口。
 */
export default function DocsPage() {
  return (
    <Section variant="page-head" labelledBy="docs-page-title">
      <div className="mb-s-5 gap-x-s-5 gap-y-s-2 flex flex-wrap items-center">
        <SectionHead className="mb-0 min-w-0 flex-1" index="05" label={docsPage.label} />
        <Reveal className="ml-auto" index={1}>
          <Button variant="ghost" icon="github" href={docsPage.repositoryAction.href} external>
            {docsPage.repositoryAction.label}
          </Button>
        </Reveal>
      </div>

      <SectionTitle id="docs-page-title" as="h1" index={1}>
        {docsPage.title}
      </SectionTitle>
      <Reveal as="p" className="lead" index={2}>
        {docsPage.lead}
      </Reveal>
      <Reveal className="mt-s-6" index={3}>
        <Button variant="solid" icon="book" href={docsPage.handbookAction.href}>
          {docsPage.handbookAction.label}
        </Button>
      </Reveal>
    </Section>
  );
}
