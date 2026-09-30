import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHead } from "@/components/ui/SectionHead";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { ServiceList } from "@/components/ui/ServiceList";
import { services } from "@/config/home";

/**
 * ServicesSection —— 首页「服务」区块
 *
 * 对应设计基准的 `.services`：横向条目列表，左侧编号、中间名称与描述、
 * 右侧文档状态标签。小屏下标签自动换到标题下方（见设计系统的响应式规则）。
 */

export function ServicesSection() {
  return (
    <Section id="services" labelledBy="services-title">
      <SectionHead index="03" label="Services" />

      <div className="sec-titlebar">
        <SectionTitle id="services-title">我们能处理什么</SectionTitle>
        <Reveal as="p" className="sec-note" index={2}>
          状态标签对应文档仓库里的实际完成度。标注「文档撰写中」的条目我们已经能做，只是整理成文的进度还没跟上。
        </Reveal>
      </div>

      <ServiceList items={services} />
    </Section>
  );
}
