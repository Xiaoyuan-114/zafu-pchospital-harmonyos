# HarmonyOS 前端全面打磨实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在上游草稿 PR #91 上完成真实论坛 App 与五个主页面/主要子流程打磨，以模拟器截图、HAP 构建和真实接口结果支撑审查。

**Architecture:** 保留论坛后端与既有业务，ArkTS 页面通过独立 ForumService 调用真实 API，活动 Tab 组合活动与论坛。公共导航、认证、上传、状态面板复用现有 core；选购和跨页视觉按差异修改，不重写维修、知识或交易。

**Tech Stack:** HarmonyOS 6.1.1 / API 24、ArkTS / ArkUI、Next.js / TypeScript、Prisma / MySQL、Node 内置 test + 已有 ETS 转译回归、DevEco Hvigor / hdc。

**Spec:** `docs/superpowers/specs/2026-10-28-harmonyos-frontend-polish-design.md`

## Global Constraints

- 客户五栏：首页｜活动｜服务｜选购｜我的；工作人员第三栏为工作台。知识在服务/工作台内，不恢复旧知识 Tab。
- 权限、作者/卖家/报修归属只由服务端确定；`RepairOrder`、`RepairRecord`、购物订单和论坛帖子不可混用。
- 不做假业务数据、假 AI、假支付、假公告/点赞/关注或占位完成页；未支持能力如实显示。
- 默认共享 API 不擅自修改或部署；论坛实机用本机独立课设库，不清库，不操作生产库，不调用收费模型充当 UI 验收。
- 不提交 `.env`、密钥、签名材料或本机任务文件；不推 main、不强推、不自行合并；最终更新原 PR #91。
- 每个改动页面在实际模拟器运行并截图，记录参考图及未覆盖状态；构建成功不等于安装或交互通过。
- 未改后端业务时只运行受影响回归与 CI 必要检查，不重跑全库、不做无关审计；AI 逻辑不改时不做收费模型评测。

## 文件职责

- `features/forum/ForumContract.ets`：帖子、评论、图片、参数 DTO 与中文标签。
- `features/forum/ForumService.ets`：论坛 HTTP、分页、创建、图片/评论幂等键与公开图片字节。
- `features/forum/ForumFeed.ets`：活动 Tab 内论坛搜索、分类、分页列表。
- `features/forum/ForumPostDetailPage.ets`：帖子、评论、图片和删除。
- `features/forum/ForumComposePage.ets`：发布、待上传图片与重试恢复。
- `features/forum/MyForumPostsPage.ets`：本人帖子与详情入口。
- `features/activity/ActivityPage.ets`：活动/论坛频道及原活动列表。
- `features/home/HomePage.ets`、`core/ui/Routes.ets`：新路由、公开子页、登录续接与刷新。
- `features/home/HomeTab.ets` / `HomeReferenceVisuals.ets`、`features/service/ServicePage.ets`、`features/profile/ProfilePage.ets`：参考图与真实入口。
- `features/shopping/*`：真实服务端搜索及现有商品/订单页面差异修复。
- `backend/tests/unit/guest-login-app.test.ts`：现有真实壳路由守卫回归；新增 `forum-app.test.ts`：真实论坛服务/页面方法沙箱回归。
- `docs/reference/page-map-current-goals.md`、`docs/verification/issue-85-app.md`、`docs/verification/issue-85-app/`：页面对照与最终真实证据。

---

### Task 1: 论坛契约、HTTP 服务与登录路由

**Files:**
- Create: `app/entry/src/main/ets/features/forum/ForumContract.ets`
- Create: `app/entry/src/main/ets/features/forum/ForumService.ets`
- Modify: `app/entry/src/main/ets/core/ui/Routes.ets`
- Modify: `app/entry/src/main/ets/features/home/HomePage.ets`
- Modify: `backend/tests/unit/guest-login-app.test.ts`
- Test: `backend/tests/unit/forum-app.test.ts`

