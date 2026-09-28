# 原项目盘点（2026-09-29）

核查对象：本地 `zafu-pchospital-web` 的 `main`，HEAD 为 `64eb141ec21468c46f001dbe7cdab1183e4cb23c`，远端为 `ZAFU-PCHospital/zafu-pchospital-web`。本记录依据代码静态核查；没有连接生产或实验数据库，也没有对在线 API 发请求。

## 已存在（代码证据）

| 项目 | 核查结果 | 来源 |
|---|---|---|
| 技术栈 | Next.js 15 App Router、TypeScript、Prisma 7.10、MariaDB adapter、GreatSQL 8、pnpm；`lint`、`test`、`test:db`、`build`、DB 迁移和 seed 脚本 | `package.json`、`AGENTS.md`、`prisma/schema.prisma` |
| 会话 | QQ+密码登录建立数据库 Session，`/api/v1/auth/login` 设置 HttpOnly Cookie；`/me` 从 Cookie 读取，会话可能要求首次改密 | `src/app/api/v1/auth/login/route.ts`、`src/app/api/v1/me/route.ts`、`src/lib/auth/request.ts` |
| 写请求保护 | 写接口检查 `Origin` 是否在 `APP_BASE_URL` 白名单；当前没有 Bearer 读取通道 | `src/lib/auth/request.ts` |
| API 约定 | 成功 `{success:true,data,meta}`；失败 `{success:false,error:{code,message,fieldErrors?},meta}`；列表可有 `meta.pagination` | `src/lib/api/response.ts` |
| 维修备案 | `RepairRecord` 属于成员 `MemberProfile`，字段含维修日期、时长、分类、机型、内容、结果、备注；`DRAFT → PENDING → APPROVED/REJECTED`，退回可重提；维修照片、审核、时间线 | `prisma/schema.prisma`、`src/features/repairs/repair-state.ts`、`repair-service.ts` |
| 维修记录 API | `GET/POST /api/v1/repairs`、`GET/PATCH /api/v1/repairs/:id`、提交和管理员审核路由；创建草稿需要 `repair:create` 权限与 Idempotency-Key | 路由与 `src/features/repairs/repair-service.ts` |
| 活动报名 | `RepairActivityRegistration` 含姓名、电话、故障类型、机型、状态；活动接待 `serve` 后创建已提交的 `RepairRecord` 并写入唯一可空 `repairRecordId` | `prisma/schema.prisma`、`src/features/repair-activities/repair-activity-staff-service.ts` |
| 数据初始化 | seed 写角色、分类、技能，不写维修记录 | `prisma/seed.ts` |
| 文档 | 社团手册另在 `ZAFU-PCHospital-Doc` 仓库，许可与可用于 AI 的范围待确认 | 原仓库 `AGENTS.md`、本地 `doc-repo` |

## 报修、预约与维修备案的实际关系

当前代码中**没有通用客户报修/预约单模型和对应 API**。现有“预约”能力是特定维修活动的报名：客户按活动填写报名信息，工作人员签到/接待后，接待流程创建一条 `RepairRecord`，报名的 `repairRecordId` 可空且唯一。这是“活动报名 → 接待时生成维修备案”的特殊链路，不能当成一般客户报修的完整处理状态机。`RepairRecord` 的 `DRAFT/PENDING/APPROVED/REJECTED` 属于维修备案审核，不代表客户报修处理进度。

## 需新建

- 独立实验后端、数据库/存储与原生会话通道；客户身份及测试账号方案。
- 普通客户报修/预约单、本人查询、工作人员受理/时间线与到维修备案的可选关联，含迁移、授权和合同测试。
- 知识语料授权、脱敏、索引、问答、引用、故障卡审核回流与评测。

## 待核实

- 实验 fork 的目标 commit、数据库真实记录量/质量、线上接口行为和既有数据权限；现阶段只核查了本地源码。
- 原账号体系能否承载“客户”角色以及客户注册/登录方式；工作人员分配范围。
- 活动报名隐私/授权与课程实验的复用许可；参照 App 版本、设备系统版本和社团手册授权。
