import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

test("商品列表把关键词、分类与分页一起发送给真实服务端", async () => {
  const source = readFileSync(
    "../app/entry/src/main/ets/features/shopping/ShoppingService.ets",
    "utf8",
  )
    .replace(/import[\s\S]*?from\s+['"][^'"]+['"];\s*/g, "")
    .replace(/export /g, "")
    + "\nShoppingService;";
  const code = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const calls: string[] = [];
  const service = runInNewContext(code, {
    ApiClient: {
      getPage: async (_base: string, path: string) => {
        calls.push(path);
        return { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } };
      },
    },
    ApiConfig: { getBaseUrl: () => "https://example.test" },
    SessionStore: { readToken: async () => "" },
  }) as {
    listProducts(category: string, query: string, page: number, pageSize: number): Promise<unknown>;
  };
  await service.listProducts("SECONDHAND", "固态 硬盘", 1, 20);
  assert.match(calls[0], /q=%E5%9B%BA%E6%80%81%20%E7%A1%AC%E7%9B%98/);
  assert.match(calls[0], /category=SECONDHAND/);
  assert.match(calls[0], /page=1&pageSize=20/);
});

type ShoppingRequest = {
  category: string;
  query: string;
  page: number;
  resolve: (value: { items: Array<{ id: string }>; pagination: { page: number; total: number } }) => void;
  reject: (error: Error) => void;
};
interface ShoppingFeed {
  products: Array<{ id: string }>;
  keyword: string;
  category: string;
  appliedKeyword: string;
  appliedCategory: string;
  total: number;
  errorText: string;
  failed: boolean;
  retainedErrorVisible(): boolean;
  onSessionExpired: () => void;
  reload(): Promise<void>;
  loadMore(): Promise<void>;
  submitSearch(): void;
  clearSearch(): void;
  clearAppliedCategory(): void;
  selectCategory(category: string): void;
}

