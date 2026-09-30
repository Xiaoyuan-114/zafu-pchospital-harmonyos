# 本地开发

课程实验直接运行 Next.js + MySQL。当前电脑已使用已安装的 MySQL Server 9.6.0 创建专用实例：`127.0.0.1:3308`，禁用 mysqlx，数据持久保存于 `E:/codes/pchospital-local-mysql`。原 MySQL 服务和旧端口未更改。

| 配置          | 当前值                                                      |
| ------------- | ----------------------------------------------------------- |
| 开发库 / 用户 | `pchospital_exp_local` / `pchospital_local`                 |
| 测试库 / 用户 | `pchospital_exp_local_test` / `pchospital_local_test`       |
| 应用          | `http://localhost:13080`，健康接口 `/api/v1/health`         |
| 私有配置      | 本仓库 `.env`（日常开发、测试账号和随机应用密钥）           |
| 实例管理配置  | 本仓库 `.env.local-admin`（新实例随机 root 凭证和数据目录） |

## 当前电脑启动与停止

MySQL 数据目录和两个配置文件都保存在本机，不入 Git；启动和停止会保留数据。当前实例不是 Windows 服务，电脑重启后运行：

```powershell
node tools/local-mysql.mjs start
corepack pnpm db:health
corepack pnpm dev --port 13080
```

停止 App 使用 Ctrl+C。停止课设专用数据库：

```powershell
node tools/local-mysql.mjs stop
```

管理脚本只读取 `.env.local-admin` 中指定的独立 loopback 实例。其它 MySQL 安装位置可在该文件配置 `LOCAL_MYSQL_BIN_DIRECTORY`；无需修改源代码。若实例已启动，先用 `db:health` 检查，不重复启动。

## 其他组员首次配置

安装 Node.js 24、启用 Corepack，并安装/启动本机 MySQL。可使用自己的本机实例，端口不必与当前电脑相同。用自己的本地管理员创建两个专用数据库和分别只访问各自库的账号，修改下方占位密码后执行：

```sql
CREATE DATABASE pchospital_exp_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE pchospital_exp_local_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'pchospital_local'@'localhost' IDENTIFIED BY 'replace-development-password';
CREATE USER 'pchospital_local_test'@'localhost' IDENTIFIED BY 'replace-test-password';
GRANT ALL PRIVILEGES ON pchospital_exp_local.* TO 'pchospital_local'@'localhost';
GRANT ALL PRIVILEGES ON pchospital_exp_local_test.* TO 'pchospital_local_test'@'localhost';
```

复制 `.env.example` 为 `.env`，填写自己的连接和新随机密钥。不要复用原生产配置。完成后运行：

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm db:migrate:deploy
corepack pnpm db:seed
corepack pnpm db:migrate:test
corepack pnpm db:seed:test
corepack pnpm db:health
corepack pnpm test:db
corepack pnpm dev --port 13080
```

上述迁移使用已有提交的 SQL，新空库不需要 reset。新增模型时使用 `db:migrate:dev`；Prisma 的 shadow 库需要自己的本地账号可创建，或显式提供 `SHADOW_DATABASE_URL`，确认不是开发/测试/业务库。

`db:reset:test` 是可选的清空测试库操作。脚本会读取 `TEST_DATABASE_URL` 并拒绝开发库。Prisma 对 AI 执行 reset 还有额外确认，本次没有绕过此确认，也未实际执行 reset；测试库通过全新空库迁移建立。集成测试会删除测试数据，始终运行在 `_test` 库。

Next 自动读取 `.env`；数据库 wrapper、Prisma config 和健康工具也自动读取。测试 wrapper 切换到 `TEST_DATABASE_URL`；seed 和测试通过 Node 直接调用已安装 CLI，Windows 不依赖 `pnpm.cmd` 子进程。当前电脑全局 pnpm shim 有路径错误，因此统一使用可工作的 `corepack pnpm`。

## 日期与功能范围

`RepairRecord.repairDate` 是上海日历日 `DATE`。API 仍保留 UTC 时间范围元数据，数据库查询统一转换为日历边界；摘要/分类用 Prisma，趋势/排行用参数化日期字符串 SQL，避免误计上月末和漏计月末。

seed 仅建立角色、维修分类和技能字典，没有持久测试账号。Bearer 原生登录、客户报修/预约、AI 问答后续按开发方案实现。

## 本次实测（2026-09-30）

- 本机专用实例初始化、两个库各 10 项迁移和 seed 通过。
- 独立账号跨库访问均被 MySQL 1142 拒绝；专用实例 stop/start 已实测，重启后数据和健康检查保持正常。
- `db:health`：MySQL Community Server 9.6.0，UTC、utf8mb4 / utf8mb4_unicode_ci，通过。
- `test:unit`：318/318；`lint` 通过。
- `test:db`：137/137，原四项统计失败全部通过。新增 DATE 归属回归分别检查上月末、本月首末、下月首、跨年、学期首末及两端外日期，对摘要、分类、趋势、排行逐项验证，防止总数相抵。
- `GET http://127.0.0.1:13080/api/v1/health`：HTTP 200、数据库可达。
- `build` 串行复核通过；第一次同时运行 dev/build 造成 `.next` 临时文件冲突，停止 dev 后重跑已通过。
- 未进行鸿蒙真机联调；当前本地实例没有迁移旧服务器实验数据。旧云端实验 App/MySQL 和实验域名代理已由主线停用，命名卷保留。