**Interfaces:**
- Consumes: `ApiClient.get/getPage/post/postWithHeaders/del/getBytes`、`SessionStore.readToken()`、`SessionService.sessionStamp()`、`PickedImage`。
- Produces: `ForumService.listPosts(category, query, page)`、`detail(id)`、`listComments(id,page)`、`listMine(page)`、`createPost(draft)`、`uploadImages(id,images,keys)`、`createComment(id,body,key)`、`deletePost(id)`、`deleteComment(id)`、`imageBytes(path)`；`ForumPostParam {postId}`、`ROUTE_FORUM_POST`、`ROUTE_FORUM_COMPOSE`、`ROUTE_MY_FORUM_POSTS`。

- [ ] **Step 1: 写失败的路由与 HTTP 契约回归**

```ts
// guest-login-app.test.ts 调用真实 HomePage.openRoute
page.openRoute("forum-post", { postId: "p1" });
assert.equal(page.pathStack.names[0], "forum-post");
page.openRoute("forum-compose", null);
assert.equal(page.pathStack.names.join(","), "forum-post,login");

// forum-app.test.ts 转译真实 ForumService，桩 ApiClient/SessionStore
await ForumService.listPosts("QUESTION", "清灰", 2);
assert.equal(calls[0].path, "/api/v1/forum/posts?category=QUESTION&q=%E6%B8%85%E7%81%B0&page=2&pageSize=20");
assert.equal(created.createRequestKey.length > 0, true);
assert.equal(upload.body.map((p) => p.name).join(","), "photos,uploadKeys,photos,uploadKeys");
```

- [ ] **Step 2: 运行测试确认因模块/路由不存在而失败**

Run: `cd backend && corepack pnpm exec tsx --test tests/unit/forum-app.test.ts tests/unit/guest-login-app.test.ts`

- [ ] **Step 3: 实现契约、服务与壳路由守卫**

```ts
export interface ForumPostDraft {
  category: string; title: string; body: string; createRequestKey: string;
}
// 列表/详情游客 token 可为空；写操作沿用 requireToken。
// 游客只放行 forum-post；forum-compose 与 my-forum-posts 进入登录意图。
```

按后端精确路径、字段和信封实现，不增加 `authorId`。新路由注册目标页占位只允许在 Task 2 立即替换为真实页面，不作为完成证据。

- [ ] **Step 4: 回归并构建**

Run: 上述两项测试 + `corepack pnpm test:unit`，原生 PowerShell 在 `app/` 运行 `hvigorw assembleHap --no-daemon`。
- [ ] **Step 5: 提交**

```bash
git add app/entry/src/main/ets/features/forum/ForumContract.ets app/entry/src/main/ets/features/forum/ForumService.ets app/entry/src/main/ets/core/ui/Routes.ets app/entry/src/main/ets/features/home/HomePage.ets backend/tests/unit/guest-login-app.test.ts backend/tests/unit/forum-app.test.ts
git commit -m "feat(forum): 接入原生契约与登录路由 (#85)"
```

### Task 2: 活动/论坛频道、真实列表和搜索

**Files:**
- Create: `app/entry/src/main/ets/features/forum/ForumFeed.ets`
- Modify: `app/entry/src/main/ets/features/activity/ActivityPage.ets`
- Modify: `app/entry/src/main/ets/features/home/HomePage.ets`
- Test: `backend/tests/unit/forum-app.test.ts`

**Interfaces:**
- Consumes: Task 1 `ForumService.listPosts`、`ForumPostParam`、`onOpen`。
- Produces: `ForumFeed({refreshVersion,onOpen,onLogin,onSessionExpired})`；ActivityPage 明确活动/论坛频道，真实查询不混用。

- [ ] **Step 1: 写失败回归：代次、关键词、分页失败保留已加载内容**

```ts
const feed = evalRealForumFeed();
feed.query = "硬盘";
feed.load();
feed.query = "网络";
feed.load();
resolveFirst(oldItems);
assert.notDeepEqual(feed.posts, oldItems);
resolveSecond(newItems);
assert.deepEqual(feed.posts, newItems);
assert.equal(feed.querySent[1], "网络");
```

- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现活动频道与 ForumFeed**

频道只设活动/论坛；活动沿用 `/api/v1/repair-activities`，详情保留报名路由。论坛实现三分类、关键词（60 字）、20 条分页、评论数/作者/时间/真实图片；加载/空结果/失败/重试明确。游客搜索可读，发布按钮走登录意图。

- [ ] **Step 4: 构建并在模拟器验证**

