# 鸿蒙电脑医院

四人 HarmonyOS 原生课程项目，以“我的华为”为参考，围绕校园电脑服务建设 **服务、选购、活动与论坛** 的小型平台。前后端同仓：ArkTS / ArkUI App，Next.js API，独立课设 MySQL；不使用 Docker。

## 当前目标与工作状态

**2026-11-25 当前目标：以团队立项 PPT 和“我的华为”参考页面为依据，提高功能与视觉还原度，贯通本地汇报流程。** 已有维修、知识、账号、活动、选购和论坛；继续打磨商城，并补齐设备权益、检测、关注、圈子与积分。新增功能的具体规则在对应 Issue 与维护者讨论后确定。

团队采用本机后端和独立课设数据库进行开发与演示。旧开发方案、旧页面映射及 Web 迁移任务书保留历史；最新范围和任务以本 README 为准，既有需求背景见 [当前目标](docs/current-goals.md)。

### 页面映射与参考图

客户：**首页｜活动｜服务｜选购｜我的**。工作人员：**首页｜活动｜工作台｜选购｜我的**。

| 页面 | 参考图片 | 当前目标 |
| --- | --- | --- |
| **首页** | [首页](docs/reference/my-huawei/home-navigation.jpg) | 大标题、搜索、主视觉、快捷服务与液态玻璃底栏，聚合真实服务/活动/选购入口 |
| **活动** | [花粉](docs/reference/my-huawei/community-huafen-feed.jpg)、[信息流](docs/reference/my-huawei/community-circle-detail-feed.jpg)、[帖子详情](docs/reference/my-huawei/community-event-post-detail.jpg) | 组织活动与论坛，已有报名和用户发帖/评论；关注、圈子、积分和打卡待讨论实现 |
| **服务／工作台** | [服务](docs/reference/my-huawei/service-my-products-repair-entry.jpg)、[检测与帮助](docs/reference/my-huawei/service-diagnostics-help.jpg) | **知识库迁入服务**，保留 AI 问诊、指南/案例/搜索、报修与进度；工作人员保留处理、备案、审核与现场能力 |
| **选购** | [选购](docs/reference/my-huawei/shopping-category-navigation.jpg)、[订单筛选与空态](docs/reference/my-huawei/shopping-orders-empty-state.jpg) | **恢复选购语义**，提供二手商品、硅脂等维修耗材、真实下单和买卖双方订单管理 |
| **我的** | [我的](docs/reference/my-huawei/my-account-service-record-entry.jpg)、[账号资料](docs/reference/my-huawei/account-profile-sheet.jpg) | 原资料/报修/报名/收藏/消息，加购物订单、本人商品、卖家订单和我的帖子入口 |

五栏导航、知识迁入服务以及选购/论坛基础功能已合入。全部 16 张参考图见 [图片索引](docs/reference/my-huawei/README.md)。商品详情等缺失参考图的页面应补采截图或记录设计依据。

### 已确认规则

