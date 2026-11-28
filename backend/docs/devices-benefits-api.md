# 设备、保修权益与检测接口（Issue #102）

面向客户的「我的设备 / 设备与权益 / 检测与帮助」，面向工作人员的「到店登记权益」。
会话与通道规则见 [原生客户端接口：登录与会话](native-client-api.md)；响应使用同一信封：
成功 `{ success, data, meta }`（列表分页在 `meta.pagination`），失败 `{ error: { code, message, fieldErrors? } }`。

## 先说清楚三条边界

1. **设备是客户自己填的绑定记录，不是从报修单反推的。** 旧版首页设备卡把报修单的
   `deviceModel` 去重当设备展示，同一机型的两台机器会被并成一条，没报修过的设备也不存在。
   本期改为独立表 `customer_devices`：客户在 App 里手填品牌 / 型号 / 序列号 / 购买日期。
2. **保修权益只能由工作人员登记，客户侧只读。** 客户有 `benefit:read_self`，没有
   `benefit:write`；接口层也没有「客户自报保修」的入口。这不是没做完，是刻意的权限边界 ——
   保修是门店的承诺，不能由客户端自己声明。
3. **权益状态是读时算出来的，不落库。** `EFFECTIVE / EXPIRED / VOID` 由 `end_on` 与当天
   （上海日历日，`shanghaiToday()`）在 `toBenefitView()` 里比较得出。不做定时任务改库，
   避免「任务没跑 → 过期记录仍显示有效」。`VOID` 是人工作废（录错了撤销），`EXPIRED` 是
   日期过了，两者对客户的解释完全不同，因此不合并成一个 `INACTIVE`。

## 数据模型

`customer_devices`（Prisma `CustomerDevice`）

| 字段 | 说明 |
| --- | --- |
| `owner_user_id` | 归属账号，由会话写入，客户端不可传 |
| `label` / `brand` / `model` | 设备名称 / 品牌 / 型号，必填 |
| `serial_number` | 选填，最长 120；同一账号内唯一（`owner_user_id + serial_number`） |
| `purchase_on` | 选填，`DATE`；不允许晚于今天（录入错误，不是「未来才买」） |
| `source` | `SELF`（客户自填）。`REPAIR_IMPORT`（从历史报修单带入）预留但**本期没有写入路径**，服务端写死 `SELF`，不接受请求体声明 |
| `status` | `ACTIVE` 在用 / `RETIRED` 已解绑 |
| `deleted_at` | 软删时间戳，与 `RETIRED` 同时置位 |

`device_benefits`（Prisma `DeviceBenefit`）

| 字段 | 说明 |
| --- | --- |
| `device_id` | 所属设备 |
| `kind` | `WARRANTY` 整机保修 / `EXTENDED` 延保 / `SERVICE` 服务权益 / `ACCIDENT` 意外保障 |
| `name` / `provider` | 权益名称 / 提供方 |
| `start_on` / `end_on` | 生效日 / 截止日（`DATE`）；`end_on` 为空表示长期有效 |
| `region` | 适用区域，缺省「中国大陆」 |
| `total_uses` / `used_uses` | 可用次数 / 已用次数；`total_uses` 为空表示不限次，取值 0–999 |
| `state` | `ACTIVE` / `VOID`（人工作废）；**不含到期状态** |
| `note` | 备注，最长 200 |
| `created_by_user_id` | 登记人（工作人员或跑脚本的管理员） |

`repair_orders.device_id`：报修单可选关联一台已绑定设备。关联只影响展示
（设备详情里的「关联报修」），不改变报修流程本身的权限判定。

`diagnostic_sessions`（Prisma `DiagnosticSession`）

| 字段 | 说明 |
| --- | --- |
| `user_id` | 谁做的检测 |
| `device_id` | 选填，检测针对哪台设备；为空表示没指定 |
| `category_code` | 分类码，如 `BATTERY` |
| `answers` | JSON：`[{ questionCode, optionCode }]`，按目录顺序存 |
| `outcome` | 服务端算出的结论，客户端不可写 |
| `created_at` | 提交时间 |

**唯一索引与软删的坑**：`(owner_user_id, serial_number)` 唯一索引不会因为软删而释放。
所以「解绑后用同一个序列号重新绑定」走的是**复活原记录**（清 `deleted_at`、`status` 回
`ACTIVE`、覆盖可编辑字段），而不是新插一行 —— 新插会直接撞唯一约束。

## 权限

| 权限码 | 客户 | 工作人员（MEMBER） | 管理员（ADMIN） |
| --- | --- | --- | --- |
| `device:read_self` | ✅ | — | — |
| `device:manage_self` | ✅ | — | — |
| `benefit:read_self` | ✅ | — | — |
| `diagnostic:run_self` | ✅ | — | — |
| `diagnostic:read_self` | ✅ | — | — |
| `device:read` | — | ✅ | ✅ |
| `benefit:write` | — | ✅ | ✅ |
| `benefit:void` | — | — | ✅ |

