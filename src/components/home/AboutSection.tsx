import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHead } from "@/components/ui/SectionHead";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { aboutContent, principles } from "@/config/home";

/**
 * AboutSection —— 首页「关于」区块
 *
 * 对应设计基准的 `.about`：左侧叙述文字，右侧编号原则列表。
 * 完整介绍在 /about 页面，这里保持摘要。
 */

export function AboutSection() {
  return (
    <Section id="about" labelledBy="about-title">
      <SectionHead index="02" label="About" />

      <div className="sec-titlebar">
        <SectionTitle id="about-title">{aboutContent.title}</SectionTitle>
      </div>

      <div className="about__grid">
        <div>
          <Reveal as="p" className="lead" index={2}>
            {aboutContent.lead}
          </Reveal>
          <Reveal as="p" className="muted" index={3}>
            {aboutContent.muted}
          </Reveal>
        </div>

        <Reveal as="ol" className="principles" index={2}>
          {principles.map((item) => (
            <li key={item.title}>
              <div>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </div>
            </li>
          ))}
        </Reveal>
      </div>
    </Section>
  );
}