浏览真实帖子、切分类、搜索有/无结果、加载更多、返回；保存 `forum-list.jpeg`、`forum-search-empty.jpeg`。论坛未部署共享库时只使用已验证本机后端，不伪造内容。
- [ ] **Step 5: 提交 `feat(forum): 实现活动频道与帖子浏览 (#85)`**

### Task 3: 帖子详情、评论和删除

**Files:**
- Create: `app/entry/src/main/ets/features/forum/ForumPostDetailPage.ets`
- Modify: `app/entry/src/main/ets/features/home/HomePage.ets`
- Test: `backend/tests/unit/forum-app.test.ts`

**Interfaces:**
- Consumes: `detail/listComments/createComment/deletePost/deleteComment`、`authenticated`、登录回调、`sessionStamp()`。
- Produces: 完整公开详情；评论登录续接回原帖；删除返回并刷新论坛/我的帖子。

- [ ] **Step 1: 写失败回归：幂等、迟到回调、删除状态**

```ts
await detail.sendComment();
await detail.retryComment();
assert.equal(commentCalls[0].key, commentCalls[1].key);
detail.aboutToDisappear();
resolveLateComment();
assert.equal(detail.navigated, false);
```

- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现详情与评论**

按帖子详情图组织标题、作者/时间、正文、图片网格与底部评论输入；无点赞/关注/收藏。评论按时间正序分页、空评论、失败重试；删除确认后移除，404 不展示旧正文。所有写请求检查 disposed + sessionStamp。

- [ ] **Step 4: 实机 A 看帖→游客评论触发登录→B 评论→A 查看；删除评论/帖子复核**
截图 `forum-detail.jpeg`、`forum-comments.jpeg`、`forum-delete-confirm.jpeg`。
- [ ] **Step 5: 提交 `feat(forum): 打通帖子评论与删除流程 (#85)`**

### Task 4: 图文发布、我的帖子与活动回归

**Files:**
- Create: `app/entry/src/main/ets/features/forum/ForumComposePage.ets`
- Create: `app/entry/src/main/ets/features/forum/MyForumPostsPage.ets`
- Modify: `app/entry/src/main/ets/features/profile/ProfilePage.ets`
- Modify: `app/entry/src/main/ets/features/home/HomePage.ets`
- Test: `backend/tests/unit/forum-app.test.ts`

**Interfaces:**
- Consumes: `createPost/uploadImages/listMine`、PhotoPicker、图片预览组件。
- Produces: 发布成功→详情；已建帖上传失败只续传；我的帖子路由和 Profile 入口。

- [ ] **Step 1: 写失败回归：已建帖不重复创建、上传键稳定、成功后清空**

```ts
compose.savedId = "post-1";
await compose.submit();
assert.equal(createPostCalls.length, 0);
assert.equal(uploadedKeys[0], compose.pending[0].uploadKey);
```

- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现发布、图片进度与我的帖子**

限制 120/10000 字、9 图；本地文件读取失败给出错误；创建前绑定一次 createRequestKey；已保存 ID 后续只上传，成功/明确业务失败才清理；未决状态提示保留。我的帖子按服务端身份查询。

- [ ] **Step 4: 实机闭环和活动必要回归**

A 发布图文→B 浏览评论→A 我的帖子；活动详情→登录报名→我的报名；检查键盘与返回。若相册无图片，先用系统相册可读取的真实课设图片，不注入假接口数据。保存 `forum-compose.jpeg`、`forum-image-preview.jpeg`、`my-forum-posts.jpeg`、`activity-signup-regression.jpeg`。
- [ ] **Step 5: HAP + 相关单元/真实 HTTP 必要检查，提交 `feat(forum): 完成图文发布与个人帖子 (#85)`**

### Task 5: 首页、服务/工作台与我的参考图打磨

**Files:**
- Modify: `app/entry/src/main/ets/features/home/HomeTab.ets`
- Modify: `app/entry/src/main/ets/features/home/HomeReferenceVisuals.ets`
- Modify: `app/entry/src/main/ets/features/service/ServicePage.ets`
- Modify: `app/entry/src/main/ets/features/profile/ProfilePage.ets`
- Modify: `app/entry/src/main/ets/features/home/HomePage.ets`
- Modify: `docs/reference/page-map-current-goals.md`

