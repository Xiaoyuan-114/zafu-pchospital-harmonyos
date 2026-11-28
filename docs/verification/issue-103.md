# Issue #103 实际验证（进行中）

后端基线为 PR [#109](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/pull/109) 的 `4e63acc`；页面首次提交为 `cb0c7a7`，审查补改见 [#110](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/pull/110)。本机独立 MySQL 3312 使用开发库 `pchospital_exp_issue103` 和测试库 `pchospital_exp_issue103_test`；本机后端 13081，模拟器通过 HDC rport 访问。验证使用课设账号及合成帖子。

## 已通过

- HAP：DevEco SDK 6.1.1，`hvigorw --mode module -p product=default assembleHap --no-daemon` 构建成功并安装模拟器。最近一次清理重建包含账号切换时的社区状态刷新。
- 数据库集成：`APP_BASE_URL=http://localhost:13082 corepack pnpm test:db tests/integration/native-activities.test.ts tests/integration/forum.test.ts tests/integration/issue103-community.test.ts`，39 通过、0 失败、0 跳过。测试前仅重置新建的 `pchospital_exp_issue103_test`。
- 后端 `corepack pnpm lint` 通过；`corepack pnpm test:unit` 650 通过、0 失败、0 跳过。
- 本机真实 HTTP：管理员创建圈子、客户加入并发帖、工作人员关注作者，关注流出现帖子；工作人员每日打卡，重复提交积分保持 1 分。
- 本机真实 HTTP：客户报名，工作人员出勤后签到，客户积分增加 10；重复签到积分不变；工作人员撤回排队后积分归零。首次创建的演示活动因开发服务器编译使报名窗口到期，重建活动并在报名后关闭窗口完成验证。
- 前端状态回归：`corepack pnpm exec tsx --test tests/unit/forum-app.test.ts tests/unit/guest-login-app.test.ts`，53 通过、0 失败；`eslint tests/unit/forum-app.test.ts` 通过。
- 模拟器：关注频道退出登录后重新进入社区，游客看到推荐频道；圈内发帖表单预选所属圈子。
- 模拟器：工作人员与管理员切换后，同一圈子分别显示“退出”和“加入”；取消关注后返回信息流，作者按钮更新为“关注”，已加入圈子的帖子仍保留。
- 模拟器：工作人员在现场看板为客户签到并撤回；客户报名详情的本场积分从 10 分变为 0 分。开发服务器首次编译签到及撤回接口时请求超时，重试后操作成功。
- 模拟器：管理员进入圈子管理，将圈子归档，详情显示“已归档 · 只读”，随后恢复开放。
- 模拟器：工作人员看到关注作者的帖子；加入圈子后成员数从 1 变 2；进入圈子发帖页预选圈子并发布测试帖，在详情发表评论、评论数变为 1；每日打卡页显示今日已打卡和 1 分，积分页显示对应流水。

| 页面与状态 | 模拟器截图 | 对应参考 |
| --- | --- | --- |
| 推荐、真实图文 | [live-feed.png](issue-103/live-feed.png) | [花粉信息流](../reference/my-huawei/community-huafen-feed.jpg) |
| 关注流 | [live-follow.png](issue-103/live-follow.png) | 花粉信息流 |
| 退出登录后浏览推荐 | [live-guest-after-logout.jpeg](issue-103/live-guest-after-logout.jpeg) | 花粉信息流 |
| 游客登录后返回关注流 | [guest-follow-after-login.png](issue-103/guest-follow-after-login.png) | 花粉信息流 |
| 我的关注：列表及空态 | [live-following-list.png](issue-103/live-following-list.png)、[live-following-empty.png](issue-103/live-following-empty.png) | 花粉作者行；无独立参考图 |
| 取消关注后返回关注流 | [live-unfollow-feed-refresh.jpeg](issue-103/live-unfollow-feed-refresh.jpeg) | 花粉信息流 |
| 管理员创建圈子表单 | [live-circle-admin.jpeg](issue-103/live-circle-admin.jpeg) | 全部圈子；无独立管理表单图 |
| 圈子归档只读 | [live-circle-archived.jpeg](issue-103/live-circle-archived.jpeg) | 圈子信息流 |
| 全部圈子、已加入 | [live-circles.png](issue-103/live-circles.png) | [全部圈子](../reference/my-huawei/community-circles-category-list.jpg) |
| 圈子详情 | [live-circle.png](issue-103/live-circle.png) | [圈子信息流](../reference/my-huawei/community-circle-detail-feed.jpg) |
| 圈内发帖、圈子预选 | [live-compose-final.jpeg](issue-103/live-compose-final.jpeg) | 花粉发布入口；无对应发布表单图 |
| 帖子详情与评论 | [live-post.png](issue-103/live-post.png) | [帖子详情](../reference/my-huawei/community-event-post-detail.jpg) |
| 每日打卡、已打卡 | [live-checkin.png](issue-103/live-checkin.png) | [活动打卡](../reference/my-huawei/community-event-checkin-detail.jpg) |
| 我的积分与流水 | [live-points.png](issue-103/live-points.png) | 活动打卡的“我的积分”入口；无对应明细图 |
| 现场看板、客户已入队 | [live-activity-board.jpeg](issue-103/live-activity-board.jpeg) | 沿用现有现场看板 |
| 客户报名详情：签到及撤回 | [live-registration-points.jpeg](issue-103/live-registration-points.jpeg)、[live-registration-withdrawn.jpeg](issue-103/live-registration-withdrawn.jpeg) | 现有报名详情与活动打卡 |
| 我的：关注与积分入口 | [live-profile.png](issue-103/live-profile.png) | [我的](../reference/my-huawei/my-account-service-record-entry.jpg) |

部分截图拍摄于增加“我的”入口前；打卡和积分页的截图已按布局调整刷新。实体手机未验证。

## 待覆盖状态

- 推荐和关注流：多页滚动、搜索失败与其他游客登录续接。
- 圈子列表和详情：多页分类、空圈子、游客加入后的续接；管理表单的创建提交和权限失效。
- 发帖和帖子详情：多页圈子选择、图片上传失败恢复、正文与评论定位的不同加载顺序。
- 每日打卡和积分明细：跨日、连续周期变化、多页流水和网络失败。
- 我的报名和现场看板：多报名去重、匿名签到及接待后的冲正规则；相关服务端集成测试已覆盖。

## #110 审查补改

代码版本 `46c27be`，补改前版本 `351aa4c`。Pura 90 模拟器视口为 1320 × 2856，使用本机独立开发库和课设账号。

| 场景 | 补改前 | 补改后 |
| --- | --- | --- |
| 圈子分类 | [全部圈子](issue-103/review-circles-before.jpeg) | [按电脑技术筛选](issue-103/review-circles-after.jpeg)，分类来自服务端目录 |
| 发帖按钮与选中分类 | [原圈内发帖表单](issue-103/live-compose-final.jpeg) | [普通发帖表单](issue-103/review-compose-after.jpeg)，实心蓝底使用白字 |
| 积分时间 | [原 UTC 明细](issue-103/live-points.png) | [北京时间明细](issue-103/review-points-after.jpeg)，同一笔流水从 11 月 26 日 16:57:28 UTC 显示为 11 月 27 日 00:57:28 北京时间 |
| 游客从打卡页登录 | 审查复现登录后同页重复入栈 | [登录后打卡页](issue-103/review-checkin-resumed.jpeg)，返回一次回到推荐频道 |
| 游客从圈子页登录 | 审查复现登录后同页重复入栈 | [登录后圈子页](issue-103/review-circle-resumed.jpeg)，刷新为“已加入”，返回一次回到全部圈子 |

- 通过：`hvigorw --mode module -p product=default assembleHap --no-daemon`，HAP 安装成功。论坛与游客登录回归 54 项通过，圈子社区独立数据库集成 4 项通过，相关 ESLint 通过。真实 HTTP 返回全部分类名称，集成测试验证首页之外的分类可发现、筛选先于分页。
- 首轮 HAP 构建报 ArkTS 不支持解构声明，改用索引访问后构建成功。模拟器登录超时后恢复本地开发库并重试成功。
- 跳过：无测试被运行器跳过。实体手机与前文待覆盖场景仍按课程验收安排。
