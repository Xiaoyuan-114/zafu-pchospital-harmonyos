import { siteConfig } from "@/config/site";
import rawManifest from "@/data/doc-manifest.json";

/**
 * 文档仓库清单
 *
 * 数据来源：src/data/doc-manifest.json
 * 该文件由文档仓库的构建脚本生成，描述 ZAFU-PCHospital-Doc 的目录树与条目状态。
 * 正式站点不重新实现文档系统，这里只做「入口展示」：读取清单、渲染目录、跳转到同域 mdBook。
 *
 * 更新清单的方式：运行 pnpm docs:build，从同一份文档源码构建正文并覆盖本文件。
 */

export type DocNodeKind = "page" | "pending" | "group";

export type DocNode = {
  kind: DocNodeKind;
  title: string;
  /** kind 为 page 时为文档路径；group 与 pending 为 null */
  path: string | null;
  /** kind 为 page 时为 mdBook 生成的站内 HTML 路径 */
  outputPath?: string;
  children?: DocNode[];
};

export type DocMeta = {
  title: string;
  authors: string[];
  language: string;
  repoUrl: string;
  /** 生成清单所使用的文档提交；本地工作树无法解析时为 local */
  sourceRevision?: string;
  /** ISO 8601 字符串 */
  generatedAt: string;
  counts: {
    /** 目录条目总数 */
    total: number;
    /** 已就绪条目数 */
    ready: number;
    /** 待撰写条目数 */
    pending: number;
  };
};

type RawManifest = {
  meta: DocMeta & { sourcePath?: string };
  tree: unknown;
};

const manifest = rawManifest as unknown as RawManifest;

/** 站点公开使用的文档清单元信息（刻意剔除 sourcePath 等本地构建信息）。 */
export const docMeta: DocMeta = {
  title: manifest.meta.title,
  authors: manifest.meta.authors ?? [],
  language: manifest.meta.language,
  repoUrl: manifest.meta.repoUrl,
  sourceRevision: manifest.meta.sourceRevision,
  generatedAt: manifest.meta.generatedAt,
  counts: manifest.meta.counts,
};

/** 目录树 */
export const docTree: DocNode[] = (manifest.tree as DocNode[]) ?? [];

/**
 * 把目录树摊平成「分组标题 + 条目」的线性列表，便于渲染。
 *
 * 顺序规则与设计基准 Demo 的 docs.js 保持一致：
 * - `kind === "group"` 的节点输出为分组标题，其子项继续平铺（不再嵌套缩进）
 * - 其他节点输出为条目；**如果它还带有 children，必须继续向下 walk**
 *   （清单里存在「尚未成文的分组下已有一部分成文页面」这种情况，
 *    例如「校园网」下挂着已就绪的「认证相关」，不能漏掉）
 */
export type DocListItem =
  | { type: "group"; title: string }
  | {
      type: "item";
      title: string;
      path: string | null;
      outputPath: string | null;
      pending: boolean;
    };

export function flattenDocTree(nodes: readonly DocNode[], into: DocListItem[] = []): DocListItem[] {
  for (const node of nodes) {
    if (node.kind === "group") {
      into.push({ type: "group", title: node.title });
      if (node.children?.length) flattenDocTree(node.children, into);
      continue;
    }

    const ready = Boolean(node.path && node.kind === "page");
    into.push({
      type: "item",
      title: node.title,
      path: node.path,
      outputPath: node.outputPath ?? null,
      pending: !ready,
    });

    if (node.children?.length) flattenDocTree(node.children, into);
  }
  return into;
}

/** 目录条目总数（不含分组标题），用于校验清单一致性。 */
export function countDocItems(nodes: readonly DocNode[]): number {
  return flattenDocTree(nodes).filter((item) => item.type === "item").length;
}

/** 把 ISO 时间格式化为「YYYY-MM-DD HH:mm」，用于读数面板。 */
export function formatGeneratedAt(iso: string): string {
  if (!iso) return "--";
  return iso
    .replace("T", " ")
    .replace(/\+08:00$/, "")
    .slice(0, 16);
}

/**
 * 生成某个文档条目在文档仓库中的地址。
 *
 * 该地址保留给“查看源文件”等 GitHub 外链；正文阅读使用 docPageUrl()。
 */
export function docFileUrl(path: string): string {
  const { url, branch } = siteConfig.docRepo;
  return `${url}/blob/${branch}/src/${path}`;
}

/** 生成 mdBook 正文在官网同域下的阅读地址。 */
export function docPageUrl(outputPath: string): string {
  const encodedPath = outputPath.replaceAll("\\", "/").split("/").map(encodeURIComponent).join("/");

  return `/handbook/${encodedPath}`;
}
