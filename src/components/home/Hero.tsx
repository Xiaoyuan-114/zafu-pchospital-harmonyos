import { DocReadout } from "@/components/docs/DocReadout";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { heroActions, heroContent } from "@/config/home";
import { revealIndex } from "@/lib/utils";

/**
 * Hero —— 首页首屏
 *
 * 对应设计基准的 `.hero`：巨型描边水印、两行标题进场、品牌字标、
 * 行动按钮组与右侧读数面板。视觉规则全部来自设计系统，这里只负责拼装。
 */

export function Hero() {
  const { repair, docs } = heroActions;

  return (
    <section className="hero" id="hero" aria-labelledby="hero-title">
      <span className="hero__glyph" aria-hidden="true">
        {heroContent.glyph}
      </span>
      <span className="hero__meta" aria-hidden="true">
        {heroContent.meta}
      </span>

      <Container className="hero__inner">
        <div>
          <p className="hero__tag">
            <i aria-hidden="true" />
            {heroContent.tag}
          </p>

          <h1 className="hero__title" id="hero-title">
            <span className="hl hl--sub" style={revealIndex(0)}>
              <span className="hl__in">{heroContent.titleSub}</span>
            </span>
            <span className="hl" style={revealIndex(1)}>
              <span className="hl__in">{heroContent.titleMain}</span>
            </span>
          </h1>

          <p className="hero__wordmark" aria-hidden="true">
            <span>{heroContent.wordmark}</span>
            <i />
          </p>
        </div>

        <div className="hero__body">
          <div>
            <Reveal as="p" className="hero__lead" index={1}>
              {heroContent.lead}
            </Reveal>

            <Reveal className="hero__actions" index={2}>
              {repair.href ? (
                <Button variant="solid" href={repair.href}>
                  {repair.label}
                </Button>
              ) : (
                /* href 为空：对应页面尚未就绪，渲染成原生 button，点击不跳转 */
                <Button variant="solid">{repair.label}</Button>
              )}
              <Button variant="ghost" href={docs.href} trailingIcon="chevronRight">
                {docs.label}
              </Button>
            </Reveal>

            <a className="hero__scroll" href="#about">
              <Icon name="arrowDown" />
              向下滚动
            </a>
          </div>

          <DocReadout
            title="内置文档仓库"
            tag="DOCS"
            index={3}
            footnote="数值读取自站点内置的文档仓库清单，随仓库重新生成而更新。"
          />
        </div>
      </Container>
    </section>
  );
}