归属判定是**逐行**做的，不是只看权限码（`device-policy.ts`）：

- `assertCanReadDevice`：本人设备（需 `device:read_self`；工作人员账号自己有设备时靠 `device:read` 兜底），
  或有 `device:read` 的工作人员；对非本人设备返回 `DEVICE_NOT_FOUND`（404）而不是 403，
  是为了不泄露「这个 ID 存在」。
- `assertCanReadBenefits`：本人设备需 `benefit:read_self`（工作人员账号靠 `device:read` / `benefit:write` 兜底），
  工作人员读他人权益需 `benefit:write` 或 `device:read`。设备详情页里的权益块也走它——
  否则详情页会绕过 `benefit:read_self`，这个权限码等于没用。
- `assertCanManageDevice`：只有本人。工作人员能读不能改客户的设备档案。
- `assertCanCreateDevice` / `assertCanRegisterBenefit` / `assertCanVoidBenefit`：按权限码。

## 客户接口

### GET /api/v1/customer/devices

本人设备列表。查询参数：`status=ACTIVE|RETIRED`（默认 `ACTIVE`，非法值 400）、`page`、`pageSize`。

`status=RETIRED` 是**查历史**：解绑同时写了 `deleted_at` 与 `status=RETIRED`，所以查这一档时
不再叠加软删过滤，否则两个条件互斥、永远返回空列表（App 目前没有入口用它，
留给「设备回收站」这类后续页面）。

`data` 为数组，元素：

```json
{
  "id": "…", "label": "我的办公本", "brand": "ThinkPad", "model": "X1 Carbon Gen 11",
  "serialNumber": "PF3K2Q9A", "purchaseOn": "2025-09-01", "source": "SELF",
  "status": "ACTIVE", "createdAt": "2026-11-27T10:00:00.000Z", "updatedAt": "…",
  "repairOrderCount": 2
}
```

`purchaseOn` 是日历日 `YYYY-MM-DD`（`DATE` 列存 UTC 零点再按 UTC 读回，跨时区不会退一天）。
`repairOrderCount` 含历史单，用来回答「这台机器修过几次」。

### POST /api/v1/customer/devices

```json
{ "label": "我的办公本", "brand": "ThinkPad", "model": "X1 Carbon Gen 11",
  "serialNumber": "PF3K2Q9A", "purchaseOn": "2025-09-01" }
```

`label` / `brand` / `model` 必填；`serialNumber` / `purchaseOn` 选填，留空即不传该键。
成功 `201`，`data` 为设备视图。错误：

| 错误码 | 场景 |
| --- | --- |
| `VALIDATION_FAILED` | 字段缺失/超长/日期格式错/购买日期晚于今天，`fieldErrors` 给出具体字段 |
| `DEVICE_SERIAL_CONFLICT` | 序列号已被本人另一台在用设备占用（409） |
| `FORBIDDEN` | 当前账号既没有 `device:manage_self` 也没有 `device:read`（正常客户与工作人员都过，仅限权限被收走的账号） |

序列号撞上**本人已解绑**的同一台机器时不报错，直接复活原记录并返回它。

### GET /api/v1/customer/devices/{id}

设备详情：设备本体 + 权益列表 + 最近 5 条关联报修。

```json
{
  "id": "…", "label": "我的办公本", "brand": "ThinkPad", "model": "X1 Carbon Gen 11",
  "serialNumber": "PF3K2Q9A", "purchaseOn": "2025-09-01", "source": "SELF",
  "status": "ACTIVE", "createdAt": "…", "updatedAt": "…", "repairOrderCount": 2,
  "benefits": [
    { "id": "…", "deviceId": "…", "kind": "WARRANTY", "name": "整机保修",
      "provider": "联想（中国）", "startOn": "2025-09-01", "endOn": null,
      "region": "中国大陆", "totalUses": null, "usedUses": 0, "remainingUses": null,
      "status": "EFFECTIVE", "daysRemaining": null, "note": null, "createdAt": "…" }
  ],
  "recentOrders": [
    { "id": "…", "status": "REPAIRING", "faultDescription": "风扇异响", "createdAt": "…" }
  ]
}
```

`daysRemaining`：距到期天数，长期有效或已作废为 `null`，已过期为负数。
`remainingUses`：`totalUses - usedUses`，不小于 0；不限次为 `null`。
`status`：`EFFECTIVE` 有效 / `NOT_STARTED` 还没生效（`startOn` 在今天之后）/
`EXPIRED` 已过期 / `VOID` 已作废。

