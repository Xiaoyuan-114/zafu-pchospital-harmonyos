# Issue #102 验证记录：设备与权益

日期：2026-11-27。分支：`feat/issue-102-devices-benefits`（基点 `main` @ `9d75b04`）。
范围：客户设备绑定/编辑/解绑、保修权益查询（客户只读）、工作人员登记权益接口、管理员作废接口、
报修单可选关联设备。**不含**检测/故障分类。

本文件只记**实际跑过的东西**。没跑的一律写在「未验证」里，不拿推演当结论。

## 1. 环境

| 项目 | 实测值 |
| --- | --- |
| Node | `v22.22.2` |
| pnpm | `12.4.1`（经 corepack） |
| 依赖安装 | `corepack pnpm install --ignore-scripts`，耗时 5m24s，成功 |
| Prisma Client 生成 | `corepack pnpm exec prisma generate` → `Generated Prisma Client (7.10.0)`，无引擎下载 |
| 数据库 | **无**。本机没有 `backend/.env`，也没有可连的 MySQL（课设库 `127.0.0.1:3308` 未启动） |
| DevEco SDK | 本机 API 26 / HarmonyOS 26.0.0；工程要求 `6.1.1(24)` |

`--ignore-scripts` 是为了跳过 `postinstall` 里的 `prisma generate`（随后单独执行）与文档清单脚本。

## 2. 跑过的检查

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 设备与权益单测 | `corepack pnpm exec tsx --test tests/unit/devices.test.ts` | **15/15 通过**（1180 ms） |
| 全量单测 | `corepack pnpm exec tsx --test tests/unit/**/*.test.ts` | **665/665 通过**（8866 ms） |
| 全项目 lint | `corepack pnpm exec eslint .` | **exit 0，无输出** |
| 类型检查 | `corepack pnpm exec tsc --noEmit` | **57 个错误，全部落在既有测试文件的 harness 类型上**（`tests/integration/personal-records.test.ts` 27、`customer-community` 15、`shopping` 8、`native-auth-app` 2、`native-activities-app` 2、`public-guides` 1、`native-auth` 1、`staff-repair-records` 1）；`src/` 与本次新增文件 **0 错误** |
| 生产构建 | `corepack pnpm run build` | **exit 0**（2m26s）。产物中确认 6 个新路由全部编译：`/api/v1/customer/devices`、`/api/v1/customer/devices/[id]`、`/api/v1/customer/devices/[id]/benefits`、`/api/v1/staff/devices`、`/api/v1/staff/devices/[id]/benefits`、`/api/v1/admin/benefits/[id]/void` |

`tsc` 那 57 个错误与本 PR 无关：都是「路由 handler 的 `params: Promise<{id: string}>` 传给测试里
`Promise<Record<string, string>>` 的 helper」这一类，属于依赖版本漂移（本次安装解析到
TypeScript 5.9.3 / Next 15.5.25），在改动前的同一棵树上同样存在。

### 过程中修掉的两个真问题

1. `deviceRepository.createBenefit` 原先把 `{ ...data }` 直接展开进 Prisma `create`，
   而 `data` 里带了只用于时间戳的 `now` 字段 —— Prisma 会把它当未知字段抛错。改为先解构摘掉 `now`。
2. `findByOwnerSerial` 原先用 `findUnique({ ownerUserId_serialNumber })`。
   `serial_number` 可空，Prisma 不为含可空字段的复合唯一索引生成 `WhereUniqueInput`，
   类型检查直接不过。改为 `findFirst({ ownerUserId, serialNumber })`，语义相同。
3. `tests/unit/service-device-refresh.test.ts` 是**源码切片**测试：它把 `ServicePage.ets`
   的方法段抽出来在 `vm` 里跑，注入假的 `RepairOrderService`。设备改由 `DeviceService`
   提供后，假实现失效，两条用例从「过」变成「败（`0 !== 1`）」。已改为注入 `DeviceService`、
   断言字段从 `orderId` 换成 `id`，时序规则（请求中刷新不丢事件、退出后迟到响应不回填）保持不变。

## 3. 未验证（重要）

| 项目 | 原因 |
| --- | --- |
| `prisma migrate deploy` 应用本 PR 的迁移 | 无数据库。迁移 SQL 与 `schema.prisma` 已逐行对齐（列类型、唯一索引、4 个外键、2 个索引），但没有在真库上执行过 |
| 数据库集成测试 `pnpm test:db` | 同上 |
| 接口全链路（curl 或 App 实机） | 同上。客户新增设备、权益状态现算、`DEVICE_IN_USE` 409、`X-HTTP-Method-Override` 405 分支都只有代码层面的推演 |
| `pnpm devices:demo -- --account 100001` | 同上（脚本会先被 `assertExperimentDatabase` 拦住，需要 `EXPERIMENT_DEV_*` 与 `DATABASE_URL`） |
| HAP 构建 | 本机 SDK API 26 ≠ 工程要求的 API 24；无签名材料 |
| 模拟器截图 / 页面验收 | 同上，`hdc list targets` 为空 |
| ArkTS 静态检查 | 本机没有 DevEco 的 ArkTS linter；页面代码只做过人工审查（导入是否用尽、`@Prop/@State` 用法、`getPromptAction().showDialog` 的异常分支） |

## 4. 需要维护者在真库上补的一轮

```bash
cd backend
corepack pnpm install && corepack pnpm db:migrate:deploy && corepack pnpm db:seed
corepack pnpm accounts:prepare
corepack pnpm devices:demo -- --account 100001
corepack pnpm dev
```

然后按 PR 描述里的 7 步走一遍，重点看三处：

1. 权益三种状态（有效 / 已过保修期 / 已作废）在同一天内的排序与文案；
2. 设备有未完成报修时解绑 → 409 `DEVICE_IN_USE`；
3. `POST /api/v1/customer/devices/{id}` 不带 `X-HTTP-Method-Override` → 405。
