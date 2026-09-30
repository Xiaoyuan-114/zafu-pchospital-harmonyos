/* 保证 src/data/doc-manifest.json 存在。
 *
 * 为什么需要它：
 *   `src/data/doc-manifest.json` 是 `pnpm docs:build` 的产物，已 gitignore、不进仓库；
 *   而 `src/lib/docs.ts` 是**静态 import** 它。文件不存在时，
 *   `next dev` 与 `next build`（`build:site`）会直接报
 *     Module not found: Can't resolve '@/data/doc-manifest.json'
 *   于是「只开发页面」的人克隆完仓库连 `pnpm dev` 都起不来
 *   （必须先跑 docs:build，而它需要 mdBook）。
 *
 * 这条脚本在文件缺失时写一份**占位清单**（空目录树），
 * 不需要 mdBook、不需要联网，让 `pnpm dev` 开箱可用。
 * 真实清单由 `pnpm docs:build` 生成并**覆盖**它。
 *
 * 挂载点（见 package.json）：
 *   - `postinstall`       新克隆装完依赖即可开发
 *   - `predev` / `prebuild:site`  文件被误删后的兜底
 *   （`build` 不需要，它先跑 docs:build 生成真实清单）
 *
 * 幂等：文件已存在就什么都不做。
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(projectRoot, "src", "data", "doc-manifest.json");

if (existsSync(manifestPath)) process.exit(0);

const placeholder = {
  meta: {
    title: "ZAFU-PCHospital-Doc",
    authors: ["RepentStar"],
    language: "zh-Hans-CN",
    repoUrl: "https://github.com/ZAFU-PCHospital/ZAFU-PCHospital-Doc",
    /* 明确标成占位，便于排查：真实清单里这里是文档仓库的提交 sha */
    sourceRevision: "placeholder",
    generatedAt: new Date().toISOString(),
    counts: { total: 0, ready: 0, pending: 0 },
  },
  tree: [],
  pages: [],
};

mkdirSync(path.dirname(manifestPath), { recursive: true });
writeFileSync(manifestPath, `${JSON.stringify(placeholder, null, 2)}\n`, "utf8");

console.log("[ensure-doc-manifest] 未找到文档清单，已写入占位清单（目录为空）。");
console.log("[ensure-doc-manifest] 需要真实目录时运行：pnpm docs:build（需要 mdBook）");
