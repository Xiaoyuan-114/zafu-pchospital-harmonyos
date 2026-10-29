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
  const start = source.indexOf("struct ForumFeed");
  const state = source
    .slice(start, source.indexOf("  @Builder", start))
    .replace("struct ForumFeed", "class ForumFeed")
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

type DetailCall = { method: string; args: unknown[] };
interface DetailApi {
  param: { postId: string };
  authenticated: boolean;
  disposed: boolean;
  navigated: boolean;
  detail: { id: string; actions: { canDelete: boolean } } | null;
  comments: Array<{ id: string; body: string }>;
  commentDraft: string;
  commentSending: boolean;
  deletePostOpen: boolean;
  deleteCommentId: string;
  errorText: string;
  aboutToDisappear(): void;
  load(): Promise<void>;
  sendComment(): Promise<void>;
  retryComment(): Promise<void>;
  confirmDeletePost(): Promise<void>;
  confirmDeleteComment(): Promise<void>;
}

/** 执行真实详情页状态与写请求生命周期；不实例化 ArkUI。 */
function detailHarness() {
  const source = readFileSync(
    "../app/entry/src/main/ets/features/forum/ForumPostDetailPage.ets",
    "utf8",
  );
  const start = source.indexOf("export struct ForumPostDetailPage");
  const state = source
    .slice(start, source.indexOf("  @Builder", start))
    .replace("export struct ForumPostDetailPage", "class ForumPostDetailPage")
    .replace(/@(State|Prop)\s+/g, "")
    .replace(/@Watch\('[^']+'\)\s*/g, "")
    + "\nnew ForumPostDetailPage();";
  const code = ts.transpileModule(state, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const calls: DetailCall[] = [];
  let commentKey = "";
  let releaseComment!: () => void;
  let sessionStamp = "1|user-a";
  let nextKey = 0;
  let postDeleteError: Error | null = null;
  const detail = runInNewContext(code, {
    ForumService: {
      detail: async (id: string) => {
        calls.push({ method: "detail", args: [id] });
        return {
          id,
          category: "GENERAL",
          title: "真实帖子",
          body: "正文",
          author: { id: "a", displayName: "客户" },
          images: [],
          commentCount: 0,
          createdAt: "2026-10-28T00:00:00.000Z",
          updatedAt: "2026-10-28T00:00:00.000Z",
          actions: { canDelete: true, canUploadImages: true, canComment: true },
        };
      },
      listComments: async () => ({ items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }),
      newCreateRequestKey: () => `comment-key-${++nextKey}`,
      createComment: (id: string, body: string, key: string) => {
        calls.push({ method: "comment", args: [id, body, key] });
        commentKey = key;
        return new Promise<void>((resolve) => {
          releaseComment = () => {
            calls.push({ method: "comment-resolved", args: [] });
            resolve();
          };
        });
      },
      deletePost: async (id: string) => {
        calls.push({ method: "delete-post", args: [id] });
        if (postDeleteError !== null) throw postDeleteError;
      },
      deleteComment: async (id: string) => {
        calls.push({ method: "delete-comment", args: [id] });
      },
    },
    SessionService: { sessionStamp: () => sessionStamp },
    ApiRequestError: class extends Error {
      constructor(public code: string, message: string) {
        super(message);
      }
    },
    isSessionExpiredCode: () => false,
  }) as DetailApi;
  detail.param = { postId: "post-1" };
  detail.authenticated = true;
  if (postDeleteError === null) {
    detail.detail = {
      id: "post-1",
      actions: { canDelete: true },
    };
  }
  return {
    detail,
    calls,
    commentKey: () => commentKey,
    releaseComment: () => releaseComment(),
    setSessionStamp: (value: string) => {
      sessionStamp = value;
    },
    setPostDeleteError: (error: Error | null) => {
      postDeleteError = error;
    },
  };
}

test("同一评论提交与重试复用幂等键，离开后的迟到回调不导航", async () => {
  const { detail, calls, commentKey, releaseComment } = detailHarness();
  detail.commentDraft = "同一条真实评论";
  const sending = detail.sendComment();
  assert.equal(calls.filter((call) => call.method === "comment").length, 1);
  const retry = detail.retryComment();
  assert.equal(calls.filter((call) => call.method === "comment").length, 1);
  assert.equal((calls[0].args[2] as string) === commentKey(), true);
  detail.aboutToDisappear();
  releaseComment();
  await Promise.all([sending, retry]);
  assert.equal(detail.navigated, false);
  assert.equal(detail.disposed, true);
});

test("删除帖子成功才返回并触发刷新；404 不保留旧正文", async () => {
  const { detail, calls } = detailHarness();
  await detail.load();
  assert.equal(detail.detail?.id, "post-1");
  detail.deletePostOpen = true;
  await detail.confirmDeletePost();
  assert.deepEqual(calls.at(-1), { method: "delete-post", args: ["post-1"] });
  assert.equal(detail.navigated, true);
  assert.equal(detail.detail, null);

  const second = detailHarness();
  const RequestError = class extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  };
  second.setPostDeleteError(new RequestError("FORUM_POST_NOT_FOUND", "帖子不存在或已删除"));
  second.detail.detail = { id: "missing", actions: { canDelete: true } };
  await second.detail.confirmDeletePost();
  assert.equal(second.detail.detail, null);
  assert.equal(second.detail.navigated, false);
});

test("删除评论只在服务端确认后移除本地项", async () => {
  const { detail, calls } = detailHarness();
  await detail.load();
  detail.comments = [{ id: "comment-1", body: "保留到确认成功" }];
  detail.deleteCommentId = "comment-1";
  await detail.confirmDeleteComment();
  assert.deepEqual(calls.at(-1), { method: "delete-comment", args: ["comment-1"] });
  assert.deepEqual(detail.comments, []);
  assert.equal(detail.deleteCommentId, "");
});

interface ComposeApi {
  savedId: string;
  category: string;
  title: string;
  body: string;
  pending: Array<{ fileName: string; mimeType: string; data: ArrayBuffer; uploadKey: string }>;
  createRequestKey: string;
  submitting: boolean;
  errorText: string;
  savedPostId: string;
  submit(): Promise<void>;
  pickImages(): Promise<void>;
}
interface MineApi {
  posts: FeedPost[];
  page: number;
  totalPages: number;
  loading: boolean;
  errorText: string;
  load(): Promise<void>;
  loadMore(): Promise<void>;
}

function composeHarness() {
  const source = readFileSync(
    "../app/entry/src/main/ets/features/forum/ForumComposePage.ets",
    "utf8",
  );
  const start = source.indexOf("export struct ForumComposePage");
  const state = source
    .slice(start, source.indexOf("  @Builder", start))
    .replace("export struct ForumComposePage", "class ForumComposePage")
    .replace(/@(State|Prop)\s+/g, "")
    .replace(/@Watch\('[^']+'\)\s*/g, "")
    + "\nnew ForumComposePage();";
  const code = ts.transpileModule(state, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const createCalls: unknown[] = [];
  const uploadCalls: unknown[][] = [];
  const compose = runInNewContext(code, {
    ForumService: {
      newCreateRequestKey: () => "create-once",
      newUploadKey: () => "upload-once",
      createPost: async (draft: unknown) => {
        createCalls.push(draft);
        return { id: "created-post" };
      },
      uploadImages: async (id: string, images: unknown[], keys: string[]) => {
        uploadCalls.push([id, images, keys]);
        return [];
      },
    },
    PhotoPicker: { pick: async () => [] },
    SessionService: { sessionStamp: () => "1|user-a" },
    ApiRequestError: class extends Error {},
    isSessionExpiredCode: () => false,
    FORUM_CATEGORY_GENERAL: "GENERAL",
    FORUM_CATEGORY_EXPERIENCE: "EXPERIENCE",
    FORUM_CATEGORY_QUESTION: "QUESTION",
  }) as ComposeApi;
  compose.category = "GENERAL";
  compose.title = "真实标题";
  compose.body = "真实正文";
  return { compose, createCalls, uploadCalls };
}

test("已建帖上传重试不重复创建，上传键稳定且成功后清空", async () => {
  const { compose, createCalls, uploadCalls } = composeHarness();
  compose.savedId = "post-1";
  compose.createRequestKey = "create-once";
  const image = { fileName: "one.png", mimeType: "image/png", data: new ArrayBuffer(1), uploadKey: "upload-once" };
  compose.pending = [image];
  await compose.submit();
  assert.equal(createCalls.length, 0);
  assert.equal(uploadCalls[0][0], "post-1");
  assert.equal((uploadCalls[0][1] as unknown[])[0], image);
  assert.deepEqual(Array.from(uploadCalls[0][2] as string[]), ["upload-once"]);
  assert.equal(compose.pending.length, 0);
  assert.equal(compose.savedPostId, "post-1");
});

test("首次发布只生成一个创建键并进入已保存详情", async () => {
  const { compose, createCalls } = composeHarness();
  await compose.submit();
  assert.equal(createCalls.length, 1);
  const draft = createCalls[0] as Record<string, string>;
  assert.equal(draft.category, "GENERAL");
  assert.equal(draft.title, "真实标题");
  assert.equal(draft.body, "真实正文");
  assert.equal(draft.createRequestKey, "create-once");
  assert.deepEqual(Object.keys(draft).sort(), ["body", "category", "createRequestKey", "title"]);
  assert.equal(compose.savedPostId, "created-post");
  assert.equal(compose.title, "");
  assert.equal(compose.body, "");
});

function mineHarness() {
  const source = readFileSync(
    "../app/entry/src/main/ets/features/forum/MyForumPostsPage.ets",
    "utf8",
  );
  const start = source.indexOf("export struct MyForumPostsPage");
  const state = source
    .slice(start, source.indexOf("  @Builder", start))
    .replace("export struct MyForumPostsPage", "class MyForumPostsPage")
    .replace(/@(State|Prop)\s+/g, "")
    .replace(/@Watch\('[^']+'\)\s*/g, "")
    + "\nnew MyForumPostsPage();";
  const code = ts.transpileModule(state, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const calls: number[] = [];
  const pages: FeedPage[] = [];
  const mine = runInNewContext(code, {
    ForumService: {
      listMine: async (page: number) => {
        calls.push(page);
        return pages.shift() ?? { items: [], pagination: { page, pageSize: 20, total: 0, totalPages: 0 } };
      },
    },
    ApiRequestError: class extends Error {},
    isSessionExpiredCode: () => false,
    ROUTE_FORUM_POST: "forum-post",
  }) as MineApi;
  return { mine, calls, pages };
}

test("我的帖子只按服务端本人分页读取并保留分页失败内容", async () => {
  const { mine, calls, pages } = mineHarness();
  pages.push(
    { items: [{ id: "mine-1", title: "本人帖子" }], pagination: { page: 1, pageSize: 20, total: 2, totalPages: 2 } },
    { items: [{ id: "mine-2", title: "第二页" }], pagination: { page: 2, pageSize: 20, total: 2, totalPages: 2 } },
  );
  await mine.load();
  await mine.loadMore();
  assert.deepEqual(calls, [1, 2]);
  assert.deepEqual(mine.posts.map((post) => post.id), ["mine-1", "mine-2"]);
});

test("发帖、评论和删除回调同时刷新主论坛列表与我的帖子", () => {
  const source = readFileSync("../app/entry/src/main/ets/features/home/HomePage.ets", "utf8");
  const compose = source.slice(
    source.indexOf("      } else if (name === ROUTE_FORUM_COMPOSE)"),
    source.indexOf("      } else if (name === ROUTE_MY_FORUM_POSTS)"),
  );
  const detail = source.slice(
    source.indexOf("      } else if (name === ROUTE_FORUM_POST)"),
    source.indexOf("      } else if (name === ROUTE_ACTIVITY_DETAIL"),
  );
  const callbacks = `${compose}\n${detail}`
    .replaceAll("ROUTE_FORUM_POST", "route")
    .replace("      } else if", "if")
    .replace("ForumComposePage", "captureCompose")
    .replace("ForumPostDetailPage", "captureDetail");
  let saved!: (postId: string) => void;
  let changed!: () => void;
  const captureCompose = (options: { onSaved: (postId: string) => void }) => {
    saved = options.onSaved;
  };
  const captureDetail = (options: { onChanged: () => void }) => {
    changed = options.onChanged;
  };
  const executable = ts.transpileModule(callbacks, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const sandbox = {
    pathStack: { pop() {} },
    activityRevision: 0,
    forumRefreshVersion: 0,
    openRoute() {},
    name: "forum-compose",
    ROUTE_FORUM_COMPOSE: "forum-compose",
    captureCompose,
    captureDetail,
    param: { postId: "post-1" },
  };
  runInNewContext(`const route = 'forum-post';\nconst home = this;\n${executable}\n`, sandbox);
  saved("created-post");
  sandbox.name = "forum-post";
  runInNewContext(executable, sandbox);
  changed();
  assert.equal(sandbox.activityRevision, 2);
  assert.equal(sandbox.forumRefreshVersion, 2);
});
