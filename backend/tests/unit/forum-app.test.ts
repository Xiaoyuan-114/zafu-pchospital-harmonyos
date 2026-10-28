import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

type Call = {
  method: string;
  path: string;
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
};

type ImagePart = {
  name: string;
  contentType: string;
  fileName: string;
  data: ArrayBuffer;
};

interface ForumServiceApi {
  listPosts(category: string, query: string, page: number): Promise<unknown>;
  detail(id: string): Promise<unknown>;
  listComments(id: string, page: number): Promise<unknown>;
  listMine(page: number): Promise<unknown>;
  createPost(draft: {
    category: string;
    title: string;
    body: string;
    createRequestKey: string;
  }): Promise<unknown>;
  uploadImages(id: string, images: ImagePart[], keys: string[]): Promise<unknown>;
  createComment(id: string, body: string, key: string): Promise<unknown>;
  deletePost(id: string): Promise<unknown>;
  deleteComment(id: string): Promise<unknown>;
  imageBytes(path: string): Promise<ArrayBuffer>;
  newCreateRequestKey(): string;
  newUploadKey(): string;
}

/** 转译并执行真实 ArkTS 服务；仅替换网络、会话和平台工具。 */
function harness(initialToken = "") {
  const contract = readFileSync(
    "../app/entry/src/main/ets/features/forum/ForumContract.ets",
    "utf8",
  );
  const service = readFileSync(
    "../app/entry/src/main/ets/features/forum/ForumService.ets",
    "utf8",
  );
  const source = `${contract}\n${service}\nForumService;`
    .replace(/import[\s\S]*?from\s+['"][^'"]+['"];\s*/g, "")
    .replace(/export /g, "");
  const code = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const calls: Call[] = [];
  let token = initialToken;
  let stamp = "1|user-a";
  let tokenReader = async () => token;
  let uuid = 0;
  class RequestError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  }
  const page = {
    items: [],
    pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
  };
  const api = runInNewContext(code, {
    ApiClient: {
      getPage: async (_baseUrl: string, path: string, requestToken: string) => {
        calls.push({ method: "getPage", path, token: requestToken });
        return page;
      },
      get: async (_baseUrl: string, path: string, requestToken: string) => {
        calls.push({ method: "get", path, token: requestToken });
        return { id: "read-result" };
      },
      post: async (_baseUrl: string, path: string, body: string, requestToken: string) => {
        calls.push({ method: "post", path, body, token: requestToken });
        return { id: "write-result" };
      },
      postWithHeaders: async (
        _baseUrl: string,
        path: string,
        body: string,
        requestToken: string,
        headers: Record<string, string>,
      ) => {
        calls.push({ method: "postWithHeaders", path, body, token: requestToken, headers });
        return { id: "write-result" };
      },
      postMultipart: async (
        _baseUrl: string,
        path: string,
        body: ImagePart[],
        requestToken: string,
      ) => {
        calls.push({ method: "postMultipart", path, body, token: requestToken });
        return [];
      },
      del: async (_baseUrl: string, path: string, requestToken: string) => {
        calls.push({ method: "del", path, token: requestToken });
        return { deleted: true };
      },
      getBytes: async (_baseUrl: string, path: string, requestToken: string) => {
        calls.push({ method: "getBytes", path, token: requestToken });
        return new ArrayBuffer(1);
      },
    },
    ApiConfig: { getBaseUrl: () => "https://example.test" },
    ApiRequestError: RequestError,
    SessionStore: { readToken: () => tokenReader() },
    SessionService: { sessionStamp: () => stamp },
    util: {
      generateRandomUUID: () => `uuid-${++uuid}`,
      // Harmony util.TextEncoder.encodeInto 返回新字节数组；Node 同名方法签名不同。
      TextEncoder: class {
        encodeInto(value: string): Uint8Array {
          return new TextEncoder().encode(value);
        }
      },
    },
  }) as ForumServiceApi;
  return {
    service: api,
    calls,
    setToken(value: string) {
      token = value;
    },
    setStamp(value: string) {
      stamp = value;
    },
    setTokenReader(reader: () => Promise<string>) {
      tokenReader = reader;
    },
  };
}

test("公开帖子列表按后端顺序编码分类、关键词与固定分页", async () => {
  const { service, calls } = harness();
  await service.listPosts("QUESTION", "清灰", 2);
  assert.equal(
    calls[0].path,
    "/api/v1/forum/posts?category=QUESTION&q=%E6%B8%85%E7%81%B0&page=2&pageSize=20",
  );
  assert.equal(calls[0].method, "getPage");
  assert.equal(calls[0].token, "");
});

