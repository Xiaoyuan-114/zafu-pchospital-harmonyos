# 鸿蒙电脑医院实验后端

课设 App 的本地实验后端，从原 Web 提取可复用的 Next.js API 与 Prisma 模型。按开发方案自行推进，不使用 Issues、固定周计划或强制 PR 审批。

- 技术：Node.js 24、pnpm 12.4.1、Next.js 15、Prisma 7、本机 MySQL。
- 数据库：本机独立开发库和测试库；不使用 Docker 或线上实验库。
- 代码：`src/app/api/v1/` 为接口，`src/features/` 为业务，`prisma/` 为模型/迁移/seed，`tests/` 为真实测试。
- 原生 Bearer 登录、客户报修/预约对象及 AI 问答尚未实现。已有 `RepairRecord` 是工作人员维修备案，客户报修仍需开发。
- 保留的 Web 页面与业务模块来自原项目，仅作为复用源码；课设完成状态以实际联调为准。

## 本地运行

```powershell
corepack pnpm install --frozen-lockfile
# 按 docs/local-development.md 建立本机数据库，复制 .env.example 为 .env 并填写本机账号。
corepack pnpm db:migrate:deploy
corepack pnpm db:seed
corepack pnpm db:health
corepack pnpm dev --port 13080
```

健康接口：`http://localhost:13080/api/v1/health`。模拟器/真机使用电脑局域网 IP（如 `http://192.168.x.x:13080`），数据库仍只由后端访问。HTTP 真机访问配置需在 App 工程中按实际 SDK 验证；当前未完成真机联调。

```powershell
corepack pnpm lint
corepack pnpm test:unit
corepack pnpm build
corepack pnpm db:migrate:test
corepack pnpm db:seed:test
corepack pnpm test:db
```

数据库测试自动选择 `TEST_DATABASE_URL`，只允许指定的 `_test` 库。`db:reset:test` 清空测试库，开发库保留。完整配置、初始化和当前核验状态见 [本地开发说明](docs/local-development.md)。

源码来源：`ZAFU-PCHospital/zafu-pchospital-web`，提取基点 `64eb141ec21468c46f001dbe7cdab1183e4cb23c`，用于课程实验。需求见 [App 开发方案](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/blob/main/docs/development-plan.md)。原项目许可证由维护者决定，本仓库未添加扩大授权范围的许可证。