非本人设备且无 `device:read` → 404 `DEVICE_NOT_FOUND`。

### PATCH /api/v1/customer/devices/{id}

整体覆盖可编辑字段，字段与新增一致（`label` / `brand` / `model` / `serialNumber` / `purchaseOn`）。
状态与来源不接收客户端输入。

**POST 兼容入口**：`@ohos.net.http` 的 `RequestMethod` 枚举在 API 24 上没有 PATCH，
App 用 `POST /api/v1/customer/devices/{id}` + `X-HTTP-Method-Override: PATCH` 调用，
两个入口共用同一份鉴权、校验与业务。缺这个头（或值不是 `patch`）一律 405 `METHOD_NOT_ALLOWED`，
不静默当成别的语义。

### DELETE /api/v1/customer/devices/{id}

解绑（软删：`deleted_at` + `status=RETIRED`）。设备还有未完成报修（`SUBMITTED`/`ACCEPTED`/`REPAIRING`）
时返回 409 `DEVICE_IN_USE`，提示等维修结束再解绑。

### GET /api/v1/customer/devices/{id}/benefits

单台设备的权益列表，`data` 为数组（与详情里的 `benefits` 同一份数据）。
单独开这个路径是为了「权益查询」只刷权益而不重拉设备与报修记录。

## 工作人员接口

### GET /api/v1/staff/devices?serial=PF3K2Q9A

按序列号查设备（到店登记前的核对步骤），需要 `device:read`。`serial` 必填，空值 400。
返回数组而不是单条：序列号只在同一账号内唯一，不同客户可能填了同一个串号。
每条额外带 `ownerDisplayName`，工作人员据此确认是谁的机器。

### POST /api/v1/staff/devices/{id}/benefits

为客户设备登记一条权益，需要 `benefit:write`。

```json
{ "kind": "WARRANTY", "name": "整机保修", "provider": "联想（中国）",
  "startOn": "2025-09-01", "region": "中国大陆", "note": "随机保修卡登记" }
```

`kind` 必须命中白名单；`endOn` 留空表示长期有效，一旦填写不得早于 `startOn`；
`totalUses` 留空表示不限次。成功 `201`，`data` 为权益视图（含算好的 `status` / `daysRemaining`）。
设备不存在或已解绑 → 404 `DEVICE_NOT_FOUND`。

## 管理员接口

### POST /api/v1/admin/benefits/{id}/void

作废一条权益，需要 `benefit:void`。只改 `state`，不删行：客户仍能看到「已作废」，
历史可追溯。重复调用幂等，返回当前状态（第二次不会再报错）。

## 检测（症状问答）

**这是「按你描述的现象归类」，不是硬件检测。** 服务端读不到电池健康度、屏幕和传感器数据，
也没有任何伪造的检测结果字段。分类目录写在代码里（`features/diagnostics/diagnostic-catalog.ts`），
6 类各 2 题；每题选项带一个 `signal`（`SELF` 自助可解 / `SERVICE` 该找客服 / `REPAIR` 该送修 /
`UNKNOWN` 说不清），`signal` **只用于服务端算结论，不下发给客户端**。

结论规则只有一条：取所选选项中**最严重**的 `signal`（`REPAIR > SERVICE > SELF > UNKNOWN`），
不做加权打分、不按顺序打断 —— 这样「最后一个问题选了没事」也不会把「电池鼓包」降级成自助。

### GET /api/v1/diagnostics/catalog

检测目录，需要登录（`diagnostic:run_self` 或 `diagnostic:read_self` 任一即可）。
`data` 是**对象**，含分类数组与固定声明：

```json
{
  "categories": [
    {
      "code": "BATTERY",
      "title": "电池与充放电",
      "icon": "battery",
      "scope": "判断不了电池健康度和实际容量",
      "questionCount": 2,
      "questions": [
        {
          "code": "BATTERY_SYMPTOM",
          "title": "电池方面最接近哪种情况？",
          "options": [
            { "code": "DRAIN_FAST", "label": "掉电特别快，一天要充两次以上" },
            { "code": "SWELLING", "label": "机身鼓起来，或后盖被顶开" }
          ]
        }
      ]
    }
  ],
  "disclaimer": "结论来自你选择的症状，对照的是本地故障分类目录，不是对设备的检测结果…"
}
```

**`options` 必须下发**：App 靠 `questions[].options` 渲染每一问的选项，只给题干的话
客户端收不到答案、页面直接空掉。字段名是 `title`（不是 `label`），每题还带 `questionCount`
所在分类的题数。

`options[]` 里只有 `code` 与 `label`，**没有 `signal`**——判定规则留在服务端，
客户端既改不了结论，也拼不出一个「必定判为在保」的请求。

### POST /api/v1/customer/diagnostics/sessions

