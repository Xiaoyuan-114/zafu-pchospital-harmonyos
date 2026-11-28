# PR #109 审查补改（2026-11-28）

对应 [审查意见](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/pull/109#pullrequestreview-6096531826)，基于 `4e63acc416828178af693e1782b83fd6245de8be` 补改。数据库为本机 MySQL 8.0.46，独立测试库 `pchospital_exp_issue103_test`；Node 24.18.0、pnpm 12.4.1，命令在本机 WSL/Linux 的 `backend/` 执行。

## 逐项处理

| 审查建议             | 处理结果                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| 圈子并发创建唯一冲突 | 捕获 P2002 后按创建者和请求键重读，同一内容返回原圈子，不同内容返回 409；事务内命中与冲突重放共用内容比较 |
| 活动积分重复常量     | 记分、冲正和本人报名展示共用 `ACTIVITY_CHECKIN_POINTS`                                                    |
| 圈子列表 N+1         | 列表一次 `findMany` 读取圈子、有效成员/帖子计数和本人加入关系，复用详情映射                               |
| 热门查询记录         | 保留现有七天评论数排序及零评论帖子分页，新增可重复运行的合成查询脚本；执行计划与耗时见下文                |
| 活动奖励索引         | 新增独立迁移及 schema 索引 `(activity_id)`；迁移注释明确软删冲正、历史账目保留和维护硬删前的冲正要求      |
| 关注响应契约         | POST/DELETE 均返回 `{ id, displayName, following }`，复用公开昵称规则                                     |
| 创建圈子状态码       | POST `/circles` 成功和同键重放返回 201，API 文档同步                                                      |
| Prettier             | 格式化本 PR 变更的 TS/Markdown 文件，包括原论坛测试文件                                                   |
| CI 覆盖与 DB 证据    | 新增 5 项单测进入既有 `test:unit`；数据库回归作为本 PR 合并前手动检查，保留版本及原始输出                 |

## 验证

| 状态 | 命令及结果                                                                                                                                                                                                                                   |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 通过 | `corepack pnpm lint`                                                                                                                                                                                                                         |
| 通过 | `corepack pnpm test:unit`：655 通过、0 失败、0 跳过                                                                                                                                                                                          |
| 通过 | `corepack pnpm exec prisma validate`、`corepack pnpm db:generate`                                                                                                                                                                            |
| 通过 | `corepack pnpm db:migrate:test`：新增索引迁移应用成功；查询 `information_schema.STATISTICS` 确认索引存在                                                                                                                                     |
| 通过 | `APP_BASE_URL=http://localhost:13082 corepack pnpm test:db tests/integration/native-activities.test.ts tests/integration/forum.test.ts tests/integration/issue103-community.test.ts`：42 通过、0 失败、0 跳过；[原始输出](db-regression.txt) |
| 通过 | `corepack pnpm exec tsx tools/community-query-plan.ts`：[执行计划与原始耗时](query-plan.txt)                                                                                                                                                 |
| 失败 | 首次数据库回归在 Prisma Client 重新生成期间加载论坛测试文件失败；生成完成后重跑上述三组，42 项全部通过                                                                                                                                       |
| 跳过 | HAP 构建和设备操作：本 PR 只修改后端与文档                                                                                                                                                                                                   |
| 未跑 | 生产构建、真实 HTTP 与最终格式检查待本轮完成后更新                                                                                                                                                                                           |

本机 WSL 通过 Windows 主机地址访问专用 MySQL，数据库命令额外设置 `DATABASE_RSA_PUBLIC_KEY_PATH` 指向该实例的公钥文件；连接配置留在本机 `.env`。

## 热门查询记录

脚本为测试库生成 100 个帖子、960 条评论，执行与热门列表一致的排名 SQL 和五次 `forumRepository.listPublicPosts({ sort: "hot", skip: 0, take: 20 })`，结束后清理合成数据。

MySQL `EXPLAIN ANALYZE` 显示帖子使用 `forum_posts_public_created_idx`，评论使用 `forum_comments_post_created_idx`；临时表聚合及排序返回前 20 条，排名 SQL 为 1.49 ms。包含计数、排名和详情的五次仓储调用为 21.020、9.415、9.437、8.561、8.131 ms。该记录的数据规模为 100 帖、960 评论。

运行查询记录脚本和真实 HTTP 脚本时使用独立测试库；HTTP 服务也需通过 `DATABASE_URL=TEST_DATABASE_URL` 的进程配置连接同一库。两份脚本均在 `finally` 清理自身合成数据。