test("详情、评论与公开图片使用真实路径并允许游客空令牌", async () => {
  const { service, calls } = harness();
  await service.detail("post 1");
  await service.listComments("post 1", 3);
  await service.imageBytes("/api/v1/forum/images/image-1/content");
  assert.deepEqual(
    calls.map((call) => [call.method, call.path, call.token]),
    [
      ["get", "/api/v1/forum/posts/post%201", ""],
      ["getPage", "/api/v1/forum/posts/post%201/comments?page=3&pageSize=20", ""],
      ["getBytes", "/api/v1/forum/images/image-1/content", ""],
    ],
  );
});

test("创建、我的帖子、评论和删除只提交后端契约字段并携带现有会话", async () => {
  const { service, calls } = harness("token-a");
  const created = {
    category: "QUESTION",
    title: "清灰后的温度变化",
    body: "正文",
    createRequestKey: service.newCreateRequestKey(),
  };
  assert.equal(created.createRequestKey.length > 0, true);
  await service.createPost(created);
  await service.listMine(4);
  await service.createComment("post-1", "评论内容", "comment-key");
  await service.deletePost("post-1");
  await service.deleteComment("comment-1");

  assert.equal(calls[0].method, "post");
  assert.equal(calls[0].path, "/api/v1/forum/posts");
  assert.equal(calls[0].token, "token-a");
  const body = JSON.parse(calls[0].body as string) as Record<string, unknown>;
  assert.deepEqual(body, created);
  assert.equal(Object.hasOwn(body, "authorId"), false);
  assert.deepEqual(calls.slice(1).map((call) => [call.method, call.path, call.token]), [
    ["getPage", "/api/v1/forum/me/posts?page=4&pageSize=20", "token-a"],
    ["post", "/api/v1/forum/posts/post-1/comments", "token-a"],
    ["del", "/api/v1/forum/posts/post-1", "token-a"],
    ["del", "/api/v1/forum/comments/comment-1", "token-a"],
  ]);
  assert.deepEqual(JSON.parse(calls[2].body as string), {
    body: "评论内容",
    createRequestKey: "comment-key",
  });
});

test("图片与 uploadKeys 按每张图交替排列，键和文件元数据不丢失", async () => {
  const { service, calls } = harness("token-a");
  const images: ImagePart[] = [
    { name: "ignored", fileName: "first.png", contentType: "ignored", data: new ArrayBuffer(1) },
    { name: "ignored", fileName: "second.jpg", contentType: "ignored", data: new ArrayBuffer(2) },
  ];
  // PickedImage 的字段名是 mimeType；测试输入在调用前转换为相同形状。
  const picked = images.map((image, index) => ({
    fileName: image.fileName,
    mimeType: index === 0 ? "image/png" : "image/jpeg",
    data: image.data,
  }));
  const keys = [service.newUploadKey(), service.newUploadKey()];
  await service.uploadImages("post-1", picked as unknown as ImagePart[], keys);
  const upload = calls[0];
  assert.equal(upload.method, "postMultipart");
  assert.equal(upload.path, "/api/v1/forum/posts/post-1/images");
  assert.equal(upload.token, "token-a");
  const parts = upload.body as ImagePart[];
  assert.equal(parts.map((part) => part.name).join(","), "photos,uploadKeys,photos,uploadKeys");
  assert.equal(parts[0].fileName, "first.png");
  assert.equal(parts[0].contentType, "image/png");
  assert.equal(parts[2].fileName, "second.jpg");
  assert.equal(parts[2].contentType, "image/jpeg");
  const decoder = new TextDecoder();
  assert.equal(decoder.decode(parts[1].data), keys[0]);
  assert.equal(decoder.decode(parts[3].data), keys[1]);
  assert.equal(keys[0] === keys[1], false);
});

test("所有写操作在空令牌时本地拒绝，且不发出 HTTP 请求", async () => {
  const { service, calls } = harness();
  const draft = { category: "GENERAL", title: "标题", body: "正文", createRequestKey: "post-key" };
  const picked = [{ fileName: "one.png", mimeType: "image/png", data: new ArrayBuffer(1) }];
  const operations = [
    () => service.listMine(1),
    () => service.createPost(draft),
    () => service.uploadImages("post-1", picked as unknown as ImagePart[], ["image-key"]),
    () => service.createComment("post-1", "评论", "comment-key"),
    () => service.deletePost("post-1"),
    () => service.deleteComment("comment-1"),
  ];
  for (const operation of operations) {
    await assert.rejects(operation, (error: unknown) => {
      assert.equal((error as { code?: string }).code, "UNAUTHENTICATED");
      return true;
    });
  }
  assert.equal(calls.length, 0);
});

test("读取令牌期间会话代次变化时放弃写请求，不把旧令牌发给新会话", async () => {
  const { service, calls, setStamp, setTokenReader } = harness();
  let release!: (token: string) => void;
  setTokenReader(
    () =>
      new Promise<string>((resolve) => {
        release = resolve;
      }),
  );
  const pending = service.listMine(1);
  setStamp("2|user-b");
  release("stale-token");
  await assert.rejects(pending, (error: unknown) => {
    assert.equal((error as { code?: string }).code, "UNAUTHENTICATED");
    return true;
  });
  assert.equal(calls.length, 0);
});

