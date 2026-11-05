import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

/** 执行实际 ArkUI 页面的状态方法；只去掉 UI 构建部分和装饰器，平台/网络使用模拟依赖。 */
interface PageState {
  orders: { id: string }[];
  showForm: boolean;
  formDirty: boolean;
  formBusy: boolean;
  formPendingRetry: boolean;
  leaveConfirmOpen: boolean;
  formNotice: string;
  noticeText: string;
  status: string;
  loadingMore: boolean;
  hasMore: boolean;
  currentPage: number;
  detailOpen: boolean;
  detailTargetId: string;
  detailRequestSeq: number;
  detailLoading: boolean;
  selected: { id: string } | null;
  handleDetailBack(): boolean;
  closeForm(): void;
  discardForm(): void;
  load(): Promise<void>;
  loadMore(): Promise<void>;
  switchStatus(status: string): void;
  afterSubmit(): Promise<void>;
  onChanged: () => void;
  submitOrder(request: object, idempotencyKey: string): Promise<void>;
}

test("报修草稿返回先确认，取消确认保留表单，明确放弃后返回列表", () => {
  const page = pageWithList(async () => []);
  page.showForm = true;
  page.formDirty = true;
  assert.equal(page.handleDetailBack(), true);
  assert.equal(page.leaveConfirmOpen, true);
  assert.equal(page.showForm, true);
  assert.equal(page.handleDetailBack(), true);
  assert.equal(page.leaveConfirmOpen, false);
  assert.equal(page.formDirty, true);
  page.handleDetailBack();
  page.closeForm();
  assert.equal(page.showForm, false);
  assert.equal(page.formDirty, false);
  assert.equal(page.handleDetailBack(), false);
});

test("空表单直接返回，提交中禁止退出，待确认提交返回时要求确认", () => {
  const page = pageWithList(async () => []);
  page.showForm = true;
  assert.equal(page.handleDetailBack(), true);
  assert.equal(page.showForm, false);
  page.showForm = true;
  page.formBusy = true;
  assert.equal(page.handleDetailBack(), true);
  assert.equal(page.showForm, true);
  assert.equal(page.formNotice, "正在提交，请稍候");
  page.formBusy = false;
  page.formPendingRetry = true;
  assert.equal(page.handleDetailBack(), true);
  assert.equal(page.leaveConfirmOpen, true);
});

test("结果未知后离开表单时切换到全部，方便查找可能已提交的单据", async () => {
  const requested: string[] = [];
  const page = pageWithList(async (status) => { requested.push(status); return []; });
  page.showForm = true;
  page.formPendingRetry = true;
  page.status = "COMPLETED";
  page.discardForm();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(page.showForm, false);
  assert.equal(page.status, "");
  assert.deepEqual(requested, [""]);
});

test("详情系统返回先回列表并作废在途详情；列表返回交还导航", () => {
  const page = pageWithList(async () => []);
  page.detailOpen = true;
  page.detailTargetId = "order-A";
  page.selected = { id: "order-A" };
  page.detailLoading = true;
  const before = page.detailRequestSeq;
  assert.equal(page.handleDetailBack(), true);
  assert.equal(page.detailOpen, false);
  assert.equal(page.selected, null);
  assert.equal(page.detailTargetId, "");
  assert.equal(page.detailLoading, false);
  assert.equal(page.detailRequestSeq, before + 1);
  assert.equal(page.handleDetailBack(), false);
});

