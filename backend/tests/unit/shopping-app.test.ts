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
  total: number;
  errorText: string;
  failed: boolean;
  reload(): Promise<void>;
  loadMore(): Promise<void>;
  submitSearch(): void;
  clearSearch(): void;
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
          requests.push({ category, query, page, resolve, reject });
        }),
    },
    ApiRequestError: class extends Error {},
    isSessionExpiredCode: () => false,
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
  assert.deepEqual(feed.products, [{ id: "new" }]);
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
  assert.deepEqual(feed.products, [{ id: "server-only-match" }]);
  const more = feed.loadMore();
  requests[1].reject(new Error("网络失败"));
  await more;
  assert.deepEqual(feed.products, [{ id: "server-only-match" }]);
  assert.equal(feed.errorText, "网络失败");
});
