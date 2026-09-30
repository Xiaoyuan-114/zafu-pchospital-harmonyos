import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

/**
 * robots.txt（构建期生成）
 *
 * 只放行公开内容。后台、成员工作台、账号页与全部接口都不该被搜索引擎收录 ——
 * 它们对未登录访客只会跳转到登录页，收录进去只是把无效地址塞进索引。
 * 这份屏蔽名单与 `sitemap.ts` 收录的页面正好互补，改一处要同时看另一处。
 */

const DISALLOW = ["/api/", "/admin/", "/account/", "/member/", "/login", "/register/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...DISALLOW],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