**Interfaces:**
- Consumes: 论坛/选购/活动/维修真实路由、角色与权限；现有底栏和 `reduceMotion`。
- Produces: 首页真实选购/论坛入口；我的帖子；分组清晰的个人服务与保留的双角色工作台。

- [ ] **Step 1: 记录参考图与当前截图的逐项差异，先验证五栏/游客/工作人员基线**
- [ ] **Step 2: 修改首页标题/搜索/主视觉/频道/快捷卡、服务设备卡/两列卡、我的身份卡/宫格**

保留真实业务与底栏 260ms；首页可新增 `onShopping` 切换索引 3 和 `onForum` 切活动索引 1 并选择论坛，不把不可见页面当入口。明确“搜索维修知识”，不做假全局搜索。我的按维修服务、校园交易、交流、账号分组，不用 15 个无层次宫格堆叠。

- [ ] **Step 3: 构建并在 API 24 模拟器分别检查游客/客户/工作人员**

截图 `home-customer.jpeg`、`service-customer.jpeg`、`workbench-staff.jpeg`、`profile-customer.jpeg`、`profile-staff.jpeg`；检查滑动、选中态、返回、设备卡、权限与长昵称。
- [ ] **Step 4: 更新页面对照与验证记录，提交 `feat(app): 打磨首页服务与个人中心 (#42)`**

### Task 6: 选购真实搜索与买卖双方页面

**Files:**
- Modify: `app/entry/src/main/ets/features/shopping/ShoppingService.ets`
- Modify: `app/entry/src/main/ets/features/shopping/ShoppingPage.ets`
- Modify: `app/entry/src/main/ets/features/shopping/ProductDetailPage.ets`
- Modify: `app/entry/src/main/ets/features/shopping/ProductEditPage.ets`
- Modify: `app/entry/src/main/ets/features/shopping/MyProductsPage.ets`
- Modify: `app/entry/src/main/ets/features/shopping/OrdersPage.ets`
- Test: `backend/tests/unit/shopping-app.test.ts`（若不存在则新增最小测试）

**Interfaces:**
- Consumes: 已有 `/shopping/products?q=&category=&page=&pageSize=`、订单接口、PendingOrderStore。
- Produces: `listProducts(category, query, page, pageSize)`；完整数据集关键词搜索和原状态机不变的页面。

- [ ] **Step 1: 写失败回归：查询编码、请求代次与本地不过滤**

```ts
await ShoppingService.listProducts("SECONDHAND", "固态 硬盘", 1, 20);
assert.match(calledPath, /q=%E5%9B%BA%E6%80%81%20%E7%A1%AC%E7%9B%98/);
feed.products = firstRemotePage;
assert.equal(feed.products.length, firstRemotePage.length);
```

- [ ] **Step 2: 确认旧接口没有 q 参数时测试失败**
- [ ] **Step 3: 实现真实搜索与 UI 差异修复**

搜索提交/清空/分类切换重新请求，防抖不丢最终词，旧响应不覆盖新查询；搜索有结果/无结果、分页失败保留原数据。对齐选购搜索、横幅、分类图标、商品图比例；订单筛选、发布/详情/弹层、长标题/键盘/加载/空态/失败按实测修复，保留线下付款、幂等、库存和卖家权限。

- [ ] **Step 4: 实机买卖双方回归**

游客浏览/搜索→登录购买→买家取消/再次购买→卖家完成；发布/编辑/下架与订单结果；保存 `shopping-list.jpeg`、`product-detail.jpeg`、`product-edit.jpeg`、`order-confirm.jpeg`、`buyer-orders.jpeg`、`seller-orders.jpeg`。
- [ ] **Step 5: 相关回归 + HAP，提交 `feat(shopping): 完善真实搜索与交易交互 (#84)`**

### Task 7: 维修、知识、个人与活动主链子页