function pageWithList(
  listMine: (status: string, page: number) => Promise<{ id: string }[]>,
  submit: () => Promise<void> = async () => {},
): PageState {
  const source = readFileSync(
    "../app/entry/src/main/ets/features/repair/RepairOrdersPage.ets",
    "utf8",
  );
  const stateMethods = source
    .slice(0, source.indexOf("  @Builder"))
    .replace(/import[\s\S]*?from\s+['"][^'"]+['"];\s*/g, "")
    .replace("@Component", "")
    .replace("export struct RepairOrdersPage", "class RepairOrdersPage")
    .replace(/@State\s+/g, "");
  const script = ts.transpileModule(`${stateMethods}\n}\nnew RepairOrdersPage();`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return runInNewContext(script, {
    RepairOrderService: { listMine, submit },
    ApiRequestError: class extends Error {},
    isSessionExpiredCode: () => false,
    isNetworkErrorCode: () => false,
  }) as PageState;
}

test("报修成功后通知服务设备刷新，失败时不通知", async () => {
  let fail = true;
  let changes = 0;
  const page = pageWithList(async () => [], async () => { if (fail) throw Error("offline"); });
  page.onChanged = () => { changes++; };
  await assert.rejects(page.submitOrder({}, "same-key"));
  assert.equal(changes, 0);
  fail = false;
  await page.submitOrder({}, "same-key");
  assert.equal(changes, 1);
});

test("从已完成筛选提交后回到全部并显示新单，切换筛选清除成功提示", async () => {
  const requested: string[] = [];
  const page = pageWithList(async (status) => {
    requested.push(status);
    return status === "" ? [{ id: "new-order" }] : [];
  });
  page.status = "COMPLETED";
  page.showForm = true;
  page.noticeText = "提交成功";
  await page.afterSubmit();
  assert.equal(page.status, "");
  assert.deepEqual(requested, [""]);
  assert.equal(page.orders[0]?.id, "new-order");
  page.switchStatus("COMPLETED");
  assert.equal(page.noticeText, "");
});

test("提交成功发生在首次列表请求期间：排队刷新显示新单，普通重复点击不额外请求", async () => {
  let resolveInitial: (orders: { id: string }[]) => void = () => {
    throw new Error("尚未发起首次请求");
  };
  const initial = new Promise<{ id: string }[]>((resolve) => {
    resolveInitial = resolve;
  });
  let calls = 0;
  const page = pageWithList(() => {
    calls += 1;
    return calls === 1 ? initial : Promise.resolve([{ id: "new-order" }]);
  });
  const loading = page.load();
  await page.load();
  assert.equal(calls, 1, "普通重复点击仍然防重");
  page.showForm = true;
  await page.afterSubmit();
  assert.equal(page.showForm, false);
  assert.equal(calls, 1, "等待正在进行的请求结束，不并发刷新");
  resolveInitial([]);
  await loading;
  assert.equal(calls, 2, "提交后的刷新必须执行");
  assert.equal(page.orders[0]?.id, "new-order", "最终列表必须展示新提交的报修单");
});

test("首次列表未返回时切换状态：旧范围不回填，结束后读取最终选中的真实状态", async () => {
  let resolveInitial!: (orders: { id: string }[]) => void;
  const initial = new Promise<{ id: string }[]>((resolve) => {
    resolveInitial = resolve;
  });
  const requested: string[] = [];
  const page = pageWithList((status) => {
    requested.push(status);
    return requested.length === 1 ? initial : Promise.resolve([{ id: "completed-order" }]);
  });
  const loading = page.load();
  page.switchStatus("SUBMITTED");
  page.switchStatus("COMPLETED");
  resolveInitial([{ id: "old-range-order" }]);
  await loading;
  assert.deepEqual(requested, ["", "COMPLETED"]);
  assert.equal(page.orders[0]?.id, "completed-order");
});

test("加载更多时切换状态：迟到旧页不混入新列表，也不覆盖新范围的分页结果", async () => {
  let resolveOld!: (orders: { id: string }[]) => void;
  const oldPage = new Promise<{ id: string }[]>((resolve) => {
    resolveOld = resolve;
  });
  const page = pageWithList((status, pageNumber) => {
    if (pageNumber === 2) return oldPage;
    return Promise.resolve(
      status === "COMPLETED" ? [{ id: "completed-order" }] : [{ id: "initial-order" }],
    );
  });
  await page.load();
  page.hasMore = true;
  const loadingMore = page.loadMore();
  page.switchStatus("COMPLETED");
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(page.loadingMore, false);
  resolveOld([{ id: "late-old-order" }]);
  await loadingMore;
  assert.equal(page.orders.length, 1);
  assert.equal(page.orders[0]?.id, "completed-order");
  assert.equal(page.currentPage, 1);
  assert.equal(page.hasMore, false);
});
