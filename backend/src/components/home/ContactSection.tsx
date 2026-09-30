import { ChannelList } from "@/components/ui/ChannelList";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHead } from "@/components/ui/SectionHead";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { contactChannels, quickLinks } from "@/config/site";

/**
 * ContactSection —— 首页「联系」区块
 *
 * 对应设计基准的 `.contact`：左右两列渠道列表。
 */

export function ContactSection() {
  return (
    <Section id="contact" labelledBy="contact-title" variant="plain" className="contact">
      <SectionHead index="04" label="Contact" />

      <SectionTitle id="contact-title">找到我们</SectionTitle>

      <div className="about__grid">
        <Reveal index={2}>
          <h3 className="eyebrow" style={{ margin: "0 0 var(--s-4)" }}>
            求助渠道
          </h3>
          <ChannelList items={contactChannels} />
        </Reveal>

        <Reveal index={3}>
          <h3 className="eyebrow" style={{ margin: "0 0 var(--s-4)" }}>
            常用入口
          </h3>
          <ChannelList items={quickLinks} />
        </Reveal>
      </div>
    </Section>
  );
}
