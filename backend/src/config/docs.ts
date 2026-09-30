import { siteConfig } from "@/config/site";

/**
 * 技术文档入口页
 *
 * /docs 只负责把访客引导到同域 mdBook，并提供文档源码仓库入口。
 */
export const docsPage = {
  title: "技术文档",
  label: "Docs",
  lead: "电脑医院把日常维修与排障经验整理成公开文档，可在文档站中阅读、搜索并按章节浏览。",
  metadataDescription:
    "浙江农林大学电脑医院技术文档入口，可阅读维修与排障文档，或前往 GitHub 查看文档源文件。",
  handbookAction: {
    label: "进入技术文档",
    href: "/handbook/Intro.html",
  },
  repositoryAction: {
    label: "GitHub 文档仓库",
    href: siteConfig.docRepo.url,
  },
} as const;
