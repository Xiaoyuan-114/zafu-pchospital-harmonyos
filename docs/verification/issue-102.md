# Issue #102 验证记录：设备、权益与检测

日期：2026-11-27 / 28。范围：客户设备绑定与编辑、保修权益查询（客户只读）、工作人员登记权益接口、
管理员作废接口、报修单可选关联设备、症状问答式检测。

本文件只记**实际跑过的东西**。没跑的一律写在「未验证」里，不拿推演当结论。

## 1. 环境

| 项目 | 实测值 |
| --- | --- |
| Node | `v22.22.2` |
| pnpm | `12.4.1`（经 corepack） |
| 数据库 | 本机 MariaDB `127.0.0.1:3306`，库 `pchospital_exp_local`（开发）与 `pchospital_exp_local_test`（测试） |
| 驱动 | `@prisma/adapter-mariadb`，连接串需带 `allowPublicKeyRetrieval: true`，否则报 `ER_CANNOT_RETRIEVE_RSA_KEY` |
| DevEco SDK | DevEco Studio 自带 SDK，API 26 / HarmonyOS 26.0.0；工程声明 `6.1.1(24)` |
| 模拟器 | `127.0.0.1:5555`，x86_64，`cn.zafu.pchospital.course` |

构建 HAP 时把 `targetSdkVersion` 临时提到 `26.0.0`（`compatibleSdkVersion` 保持 `6.1.1(24)`），
构建完已改回 `6.1.1(24)`，`app/build-profile.json5` 在提交里没有改动。
模拟器接受**未签名** HAP，所以没有配置 `signingConfigs`。

## 2. 跑过的检查

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 迁移应用 | `corepack pnpm db:migrate:deploy` | **22 个迁移全部 applied**，含 `20261127180000_issue102_devices_benefits` 与 `20261127200000_issue102_diagnostics`；随后 `Database schema is up to date!` |
| 种子与账号 | `db:seed`、`accounts:prepare` | 通过。测试账号 `100001/customer123`、`100002/staff123`、`100003/admin123` |
| 演示设备 | `devices:demo -- --account 100001` | 通过：「现有 2 台在用设备、4 条权益记录」 |
| 设备与权益单测 | `tsx --test tests/unit/devices.test.ts` | **15/15 通过** |
| 检测单测 | `tsx --test tests/unit/diagnostics.test.ts` | **11/11 通过** |
| 全量单测 | `tsx --test "tests/unit/**/*.test.ts"` | **676/676 通过**（9026 ms） |
| 全项目 lint | `eslint .` | **exit 0，无输出** |
| 类型检查 | `tsc --noEmit` | **57 个错误，全部落在既有测试文件的 harness 上**；`src/` 与本次新增文件 **0 错误** |
| HAP 构建 | `hvigor.js --mode module -p product=default assembleHap` | **BUILD SUCCESSFUL**（31～35 s），`entry-default-unsigned.hap` 4.7 MB |
| 安装启动 | `hdc install -r` + `aa start` | `install bundle successfully`，App 正常启动 |

`tsc` 那 57 个错误与本 PR 无关：都是「路由 handler 的 `params: Promise<{id:string}>` 传给测试里
`Promise<Record<string,string>>` 的 helper」这一类，属于依赖版本漂移，改动前的同一棵树上同样存在。

## 3. 接口联调（真实 HTTP，非推演）

登录 `100001` 返回权限：`repair.order:create`、`repair.order:read`、`device:read_self`、
`device:manage_self`、`benefit:read_self`、`diagnostic:run_self`、`diagnostic:read_self`。

| 场景 | 结果 |
| --- | --- |
| `GET /api/v1/customer/devices` | 2 台在用设备 |
| `GET /api/v1/customer/devices/{id}` | 设备信息 + 权益列表；权益状态**读取时现算**：有效（余 335 天）、已过保修期（过期 70 天）、长期有效 |
| 拿他人设备 ID | **404 `DEVICE_NOT_FOUND`**（不是 403） |
| `GET /api/v1/diagnostics/catalog` | 6 类 × 2 问，选项只下发 `code`/`label`，**不含 `signal`** |
| `POST /api/v1/customer/diagnostics/sessions`（屏幕类） | `NEEDS_SERVICE`，附理由与建议动作 `CHECK_BENEFIT` |
| 同上（电池类走自助路径） | `SELF_SERVICE`，附 4 条处理步骤 |
| 同上但请求体自带 `outcome` | **被忽略**，结论仍由服务端算 |
| 少答 / 多答 / 重复答 | `VALIDATION_FAILED`，逐字段报错 |
| `GET /api/v1/customer/diagnostics/sessions` | 返回本人 2 条记录 |

## 4. 模拟器验收

截图在 [`docs/verification/issue-102/`](./issue-102/)，按 issue 要求的路径走完：

### 4.1 查看设备 → 权益

| 截图 | 内容 |
| --- | --- |
| `01-service-page.jpeg` | 服务页：我的设备卡（宿舍台式机）+「故障问诊」卡 |
| `07-device-list.jpeg` | 我的设备：2 台在用设备，各自「暂无关联报修」 |
| `08-device-detail-benefits.jpeg` | 设备详情：权益按 有效 → 已过保修期 → 已作废 排序，天数现算 |

### 4.2 进入检测 → 结果

