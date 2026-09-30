import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/layout/Container";
import { memberLoginLink } from "@/config/navigation";
import { siteConfig } from "@/config/site";

/**
 * Footer —— 全站统一页脚
 *
 * 对应设计基准的 `.footer`。首页与其他页面共用，不重复实现。
 *
 * 「成员登录」是次要账号入口（T-P2-4）：文案与 Header 共用 `memberLoginLink`，
 * 仅作低权重文字链，不进 `mainNav`、不做 solid 主按钮。文案已定为「成员登录」，与 Header 一致。
 */

/**
 * 页脚底部公示的备案号列表。
 *
 * 工信部与公安备案号都在全站页脚展示，数据来自同一份站点配置。
 */
const filingRecords = [
  {
    id: "mps",
    text: siteConfig.record.mps,
    href: siteConfig.record.mpsUrl,
    icon: siteConfig.record.mpsIcon,
  },
  { id: "icp", text: siteConfig.record.icp, href: siteConfig.record.icpUrl, icon: null },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <Container>
        <div className="footer__row">
          <span>{siteConfig.name} · 志愿技术服务</span>
          <span>{siteConfig.nameEn}</span>
          <span>{year}</span>
        </div>
        <p className="footer__entry">
          <Link href={memberLoginLink.href}>{memberLoginLink.label}</Link>
        </p>
        <p className="footer__note">
          本站为浙江农林大学电脑医院社团官方站点，页面中涉及的文档目录与正文均来自公开文档仓库{" "}
          <a href={siteConfig.docRepo.url} target="_blank" rel="noopener noreferrer">
            {siteConfig.docRepo.name}
          </a>
          （作者 {siteConfig.docRepo.author}，由 mdBook 构建）。
        </p>
        <p className="footer__record">
          {filingRecords.map((item) => (
            <a key={item.id} href={item.href} target="_blank" rel="noopener noreferrer">
              {item.icon && (
                <Image
                  src={item.icon}
                  width={18}
                  height={20}
                  alt=""
                  aria-hidden="true"
                  unoptimized
                />
              )}
              {item.text}
            </a>
          ))}
        </p>
      </Container>
    </footer>
  );
}