type FeedPost = { id: string; title: string };
type FeedPage = {
  items: FeedPost[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};
type FeedRequest = {
  category: string;
  query: string;
  page: number;
  resolve: (page: FeedPage) => void;
  reject: (error: Error) => void;
};
interface ForumFeedApi {
  category: string;
  query: string;
  posts: FeedPost[];
  page: number;
  totalPages: number;
  errorText: string;
  load(): Promise<void>;
  loadMore(): Promise<void>;
  search(): Promise<void>;
  clearSearch(): Promise<void>;
  selectCategory(category: string): Promise<void>;
}

/** 执行真实 ForumFeed 状态方法；ArkUI 构建区和图片组件不进入沙箱。 */
function feedHarness() {
  const source = readFileSync(
    "../app/entry/src/main/ets/features/forum/ForumFeed.ets",
    "utf8",
  );
  const start = source.indexOf("export struct ForumFeed");
  const state = source
    .slice(start, source.indexOf("  @Builder", start))
    .replace("export struct ForumFeed", "class ForumFeed")
    .replace(/@(State|Prop)\s+/g, "")
    .replace(/@Watch\('[^']+'\)\s*/g, "")
    + "\nnew ForumFeed();";
  const code = ts.transpileModule(state, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const requests: FeedRequest[] = [];
  const feed = runInNewContext(code, {
    ForumService: {
      listPosts: (category: string, query: string, page: number) =>
        new Promise<FeedPage>((resolve, reject) => {
          requests.push({ category, query, page, resolve, reject });
        }),
    },
    ApiRequestError: class extends Error {},
    isSessionExpiredCode: () => false,
    FORUM_CATEGORY_GENERAL: "GENERAL",
    FORUM_CATEGORY_EXPERIENCE: "EXPERIENCE",
    FORUM_CATEGORY_QUESTION: "QUESTION",
    ROUTE_FORUM_POST: "forum-post",
    ROUTE_FORUM_COMPOSE: "forum-compose",
  }) as ForumFeedApi;
  const result = (page: number, ids: string[], totalPages = 1): FeedPage => ({
    items: ids.map((id) => ({ id, title: `帖子 ${id}` })),
    pagination: { page, pageSize: 20, total: ids.length, totalPages },
  });
  return { feed, requests, result };
}

test("论坛新关键词请求不会被迟到旧响应覆盖", async () => {
  const { feed, requests, result } = feedHarness();
  feed.query = "硬盘";
  const first = feed.load();
  feed.query = "网络";
  const second = feed.load();
  assert.deepEqual(requests.map((request) => request.query), ["硬盘", "网络"]);

  requests[0].resolve(result(1, ["old"]));
  await first;
  assert.notDeepEqual(feed.posts, [{ id: "old", title: "帖子 old" }]);
  requests[1].resolve(result(1, ["new"]));
  await second;
  assert.deepEqual(feed.posts, [{ id: "new", title: "帖子 new" }]);
  assert.equal(feed.page, 1);
});

test("论坛分页失败保留已加载内容，重试只请求下一页", async () => {
  const { feed, requests, result } = feedHarness();
  feed.query = "清灰";
  const first = feed.load();
  requests[0].resolve(result(1, ["p1", "p2"], 3));
  await first;

  const second = feed.loadMore();
  requests[1].reject(new Error("网络中断"));
  await second;
  assert.equal(feed.posts.length, 2);
  assert.equal(feed.page, 1);
  assert.equal(feed.errorText, "论坛加载失败，请重试");

  const retry = feed.loadMore();
  requests[2].resolve(result(2, ["p3"], 3));
  await retry;
  assert.deepEqual(requests.map((request) => [request.query, request.page]), [
    ["清灰", 1],
    ["清灰", 2],
    ["清灰", 2],
  ]);
  assert.deepEqual(feed.posts.map((post) => post.id), ["p1", "p2", "p3"]);
});

test("论坛搜索提交、清空和分类切换都使用最新真实查询", async () => {
  const { feed, requests, result } = feedHarness();
  feed.query = "  固态 硬盘  ";
  const search = feed.search();
  assert.equal(requests[0].query, "固态 硬盘");
  requests[0].resolve(result(1, [], 0));
  await search;
  assert.equal(feed.posts.length, 0);

  const cleared = feed.clearSearch();
  requests[1].resolve(result(1, [], 0));
  await cleared;
  const category = feed.selectCategory("QUESTION");
  requests[2].resolve(result(1, [], 0));
  await category;
  assert.deepEqual(requests.map((request) => [request.category, request.query]), [
    ["GENERAL", "固态 硬盘"],
    ["GENERAL", ""],
    ["QUESTION", ""],
  ]);
});
