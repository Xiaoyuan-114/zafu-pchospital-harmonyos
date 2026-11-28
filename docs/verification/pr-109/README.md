# PR #109 审查补改（2026-11-28）

对应 [审查意见](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/pull/109#pullrequestreview-6096531826)。PR #109 随 #110 合入 `a40ce1b`，本轮基于该主干以 `codex/pr109-review-followups` 补交；保留 #110 的圈子分类接口及筛选后分页。

验证代码为 `18fb8b4ef8f0213111686a812e4913ae11fb19b3`，相对 `a40ce1b` 的 `backend/src`、`prisma`、`tests`、`tools` 差异指纹（`git diff ... | git hash-object --stdin`）为 `df3539ad31377cbb40e93f07bc414d594c52e49b`。后续提交更新验证文档及 README。

环境：本机 WSL/Linux，Node 24.18.0、pnpm 12.4.1、MySQL 8.0.46，独立测试库 `pchospital_exp_issue103_test`。命令在 `backend/` 执行；WSL 数据库连接额外配置 `DATABASE_RSA_PUBLIC_KEY_PATH`，连接凭据留在本机 `.env`。

## 逐项处理

| 审查建议             | 处理结果                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| 圈子并发创建唯一冲突 | 捕获 P2002 后按创建者和请求键重读；同内容返回原圈子，不同内容返回 409；事务内命中与冲突重放共用内容比较 |
| 活动积分重复常量     | 记分、冲正和本人报名展示共用 `ACTIVITY_CHECKIN_POINTS`                                                  |
| 圈子列表 N+1         | 一次 `findMany` 读取圈子、有效成员/帖子计数和本人加入关系，复用详情映射；保留分类筛选                   |
| 热门查询记录         | 保留七天评论数排序及零评论帖子分页；新增可重复运行的合成查询脚本和原始记录                              |
| 活动奖励索引         | 独立迁移增加 `(activity_id)`；注释明确软删冲正、历史账目保留及维护硬删前的冲正要求                      |
| 关注响应契约         | POST/DELETE 返回 `{ id, displayName, following }`，复用公开昵称规则                                     |
| 创建圈子状态码       | POST `/circles` 成功及同键重放返回 201，API 文档同步                                                    |
| Prettier             | 格式化相关 TS/Markdown 文件，包括原论坛测试文件                                                         |
| CI 覆盖与 DB 证据    | 新增 5 项单测进入既有 `test:unit`；数据库回归作为合并前手动检查，保留版本与原始输出                     |

## 验证

| 状态       | 命令及结果                                                                                                                                                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 通过       | `corepack pnpm lint`、相关文件 `corepack pnpm exec prettier --check <files>`、`git diff --check`                                                                                                                                             |
| 通过       | `corepack pnpm test:unit`：658 通过、0 失败、0 跳过                                                                                                                                                                                          |
| 通过       | `corepack pnpm build`：生产构建及构建内类型检查成功                                                                                                                                                                                          |
| 通过       | `corepack pnpm exec prisma validate`、`corepack pnpm db:generate`                                                                                                                                                                            |
| 通过       | `corepack pnpm db:migrate:test`：新增迁移成功；查询 `information_schema.STATISTICS` 确认索引存在                                                                                                                                             |
| 通过       | `APP_BASE_URL=http://localhost:13082 corepack pnpm test:db tests/integration/native-activities.test.ts tests/integration/forum.test.ts tests/integration/issue103-community.test.ts`：43 通过、0 失败、0 跳过；[原始输出](db-regression.txt) |
| 通过       | `corepack pnpm exec tsx tools/community-http-smoke.ts`：生产构建产物连接同一测试库，15 次真实 HTTP 请求通过，合成数据已清理；[原始输出](http-smoke.txt)                                                                                      |
| 通过       | `corepack pnpm exec tsx tools/community-query-plan.ts`：[执行计划与耗时](query-plan.txt)                                                                                                                                                     |
| 失败       | 附加全仓 `tsc --noEmit`：57 条测试代码类型诊断；独立提取 `a40ce1b` 基线执行同项得到 58 条，新增文件无类型诊断                                                                                                                                |
| 失败后修复 | 首轮 DB 回归与 Prisma 生成重叠，生成文件加载失败；生成结束及整合主干后重跑，43 项通过。首次查询脚本使用顶层 await，改为 async main 后通过。首次 HTTP 服务启动缺少本机 SWC 依赖，按锁文件恢复依赖后启动及 15 次请求通过                       |
| 跳过       | HAP 构建和设备操作：本次补改只修改后端与文档                                                                                                                                                                                                 |
| 未跑       | 无                                                                                                                                                                                                                                           |

真实 HTTP 覆盖创建/同键重放 201、同键内容冲突 409、普通用户创建拒绝 403、关注/取消关注公开昵称、加入圈子及本人列表、圈子发帖和热门列表、重复打卡与唯一积分流水。服务通过进程环境令 `DATABASE_URL` 取 `TEST_DATABASE_URL` 的值。

## 热门查询记录

脚本生成 100 个帖子、960 条评论，执行与热门列表一致的排名 SQL 和五次 `forumRepository.listPublicPosts({ sort: "hot", skip: 0, take: 20 })`，结束后清理合成数据。查询执行于补改提交 `932f3d7`，整合主干未改变这段查询。

`EXPLAIN ANALYZE` 显示帖子使用 `forum_posts_public_created_idx`，评论使用 `forum_comments_post_created_idx`；临时表聚合及排序返回前 20 条，排名 SQL 为 1.49 ms。包含计数、排名和详情的五次调用为 21.020、9.415、9.437、8.561、8.131 ms，样本规模为 100 帖、960 评论。
