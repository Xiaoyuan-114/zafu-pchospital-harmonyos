/**
 * 站点级配置
 *
 * 全站共用的站点信息、外链与联系方式。组件中禁止硬编码这些内容，
 * 需要新增时先在这里补充字段，再在组件里引用。
 */

export type LinkItem = {
  /** 分类标签，显示为左侧的等宽英文/中文小标签 */
  kind: string;
  title: string;
  description: string;
  /** 有 href 时为可点击外链，无 href 时为静态展示条目 */
  href?: string;
  /** 内容待社团确认，界面会显示「待补充」标记 */
  pending?: boolean;
};

export const siteConfig = {
  name: "浙江农林大学电脑医院",
  shortName: "电脑医院",
  nameEn: "ZAFU PC HOSPITAL",
  tagline: "志愿技术服务 · 面向全校师生",

  description:
    "浙江农林大学电脑医院的社团综合服务平台。志愿性计算机技术服务：电脑散热模组深度清理、硬件故障排查、系统与软件问题处理、网络问题排查、计算机基础答疑。",

  /**
   * 正式站点地址（末尾不带斜杠）
   *
   * `layout.tsx` 的 `metadataBase`、`robots.txt` 与 `sitemap.xml` 都从这里取绝对地址，
   * 所以它必须是线上真实域名，不能填仓库地址 —— 否则爬虫与社交卡片拿到的全是 GitHub 链接。
   * 与服务器 `.env` 的 `APP_BASE_URL` 保持同一个域名（含 www 变体的白名单见
   * `src/lib/auth/request.ts`）。
   */
  url: "https://pczafu.cn",

  /** GitHub 组织 */
  githubOrg: "https://github.com/ZAFU-PCHospital",

  /** 技术文档仓库（mdBook 源文件） */
  docRepo: {
    name: "ZAFU-PCHospital-Doc",
    url: "https://github.com/ZAFU-PCHospital/ZAFU-PCHospital-Doc",
    author: "RepentStar",
    /** 目录条目外链使用的分支名，仓库改名或改用其他默认分支时改这里 */
    branch: "main",
  },

  /** 校园网相关常用入口 */
  campusLinks: {
    auth: "http://10.152.250.2/",
    selfService: "https://zfw.zafu.edu.cn/home",
  },

  /**
   * 备案信息（全站页脚依法公示，链接到备案系统供公众核对）
   *
   * `icp` 必须原样展示 —— 备案号里的每一个字符（含连字符与序号）都是备案信息的一部分，
   * 不要改写大小写、不要插空格、不要换行拆断。
   *
   * 公安联网备案号与图标已经下发，在页脚同 ICP 编号一起公示。
   */
  record: {
    /** 工业和信息化部 ICP 备案号（浙ICP备2026077959号-1） */
    icp: "浙ICP备2026077959号-1",
    /** 工信部备案系统，供公众查询核对 */
    icpUrl: "https://beian.miit.gov.cn",
    /** 公安机关联网备案号及查询页 */
    mps: "浙公网安备33018502002686号",
    mpsUrl: "https://beian.mps.gov.cn/#/query/webSearch?code=33018502002686",
    mpsIcon: "/public-security-filing.png",
  },
} as const;

/** 求助渠道（静态展示） */
export const contactChannels: readonly LinkItem[] = [
  {
    kind: "活动",
    title: "线下问诊活动",
    description: "具体时间地点不定期公布，请留意群内通知",
  },
  {
    kind: "线上",
    title: "QQ 群",
    description: "532502904 · 报名、咨询与活动通知都在群里",
  },
];

/**
 * 求助渠道二维码（与 contactChannels 的 QQ 群对应）
 *
 * 同一个码准备了两种底色版本，由主题决定显示哪一张：
 * - `src`      黑底黄码版，图片自带与深色主题同色的深底
 * - `srcLight` 原始浅底版，用于暖白纸面的正常模式
 *
 * 两个 `<img>` 都在服务端渲染，靠 CSS 按 `html[data-theme]` 切换 ——
 * 组件不需要判断当前是什么主题，也不产生 hydration 分支。
 */
export const contactQr = {
  src: "/qq-group-qrcode-accent.png",
  srcLight: "/qq-group-qrcode.jpg",
  alt: "浙江农林大学电脑医院 QQ 群二维码，群号 532502904",
  caption: "扫码加入 QQ 群",
  hint: "群号 532502904",
} as const;

/** 常用入口（外链） */
export const quickLinks: readonly LinkItem[] = [
  {
    kind: "校园网",
    title: "认证登录入口",
    description: "10.152.250.2 · 校内网络环境访问，注意选择正确的服务商",
    href: "http://10.152.250.2/",
  },
  {
    kind: "自助",
    title: "校园网自助服务",
    description: "自助下线设备、配置 MAC Auth、查看在线终端",
    href: "https://zfw.zafu.edu.cn/home",
  },
  {
    kind: "文档",
    title: "ZAFU-PCHospital-Doc",
    description: "文档源文件仓库，欢迎提交勘误与补充",
    href: "https://github.com/ZAFU-PCHospital/ZAFU-PCHospital-Doc",
  },
];

/** 页脚免责说明 */
export const footerNote =
  "本站为社团官方站点，页面中涉及的文档目录与正文均来自公开文档仓库 " +
  "ZAFU-PCHospital-Doc（作者 RepentStar，由 mdBook 构建）。";
