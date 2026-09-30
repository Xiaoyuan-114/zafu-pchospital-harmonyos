import type { Metadata } from "next";

import { PageHead } from "@/components/layout/PageHead";
import { GalleryCarousel } from "@/components/ui/GalleryCarousel";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHead } from "@/components/ui/SectionHead";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { ServiceList } from "@/components/ui/ServiceList";
import { aboutPage, aboutSections, galleryOptions, gallerySlides } from "@/config/about";
import { principles, services } from "@/config/home";
import { contactQr } from "@/config/site";

export const metadata: Metadata = {
  title: "关于电脑医院",
  description: "浙江农林大学电脑医院社团介绍、现场图集、服务范围与联系方式。志愿性计算机技术服务，不收费。",
};

/**
 * /about 关于电脑医院
 *
 * 内容结构：我们是谁（叙述 + 服务原则 + 现场图集 + 社团档案）→ 服务范围 → 联系方式。
 *
 * 排版原则：三个区块各有自己的构图，不套同一套模板。
 * - 我们是谁：左叙述 / 右原则（主次分栏）→ 整幅图集 → 资料卡式档案
 * - 服务范围：编辑式大编号列表
 * - 联系方式：大字号群号收束，二维码辅助
 * 字体、色彩、间距、线条与编号体系仍全部来自设计系统，未新增视觉语言。
 * 动画每个区块最多一次整体进入，避免一屏连续多个淡入。
 */
export default function AboutPage() {
  return (
    <>
      <PageHead
        id="about-page-title"
        index="03"
        label="About"
        title={aboutPage.title}
        lead={aboutPage.lead}
      />

      {/* ---------------------------------------------------- 我们是谁 */}
      <Section id="intro" labelledBy="about-intro-title">
        <SectionHead index={aboutSections.intro.index} label={aboutSections.intro.label} />
        <div className="sec-titlebar">
          <SectionTitle id="about-intro-title">{aboutSections.intro.title}</SectionTitle>
        </div>

        {/* 左叙述（主体）/ 右三条原则（附注），一次整体进入 */}
        <Reveal className="about__lead">
          <div className="about__grid">
            <div>
              {aboutPage.intro.map((paragraph, index) => (
                <p className={index === 0 ? "lead" : "muted"} key={paragraph}>
                  {paragraph}
                </p>
              ))}
            </div>

            <ol className="principles">
              {principles.map((item) => (
                <li key={item.title}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>

        {/* 现场图集：整幅大图 + 编辑式信息栏 */}
        <Reveal className="mt-s-8">
          <GalleryCarousel
            slides={gallerySlides}
            autoPlayMs={galleryOptions.autoPlayMs}
            variant="editorial"
          />
        </Reveal>

        {/* 社团档案：资料卡式键值对，与服务原则明显区分 */}
        <div className="archive mt-s-8">
          <p className="archive__note">{aboutPage.archiveNote}</p>
          <dl className="archive__list">
            {aboutPage.archive.map((item) => (
              <div className="archive__row" key={item.key}>
                <dt className="archive__key">{item.key}</dt>
                {typeof item.value === "string" ? (
                  <dd className="archive__val">{item.value}</dd>
                ) : (
                  /* 条目多于一行的字段（如「荣誉」）逐行渲染，行距交给 CSS */
                  <dd className="archive__val">
                    <span className="archive__val-list">
                      {item.value.map((line) => (
                        <span key={line}>{line}</span>
                      ))}
                    </span>
                  </dd>
                )}
              </div>
            ))}
          </dl>
        </div>
      </Section>

      {/* ---------------------------------------------------- 服务范围 */}
      <Section id="scope" labelledBy="about-scope-title">
        <SectionHead index={aboutSections.scope.index} label={aboutSections.scope.label} />
        <div className="sec-titlebar">
          <SectionTitle id="about-scope-title">{aboutSections.scope.title}</SectionTitle>
          <Reveal as="p" className="sec-note">
            {aboutPage.scopeNote}
          </Reveal>
        </div>

        <ServiceList items={services} variant="editorial" />
      </Section>

      {/* ---------------------------------------------------- 联系方式 */}
      <Section id="contact" labelledBy="about-contact-title">
        <SectionHead index={aboutSections.contact.index} label={aboutSections.contact.label} />
        <div className="sec-titlebar">
          <SectionTitle id="about-contact-title">{aboutSections.contact.title}</SectionTitle>
        </div>

        <Reveal className="contact-close">
          <div>
            <p className="contact-close__ask">有电脑问题？</p>
            <p className="contact-close__num">{contactQr.hint}</p>
            <p className="contact-close__hint">
              扫码或搜索群号加入。群内可以问问题、约现场问诊，也能看到每次问诊活动的通知。
            </p>
          </div>

          <figure className="contact-close__qr">
            {/* 两张同码不同底色的图都在 DOM 里，由 CSS 按主题显示其中一张。
                隐藏的那张是 display:none，不会进入无障碍树，也不会被重复朗读。 */}
            {/* eslint-disable-next-line @next/next/no-img-element -- 静态资源，尺寸固定，无需 next/image */}
            <img
              className="qr-img qr-img--light"
              src={contactQr.srcLight}
              alt={contactQr.alt}
              loading="lazy"
              decoding="async"
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- 同上，深色主题取图 */}
            <img
              className="qr-img qr-img--dark"
              src={contactQr.src}
              alt={contactQr.alt}
              loading="lazy"
              decoding="async"
            />
            <figcaption>{contactQr.caption}</figcaption>
          </figure>
        </Reveal>
      </Section>
    </>
  );
}