```json
{ "categoryCode": "BATTERY", "deviceId": "…可选…",
  "answers": [ { "questionCode": "BATTERY_SYMPTOM", "optionCode": "DRAIN_FAST" },
               { "questionCode": "BATTERY_AFTER_RESET", "optionCode": "STILL_BAD" } ] }
```

- 每个问题**必须且只能答一次**；漏答、重复答、未知的 `categoryCode` / `questionCode` / `optionCode`
  都返回 `VALIDATION_FAILED` 并在 `fieldErrors` 指名具体位置。
- 请求体里带的 `outcome` **一律忽略**，结论只由服务端按上面的规则算，客户端改不了。
- `deviceId` 选填；填了就必须是本人设备，否则 404 `DEVICE_NOT_FOUND`。

成功 `201`：

```json
{
  "id": "…", "categoryCode": "BATTERY", "categoryTitle": "电池与充放电",
  "deviceId": null, "createdAt": "2026-11-27T16:11:00.000Z",
  "outcome": "NEEDS_SERVICE",
  "headline": "建议到店确认",
  "detail": "现象指向硬件或系统层面，用软件操作改变不了…",
  "steps": [],
  "answers": [ { "questionCode": "BATTERY_SYMPTOM", "questionTitle": "电池方面最接近哪种情况？",
                 "optionCode": "DRAIN_FAST", "optionLabel": "掉电特别快…",
                 "reason": "耗电快既可能是电池老化…" } ],
  "suggestedAction": "CHECK_BENEFIT",
  "decisiveOption": "机身鼓起来，或后盖被顶开",
  "disclaimer": "结论来自你选择的症状，对照的是本地故障分类目录，不是对设备的检测结果…"
}
```

`outcome` 取值：`SELF_SERVICE` / `NEEDS_SERVICE` / `NEEDS_REPAIR` / `INCONCLUSIVE`。
`suggestedAction` 取值：`SELF_STEPS` / `CHECK_BENEFIT` / `SUBMIT_REPAIR` / `ASK_STAFF`，
对应结果页那个主按钮该跳到哪。

`decisiveOption` 是「把结论拉到这一档的那个选项」的文案，用于回答「为什么是这个结论」；
记录里的 `answers[]` 逐条给 `reason`，两者合起来让结论可复核。目录改动后旧记录可能
解析不出，此时为空串。

### GET /api/v1/customer/diagnostics/sessions

本人检测记录，按时间倒序，分页同其他列表。`GET /api/v1/customer/diagnostics/sessions/{id}`
取单条，非本人记录 404 `DIAGNOSTIC_SESSION_NOT_FOUND`（同样不区分「不存在」与「不是你的」）。

检测记录**只是留痕**：它不写回设备状态，也不自动生成报修单。结果页的「提交报修」是让用户
带着 `deviceId` 跳到报修表单，由用户自己确认提交。

## 演示数据

`prisma db seed` 只建角色 / 分类 / 技能字典，**不建账号**，所以演示设备挂在现成账号上：

```bash
cd backend
corepack pnpm accounts:prepare                       # 首次：准备课设测试账号
corepack pnpm devices:demo -- --account 100001       # 给该客户补 2 台设备 + 4 条权益
corepack pnpm devices:demo -- --account 100001 --staff 100002   # 指定权益登记人（默认即 100002）
```

脚本用固定 UUID upsert，可重复执行；权益起止日期按当天重算，保证演示当天
「有效 / 已过期 / 已作废」三种状态各有一条。它只按 `--account` 现查账号，
不硬编码用户 UUID，也不创建账号；`assertExperimentDatabase` 会先拦住非课设库。

**权益的 `created_by_user_id` 写的是工作人员账号（默认 100002），不是客户自己**：
整个权限设计的地基是「保修只能由工作人员登记，客户自证不算」，演示数据若图省事
挂在客户名下，界面一旦显示登记人就会自相矛盾。找不到该账号时脚本直接报错并提示先跑
`accounts:prepare`。

清理：删除 `customer_devices` / `device_benefits` 中 `id` 以 `10200000` 开头的行。

## 本期未做

- **工作人员登记权益 / 管理员作废的 App 页面**：两个接口已就绪并可在接口层调通，App 侧本轮
  只做客户视角。演示权益由 `devices:demo` 脚本写入。
- **权益次数核销**：`used_uses` 没有任何接口能改，只能直接改库；但 `remainingUses`
  已经下发并在设备详情显示成「可用次数 3 / 4 次」。这个数字目前是不可变的摆设——
  收敛方式二选一：加 `benefit_redemptions` 核销流水，或把次数展示从界面和接口里去掉。
- **自动硬件检测**：明确不做。检测结论来自用户选择的症状，与设备实际读数无关，
  接口文案里已写明这一点（`disclaimer`）。