**Files:**
- Modify only after reproduced issue: `features/repair/RepairOrdersPage.ets`、`StaffRepairOrdersPage.ets`、`StaffRepairOrderDetailPage.ets`、`RepairRecordsPage.ets`、`StaffRepairRecordPage.ets`
- Modify only after reproduced issue: `features/knowledge/KnowledgeLibraryPage.ets`、`KnowledgeSearchPage.ets`、`PublicGuidesPage.ets`、`KnowledgePage.ets`、案例/引用页
- Modify only after reproduced issue: `features/profile/PersonalProfilePage.ets`、`FavoritesPage.ets`、`MessagesPage.ets`
- Modify only after reproduced issue: `features/activity/ActivityDetailPage.ets`、`MyRegistrationsPage.ets`、`MyRegistrationPage.ets`、成员活动页
- Test: `backend/tests/unit/*-app.test.ts` 的对应现有文件；确需新增则同名最小测试

**Interfaces:**
- Consumes: 现有真实服务、权限、人工报修确认、带来源问答与案例回流。
- Produces: 修复已复现的返回/刷新/键盘/错误问题；不改变业务状态机、权限或模型行为。

- [ ] **Step 1: 对每页运行当前版本并登记实际检查矩阵**

页面必须有加载、空/无结果、失败/重试、返回；表单有字段错误、键盘、重复点击、成功结果。能稳定复现的问题先写最小回归或保存失败截图，没有缺陷的不为“统一”而重写。

- [ ] **Step 2: 修复客户报修→工作人员受理/推进→客户进度**

区分关联备案和独立备案；只操作本机课设数据。验证列表/详情/状态/备案权限与返回，保存 `customer-repairs.jpeg`、`staff-order-detail.jpeg`、`repair-record.jpeg`。
- [ ] **Step 3: 修复知识→指南/案例→引用与个人中心问题**

公开/内部资料不越权，AI 只做已有可用短路径或记录未配置，不收费评测。验证资料、收藏、消息、活动报名/我的报名。
- [ ] **Step 4: 运行受影响回归与 HAP，逐页保存实际截图和未覆盖状态**
- [ ] **Step 5: 按实际修复提交 `fix(app): 完善主要业务子页交互 (#42)`；无通用修复则不产空提交**

### Task 8: 最终证据、HAP 与原草稿 PR

**Files:**
- Create: `docs/verification/issue-85-app.md`
- Create: `docs/verification/issue-85-app/*.jpeg`
- Modify: `docs/reference/page-map-current-goals.md`
- Modify: `README.md`（仅当前实际进度，不篡改历史）
- Modify: `docs/verification/issue-85-backend.md`（仅需要补充本轮真实复验时）

**Interfaces:**
- Consumes: 前 7 项实际改动与截图、HAP/回归结果。
- Produces: 可审查 PR #91：页面清单、参考映射、真实操作、截图、检查结果、剩余问题。

- [ ] **Step 1: 核对工作区/HEAD/上游 main/草稿远端，只暂存本轮文件**

运行 `git status --short --branch`、`git diff`、`git diff --cached`、`git log`；必要时以普通 merge 同步 main，不 rebase、不强推。推送前确认上游 PR 分支没有他人新提交。
- [ ] **Step 2: 运行最终必要检查**

完整 ArkTS HAP 构建、论坛及受影响单测、已改动 API 的真实 HTTP/必要 DB 回归（若未改后端则不重跑全库）；保存最终 HAP 大小/SHA256、签名状态及实际安装结果。
- [ ] **Step 3: 以最终包逐页复核，检查截图确为本次代码**

确保首页/活动/论坛/服务/工作台/选购/我的、新论坛页、选购页、维修/知识/活动/个人受影响页面都有运行证据；没有跑到的状态逐项写明，不标通过。保持模拟器开启。
- [ ] **Step 4: 完成验证记录、页面对照、README 与 PR 文案，提交并推送原分支**

`git push upstream feat/issue-85-forum-polish-20261028`（非 force）；用 `gh pr edit 91` 更新摘要、截图链接、实际验证和剩余问题，Refs #85 #42，不关闭 Issue、不合并、不部署。

## 计划自审

- 规格覆盖：公共 UI/导航（T1/T5）、论坛（T1–T4）、选购（T6）、维修/知识/个人/活动（T7）、证据/PR（T8）。
- 类型一致：`ForumPostParam.postId`、`createRequestKey/uploadKey`、服务端 `actions`、购物 `query` 与 `pageSize` 在各任务保持一致。
- 无占位验收：新页面须真实 API 与模拟器证据；缺接口/设备/签名/相册/共享部署均单列，不宣称完成。