- **交易**：线下付款取货，App 内完成商品、下单、库存、取消、交付完成与订单查询，不接线上支付和配送，不伪造支付成功。
- **二手发布**：登录用户可发布；卖家编辑/下架本人商品、处理本人订单；管理员可下架商品。游客可浏览，写操作及本人记录按需登录。
- **活动＋论坛**：社团发布活动；登录用户可发帖/评论，作者可删除本人内容，管理员可管理。关注、圈子、积分和打卡已列为后续目标，规则待讨论；私信和推荐算法不在当前任务范围。
- **服务与权限**：知识迁入服务但不删除已有指南、搜索、引用和问答；公开/内部知识及成员/管理员边界保持。购物订单、客户报修单和工作人员维修备案分别建模。
- **规划默认值**：首版单商品直接下单；二手库存1、耗材支持数量并由授权工作人员维护；待取货→完成/取消。具体角色表、取消/库存规则和可调整项见 [当前目标](docs/current-goals.md#选购二手商品与维修耗材)，开工在 Issue 记录，不额外加审批流程。

## 当前模块任务

当前任务不预分配新负责人、不设固定排期。一个任务可分几个 PR 交付，状态在同一 Issue 内更新。

| 顺序 | Issue | 任务书与依赖 |
| --- | --- | --- |
| 01 | [#101 商城页面还原与交互打磨](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/101) | 包括购物订单页、选购、商品详情与买卖流程 |
| 02 | [#102 设备、权益查询与检测流程](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/102) | 具体数据、权限和检测方式待讨论 |
| 03 | [#103 关注、圈子、积分与打卡](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/103) | 在现有社区与活动基础上补齐，具体规则待讨论 |
| 04 | [#42 统一还原打磨、联调与课程演示](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/42) | [原任务书](docs/tasks/current-goals/04-polish-demo.md)；汇总跨模块验收及汇报材料 |

#83 导航、#84 选购基础、#85 论坛基础已关闭；本轮继续按上表打磨与补齐，#42 汇总最终演示。

## 当前实际进度

2026-11-25 对照 `main 65b3ea3` 与团队立项 PPT；下表区分现有功能和后续目标。

| 范围 | 当前情况 |
| --- | --- |
| 原生底座与账号 | 已有游客先浏览、按需登录/注册、会话与双角色入口，保留现有改密/权限规则 |
| 维修服务与知识 | 已有报修、进度、工作人员处理、备案审核、指南/案例阅读与搜索、AI 问答；知识已迁入服务。设备权益及检测流程见 #102 |
| 个人功能 | 已有资料、收藏、消息、购物/卖家订单、本人商品和帖子入口；客户维修记录仍显示未接入 |
| 活动与论坛 | 已有活动报名、本人状态、现场管理、图文发帖和评论；关注、圈子、积分与打卡见 #103 |
| 选购交易 | 已有商品发布、浏览、线下下单和买卖双方订单；商城页面继续按 #101 打磨 |
| 汇报验证 | 2026-11-25 本机 API 跑通购物、论坛、活动签到和报修状态流转；模拟器实际下单、评论、保存资料并读取各链路结果。统一参考对照与全程 App 录屏见 #42 |

已有证据：[三个页面还原](docs/verification/three-reference-pages-20261014.md)、[阅读详情 #75](docs/verification/issue-75.md)、[知识目录/搜索 #76](docs/verification/issue-76.md)、[活动详情/本人状态 #77](docs/verification/issue-77.md)、[活动闭环收尾](docs/verification/issue-62-completion.md)、[个人资料/备案修复](docs/verification/issue-61-review-fixes.md)。无需因方向调整重跑这些模块的全部旧测试。

## 克隆与目录

```powershell
git clone https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos.git E:/codes/pchospital-harmonyos
cd E:/codes/pchospital-harmonyos
```

使用英文路径，避免 Hvigor 的中文父目录限制。DevEco 打开 `app/`，后端命令在 `backend/` 执行。

```text
app/                         HarmonyOS 原生工程：core 公共层、features 业务
backend/                     Next.js API、Prisma/MySQL、迁移及必要测试
docs/current-goals.md         当前需求分析、页面映射、范围及验收
docs/tasks/current-goals/     已完成基础模块和历史任务书
docs/reference/my-huawei/     16 张参考截图与索引
docs/verification/            实际验证与截图，按当次版本/设备阅读
AGENTS.md                    编码与协作规则
```

## 运行与开发

### 仅开发 App

DevEco Studio 打开 `app/`，安装工程所需 SDK/依赖，选择模拟器或连接设备后运行 `entry`。当前工程使用 **HarmonyOS 6.1.1 / API 24**；实体设备需配置本机签名。

项目使用**本机后端和独立课设数据库**。App 默认使用 `http://10.0.2.2:13080`，供模拟器访问电脑本机后端；旧共享地址自动迁移至该默认值，其他自定义地址保留。实体手机请在登录页「连接设置」填写电脑局域网 IP 和端口，并让手机与电脑处于同一网络。

原测试账号：客户 `100001/customer123`、工作人员 `100002/staff123`、管理员 `100003/admin123`；各环境需实际准备账号。交易/论坛开发尽量使用独立课设账号，避免多人操作同一笔数据。

```powershell
cd app
$env:DEVECO_SDK_HOME = 'D:/DevEco Studio/sdk'
$env:Path = 'D:/DevEco Studio/tools/node;' + $env:Path
& 'D:/DevEco Studio/tools/ohpm/bin/ohpm.bat' install
& 'D:/DevEco Studio/tools/hvigor/bin/hvigorw.bat' --mode module -p product=default assembleHap
```

本机 DevEco 路径仅为示例，按成员安装位置调整。模拟器可用 `hdc list targets` 检查连接；安装和真实操作结果与单纯构建通过分开记录。

### 修改后端时

要求 Node.js 24、Corepack、本机 MySQL。先按 [后端 README](backend/README.md) 和 [本地开发](backend/docs/local-development.md)配置独立开发/测试库，保留已有 `.env` 与课设数据。

```powershell
cd backend
corepack pnpm install --frozen-lockfile
corepack pnpm setup:local
corepack pnpm accounts:prepare
corepack pnpm knowledge:index  # 本地生成知识索引；无向量配置时使用关键词
corepack pnpm dev --port 13080
```

健康接口 `http://localhost:13080/api/v1/health`；App 登录页“连接设置”可切换 API。模拟器访问本机通常使用 `http://10.0.2.2:13080`，手机使用电脑局域网 IP；设备上的 localhost 指向设备自身。

App 只访问 API，原生通道使用 `X-Client-Type: native` 和 Bearer，会话/权限由服务端认定。数据库密码和模型 Key 只放后端；不接原 Web 生产库、不迁移其数据。

### 必要检查与提交

只检查本次改动及受影响链路：文档检查链接/范围；ArkTS 构建 HAP并实际模拟器操作；新增交易/论坛接口检查真实返回、相关权限与必要状态/库存回归。无关全仓审计、全库测试和收费模型评测不作为常规步骤。

功能分支与 PR 提交，普通 Merge；不直接推 main、不强推、不要求另一位成员批准。CI `backend-check` 仍按仓库规则执行。组员交付提供页面对照、实际截图、检查结果及未验证项，不能以假数据或占位页面宣称完成。

汇报使用本地后端与课设数据库；模型问答若需展示，按 [知识配置](backend/docs/knowledge-ai.md)准备模型和索引。

## 文档索引

- [当前目标与需求分析](docs/current-goals.md)、[当前四个模块任务](#当前模块任务)
- [开发方案与历史基线](docs/development-plan.md)、[旧 Web 迁移任务](docs/tasks/web-migration/README.md)（保留历史，冲突处以当前目标为准）
- [参考图索引](docs/reference/my-huawei/README.md)、[项目规则](AGENTS.md)
- [后端快速开始](backend/README.md)、[本地配置](backend/docs/local-development.md)、[知识配置](backend/docs/knowledge-ai.md)
- [原生鉴权](backend/docs/native-client-api.md)、[维修接口](backend/docs/native-repairs-api.md)、[活动接口](backend/docs/native-activities-api.md)、[知识浏览接口](backend/docs/knowledge-browse-api.md)
