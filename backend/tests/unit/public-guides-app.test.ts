import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { formatGuideContent } from "../../../app/entry/src/main/ets/features/knowledge/GuideReading";

test("指南表格、提示和图片引用适配窄屏，代码块保持原样", () => {
  const input = ["> [!WARNING]", "> 先断开电源。", "", "| 状态 | 操作 |", "| --- | --- |",
    "| **黑屏** | [排查](#排查) |", "", "![内存位置](./assets/ram.jpg)", "", "```sh", "echo '**raw**'", "", "", "echo end", "```"].join("\n");
  const text = formatGuideContent(input);
  assert.match(text, /警告：\n先断开电源/);
  assert.match(text, /状态：黑屏\n操作：排查（#排查）/);
  assert.match(text, /图片：内存位置（原文资源：\.\/assets\/ram\.jpg；当前无法显示）/);
  assert.match(text, /```sh\necho '\*\*raw\*\*'\n\n\necho end\n```/);
});

test("格式不规则的表格保留原文", () => {
  const input = "| 设备 | 状态 |\n| --- | --- |\n| 一列 |";
  assert.equal(formatGuideContent(input), input);
  const empty = "| 设备 | 状态 |\n| --- | --- |";
  assert.equal(formatGuideContent(empty), empty);
});

class ApiError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
interface GuidePage {
  detail: { title: string } | null;
  favoriteError: string;
  errorText: string;
  notice: string;
  selectedId: string;
  favorite(): Promise<void>;
}
function guidePage(favorite: () => Promise<void>): GuidePage {
  const source = readFileSync("../app/entry/src/main/ets/features/knowledge/PublicGuidesPage.ets", "utf8");
  const start = source.indexOf("export struct PublicGuidesPage");
  const methods = source.slice(start, source.indexOf("  @Builder", start))
    .replace("export struct PublicGuidesPage", "class PublicGuidesPage")
    .replace(/@(State|Prop)\s*/g, "");
  const script = ts.transpileModule(methods + "\n}\nnew PublicGuidesPage();", {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return runInNewContext(script, {
    Scroller: class {}, CommunityService: { favorite }, ApiRequestError: ApiError,
    isSessionExpiredCode: () => false,
  }) as GuidePage;
}

test("收藏暂时失败时保留正文并就地提示，可在原页重试", async () => {
  let calls = 0;
  const page = guidePage(async () => { if (++calls === 1) throw new ApiError("NETWORK_ERROR", "网络中断"); });
  page.detail = { title: "公开指南" }; page.selectedId = "guide-A";
  await page.favorite();
  assert.equal(page.detail?.title, "公开指南");
  assert.equal(page.favoriteError, "网络中断");
  assert.equal(page.errorText, "");
  await page.favorite();
  assert.equal(page.favoriteError, "");
  assert.equal(page.notice, "指南已收藏");
});

test("指南失效时清除正文并显示服务端提示", async () => {
  const page = guidePage(async () => { throw new ApiError("KNOWLEDGE_SOURCE_NOT_FOUND", "指南已更新"); });
  page.detail = { title: "公开指南" }; page.selectedId = "guide-A";
  await page.favorite();
  assert.equal(page.detail, null);
  assert.equal(page.errorText, "指南已更新");
});
