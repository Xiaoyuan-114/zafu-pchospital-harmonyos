import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as flow from "../../../app/entry/src/main/ets/features/knowledge/KnowledgeFlow";
import type { KnowledgeChatData, KnowledgeChatMessage } from "../../../app/entry/src/main/ets/features/knowledge/KnowledgeContract";

type DialogResult = { index: number };
interface ChatPage {
  messages: flow.ChatMessage[];
  inputText: string;
  sending: boolean;
  nextId: number;
  send(): Promise<void>;
  retry(id: number): Promise<void>;
  confirmClear(): Promise<void>;
  requestBack(): boolean;
  onBack: () => void;
  aboutToDisappear(): void;
  resizeForKeyboard(): void;
  restoreKeyboardMode(): void;
  getUIContext: () => object;
}
function pending<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function pageWith(sendChat: (question: string, history: KnowledgeChatMessage[]) => Promise<KnowledgeChatData>, dialog: () => Promise<DialogResult>, onScroll: () => void = () => {}): ChatPage {
  const source = readFileSync("../app/entry/src/main/ets/features/knowledge/KnowledgePage.ets", "utf8");
  const start = source.indexOf("export struct KnowledgePage");
  const methods = source.slice(start, source.indexOf("  @Builder", start))
    .replace("export struct KnowledgePage", "class KnowledgePage")
    .replace(/@State\s+/g, "");
  const script = ts.transpileModule(methods + "\n}\nnew KnowledgePage();", {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const page = runInNewContext(script, {
    ...flow, KnowledgeService: { sendChat }, Scroller: class { scrollEdge() { onScroll(); } },
    NavPathStack: class {}, NavPusher: class {}, ApiRequestError: class extends Error {},
    isSessionExpiredCode: () => false, Edge: { Bottom: 0 }, KeyboardAvoidMode: { RESIZE: 2 },
    MAX_HISTORY_MESSAGES: 8, MAX_MESSAGE_CHARS: 2000, MAX_QUESTION_CHARS: 1000,
    MAX_TOTAL_HISTORY_CHARS: 8000, setTimeout, clearTimeout,
  }) as ChatPage;
  page.getUIContext = () => ({ getPromptAction: () => ({ showDialog: dialog, showToast: () => {} }) });
  return page;
}
function result(): KnowledgeChatData {
  return { status: "answer", answer: "测试回答", clarifyingQuestion: null, citations: [], retrievalMode: "keyword",
    degradation: null, indexVersion: "test", evidenceCount: 0, notes: [] };
}

test("清空对话需确认；取消保留消息和输入", async () => {
  let choice = 0;
  const page = pageWith(async () => result(), async () => ({ index: choice }));
  page.messages = [flow.userMessage(1, "问题")]; page.inputText = "补充内容";
  await page.confirmClear();
  assert.equal(page.messages.length, 1); assert.equal(page.inputText, "补充内容");
  choice = 1; await page.confirmClear();
  assert.equal(page.messages.length, 0); assert.equal(page.inputText, "");
});

test("退出时保留草稿直到明确确认，空对话直接交还导航", async () => {
  let choice = 0, backs = 0;
  const page = pageWith(async () => result(), async () => ({ index: choice }));
  page.onBack = () => { backs++; };
  assert.equal(page.requestBack(), false);
  page.inputText = "未发送";
  assert.equal(page.requestBack(), true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(backs, 0); assert.equal(page.inputText, "未发送");
  choice = 1; assert.equal(page.requestBack(), true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(backs, 1);
});

test("系统取消确认弹窗后保留草稿，仍可再次请求退出", async () => {
  let attempts = 0, backs = 0;
  const page = pageWith(async () => result(), async () => {
    if (++attempts === 1) throw new Error("dismissed");
    return { index: 1 };
  });
  page.onBack = () => { backs++; }; page.inputText = "未发送";
  assert.equal(page.requestBack(), true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(page.inputText, "未发送"); assert.equal(backs, 0);
  assert.equal(page.requestBack(), true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(backs, 1);
});

test("清空或离开后迟到回答不能恢复对话", async () => {
  for (const leave of [false, true]) {
    const request = pending<KnowledgeChatData>();
    const page = pageWith(() => request.promise, async () => ({ index: 1 }));
    page.inputText = "开机黑屏"; const sending = page.send();
    assert.equal(page.sending, true);
    if (leave) page.aboutToDisappear(); else await page.confirmClear();
    request.resolve(result()); await sending;
    assert.equal(page.messages.length, 0); assert.equal(page.sending, false);
  }
});

test("重试较早的问题保留位置和后续消息，不强制跳到对话底部", async () => {
  let scrolls = 0;
  const page = pageWith(async () => result(), async () => ({ index: 0 }), () => { scrolls++; });
  page.messages = [flow.userMessage(1, "旧问题"), flow.failedMessage(2, "NETWORK_ERROR", "断网"), flow.userMessage(3, "新问题")];
  page.nextId = 4;
  await page.retry(2);
  await new Promise<void>((resolve) => setTimeout(resolve, 120));
  assert.equal(scrolls, 0);
  assert.equal(page.messages[1].text, "测试回答");
  assert.equal(page.messages[2].text, "新问题");
});

test("输入焦点调整键盘避让，退出后恢复原设置", () => {
  let mode = 1;
  const page = pageWith(async () => result(), async () => ({ index: 0 }));
  page.getUIContext = () => ({ getKeyboardAvoidMode: () => mode, setKeyboardAvoidMode: (next: number) => { mode = next; } });
  page.resizeForKeyboard(); assert.equal(mode, 2);
  page.aboutToDisappear(); assert.equal(mode, 1);
});
