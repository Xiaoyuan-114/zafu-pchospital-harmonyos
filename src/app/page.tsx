import { ContactSection } from "@/components/home/ContactSection";
import { DocsSection } from "@/components/home/DocsSection";
import { Hero } from "@/components/home/Hero";
import { HomeActivityPreview } from "@/components/home/HomeActivityPreview";
import { ProcessSection } from "@/components/home/ProcessSection";
import { Ticker } from "@/components/home/Ticker";

/**
 * 首页
 *
 * 区块顺序：首屏 → 跑马灯 → 近场活动（R7，无未结束则整块隐藏）→ 流程 → 文档 → 联系。
 * 文案数据来自 src/config/home.ts 与 src/config/site.ts。
 */

export default async function HomePage() {
  return (
    <>
      <Hero />
      <Ticker />
      <HomeActivityPreview />
      <ProcessSection />
      <DocsSection />
      <ContactSection />
    </>
  );
}