| 截图 | 内容 |
| --- | --- |
| `02-diagnostic-entry.jpeg` | 检测与帮助：盾牌、进入检测、6 个分类折叠卡、声明「结论不等于硬件检测」 |
| `03-diagnostic-category.jpeg` | 第 1 步选分类 |
| `04-diagnostic-question-1.jpeg` | 电池类第 1/2 问 |
| `05-diagnostic-question-2.jpeg` | 第 2/2 问（答完自动提交） |
| `06-diagnostic-result.jpeg` | 结果「建议到店确认」，逐条列「你选的是」+ 理由 + 声明 + 「查看我的设备权益」 |

### 4.3 新增设备（手填绑定）

| 截图 | 内容 |
| --- | --- |
| `09-device-form-empty.jpeg` | 新增设备表单：名称 / 品牌 / 型号必填，序列号与购买日期选填 |
| `10-device-form-filled.jpeg` | 填「实验样机 / 联想 / ThinkPad T14」 |
| `11-device-saved.jpeg` | 保存成功提示「设备已保存。保修权益需由门店工作人员登记后才会出现在详情里。」 |
| `12-device-no-benefit.jpeg` | 新设备详情：「暂无权益记录」——**不编造保修数据** |

### 4.4 创建报修 → 查看进度

| 截图 | 内容 |
| --- | --- |
| `13-device-no-repair.jpeg` | 宿舍台式机详情底部：「这台设备还没有报修记录」 |
| `14-repair-form.jpeg` | 从设备发起报修，机型 / 故障描述 / 电话已填 |
| `15-repair-submitted.jpeg` | 「报修已提交」，列表出现「自组机 R5 5600 · 待受理」 |
| `16-device-repair-linked.jpeg` | **返回设备详情，「关联报修」自动出现这张单**（待受理 · 2026-11-28 00:06） |
| `17-repair-progress.jpeg` | 报修详情：设备信息带「报修设备」标记、状态、故障与联系信息、服务进度时间线 |

数据库侧核对：这张单的 `repair_orders.device_id` 落成了 `bb94be6e-…`，不是 `NULL`，
说明 App 确实把设备 ID 传到了服务端，而不是只在界面上显示。

## 5. 这一轮验收里发现并修掉的 3 个真问题

1. **报修提交后返回设备详情，「关联报修」不刷新。**
   界面仍写「这台设备还没有报修记录」，必须手动点右上角刷新才对。
   原因是 `DeviceDetailPage` 只在 `aboutToAppear` 拉一次，没有订阅上级的设备变更计数。
   修法：加 `@Prop @Watch('onDeviceRevisionChanged') deviceRefreshVersion`，由 `HomePage` 传入
   `serviceDeviceRevision`；编辑表单打开或解绑进行中不重拉，避免顶掉用户正在填的内容。
2. **检测结果的日期按 UTC 截取，北京时间 0 点到 8 点之间会显示成前一天。**
   原先写 `createdAt.substring(0, 10)`，2026-11-28 00:11 的检测记录显示成 `2026-11-27`，
   跟同一时刻的报修单（00:06）对不上。修法：`DiagnosticContract.formatSessionDay()` 按本地时区算，
   与 `RepairOrderContract.formatOrderTime()` 的处理保持一致。
3. **`devices:demo` 脚本不读 `.env`，必被 `assertExperimentDatabase` 拦下。**
   补 `loadEnvFile(".env")` 后正常。

## 6. 未验证 / 已知不足（重要）

| 项目 | 说明 |
| --- | --- |
| 工作人员登记权益、管理员作废 | **只有接口，App 没有页面**。演示权益由 `devices:demo` 脚本写入，App 侧没有「登记入口」。客户能看、能按状态区分，但工作人员目前要在接口层操作 |
| 数据库集成测试 | `pnpm test:db` 未跑（需单独准备实验测试库与变量），本轮验证走的是手工 HTTP + 模拟器 |
| 从设备发起报修时的预填 | 进入报修表单后，设备机型与序列号**不会自动带入**，需要再手输一遍；设备 ID 是带上了的。属于体验缺陷，本轮未改 |
| 真实签名 / 实机 | 未配置 `signingConfigs`，只在模拟器上装了未签名包；实体设备另需签名材料 |
| ArkTS 静态检查 | 只有 hvigor 编译期的 ArkTS 检查（本轮仅有 `ProfilePage.ets:175` 一条既有 WARN），没有单独的 lint 规则集 |

## 7. 复现步骤

```bash
cd backend
corepack pnpm install && corepack pnpm db:migrate:deploy && corepack pnpm db:seed
corepack pnpm accounts:prepare
corepack pnpm devices:demo -- --account 100001
corepack pnpm dev            # 13080
```

```bash
cd app
# 用 DevEco Studio 打开，或命令行 hvigor assembleHap 后 hdc install -r
# App「连接设置」里把 API 指向 http://127.0.0.1:13080（模拟器需 rport 或 10.0.2.2）
```

然后按第 4 节的顺序走一遍，重点看三处：

1. 权益三种状态（有效 / 已过保修期 / 已作废）的排序与文案；
2. 设备有未完成报修时解绑 → 409 `DEVICE_IN_USE`；
3. 检测结果页的「你选的是」逐条理由，以及客户端传 `outcome` 会不会被采纳（不会）。