function feedHarness() {
  const source = readFileSync(
    "../app/entry/src/main/ets/features/shopping/ShoppingPage.ets",
    "utf8",
  );
  const start = source.indexOf("export struct ShoppingPage");
  const state = source
    .slice(start, source.indexOf("  @Builder", start))
    .replace("export struct ShoppingPage", "class ShoppingPage")
    .replace(/@(State|Prop)\s+/g, "")
    .replace(/@Watch\('[^']+'\)\s*/g, "")
    + "\nnew ShoppingPage();";
  const code = ts.transpileModule(state, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const requests: ShoppingRequest[] = [];
  const feed = runInNewContext(code, {
    ShoppingService: {
      listProducts: (category: string, query: string, page: number) =>
        new Promise((resolve, reject) => {
          requests.push({
            category,
            query,
            page,
            resolve: (result) => resolve({
              ...result,
              items: result.items.map((item) => ({
                ...item,
                title: item.id,
                description: "真实测试商品",
                priceCents: 100,
                category: "SECONDHAND",
                condition: "九成新",
                stock: 1,
                status: "ON_SALE",
                pickupNote: null,
                seller: { id: "seller", displayName: "卖家" },
                images: [],
                coverUrl: null,
                delistReason: null,
                delistedAt: null,
                createdAt: "2026-10-28T00:00:00.000Z",
                updatedAt: "2026-10-28T00:00:00.000Z",
                actions: { canBuy: true, canEdit: false, canDelist: false, canUploadImages: false },
              })),
            }),
            reject,
          });
        }),
    },
    ApiRequestError: class extends Error {},
    isSessionExpiredCode: (code: string) => code === "AUTH_SESSION_EXPIRED",
    Scroller: class {},
    PAGE_SIZE: 20,
    shoppingMoney: (value: number) => `¥${value}`,
    shoppingCategoryLabel: (value: string) => value,
  }) as ShoppingFeed;
  return { feed, requests };
}

test("旧关键词响应不能覆盖新查询，清空后重新请求完整数据集", async () => {
  const { feed, requests } = feedHarness();
  feed.keyword = "硬盘";
  const first = feed.reload();
  feed.keyword = "网络";
  const second = feed.reload();
  requests[0].resolve({ items: [{ id: "old" }], pagination: { page: 1, total: 1 } });
  await first;
  assert.notDeepEqual(feed.products, [{ id: "old" }]);
  requests[1].resolve({ items: [{ id: "new" }], pagination: { page: 1, total: 1 } });
  await second;
  assert.equal(feed.products.length, 1);
  assert.equal(feed.products[0].id, "new");
  feed.clearSearch();
  assert.equal(requests[2].query, "");
});

test("分页失败保留真实已加载商品且不在本地过滤搜索结果", async () => {
  const { feed, requests } = feedHarness();
  feed.keyword = "固态";
  const loading = feed.reload();
  requests[0].resolve({
    items: [{ id: "server-only-match" }],
    pagination: { page: 1, total: 2 },
  });
  await loading;
  assert.equal(feed.products.length, 1);
  assert.equal(feed.products[0].id, "server-only-match");
  const more = feed.loadMore();
  requests[1].reject(new Error("网络失败"));
  await more;
  assert.equal(feed.products.length, 1);
  assert.equal(feed.products[0].id, "server-only-match");
  assert.equal(feed.errorText, "网络失败");
});

test("只输入未提交的新关键词时，分页沿用当前列表已应用的查询", async () => {
  const { feed, requests } = feedHarness();
  feed.keyword = "硬盘";
  const loading = feed.reload();
  requests[0].resolve({
    items: [{ id: "disk-result" }],
    pagination: { page: 1, total: 2 },
  });
  await loading;

  feed.keyword = "尚未提交的内存";
  const more = feed.loadMore();
  assert.deepEqual(
    { category: requests[1].category, query: requests[1].query, page: requests[1].page },
    { category: "", query: "硬盘", page: 2 },
  );
  requests[1].resolve({
    items: [{ id: "disk-page-two" }],
    pagination: { page: 2, total: 2 },
  });
  await more;
  assert.equal(feed.products.length, 2);
  assert.equal(feed.products[0].id, "disk-result");
  assert.equal(feed.products[1].id, "disk-page-two");
});

test("新分类请求失败后，分页仍沿用旧列表已应用的分类", async () => {
  const { feed, requests } = feedHarness();
  feed.keyword = "硅脂";
  feed.category = "CONSUMABLE";
  const loading = feed.reload();
  requests[0].resolve({
    items: [{ id: "consumable-result" }],
    pagination: { page: 1, total: 2 },
  });
  await loading;

  feed.selectCategory("SECONDHAND");
  requests[1].reject(new Error("筛选加载失败"));
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(feed.products.length, 1);
  assert.equal(feed.products[0].id, "consumable-result");

  const more = feed.loadMore();
  assert.deepEqual(
    { category: requests[2].category, query: requests[2].query, page: requests[2].page },
    { category: "CONSUMABLE", query: "硅脂", page: 2 },
  );
  requests[2].resolve({ items: [], pagination: { page: 2, total: 2 } });
  await more;

  feed.clearAppliedCategory();
  assert.equal(requests[3].category, "");
});

test("保留旧列表时刷新失败提供可见错误，但查询标注不变成失败的草稿", async () => {
  const { feed, requests } = feedHarness();
  feed.keyword = "硬盘";
  const loading = feed.reload();
  requests[0].resolve({ items: [{ id: "old-result" }], pagination: { page: 1, total: 1 } });
  await loading;

  feed.keyword = "内存";
  feed.submitSearch();
  requests[1].reject(new Error("刷新暂时失败"));
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(feed.products.length, 1);
  assert.equal(feed.products[0].id, "old-result");
  assert.equal(feed.failed, false);
  assert.equal(feed.errorText, "刷新暂时失败");
  assert.equal(feed.retainedErrorVisible(), true);
  assert.equal(feed.appliedKeyword, "硬盘");
});

test("保留旧列表时会话过期仍进入统一会话失效处理", async () => {
  const { feed, requests } = feedHarness();
  const loading = feed.reload();
  requests[0].resolve({ items: [{ id: "existing" }], pagination: { page: 1, total: 1 } });
  await loading;
  let expiredCalls = 0;
  feed.onSessionExpired = () => {
    expiredCalls += 1;
  };

  const refresh = feed.reload();
  requests[1].reject(Object.assign(new Error("登录状态已过期"), { code: "AUTH_SESSION_EXPIRED" }));
  await refresh;
  assert.equal(expiredCalls, 1);
  assert.equal(feed.failed, false);
  assert.equal(feed.errorText, "");
});

test("分页遇到会话过期同样进入统一会话失效处理", async () => {
  const { feed, requests } = feedHarness();
  const loading = feed.reload();
  requests[0].resolve({ items: [{ id: "first" }], pagination: { page: 1, total: 2 } });
  await loading;
  let expiredCalls = 0;
  feed.onSessionExpired = () => {
    expiredCalls += 1;
  };

  const more = feed.loadMore();
  requests[1].reject(Object.assign(new Error("登录状态已过期"), { code: "AUTH_SESSION_EXPIRED" }));
  await more;
  assert.equal(expiredCalls, 1);
  assert.equal(feed.failed, false);
  assert.equal(feed.errorText, "");
});
