# 鸿蒙电脑医院（课程实验）

独立的 HarmonyOS 原生手机应用课程项目。面向客户与工作人员两类角色，后续围绕客户报修、受理、维修备案、知识问答和审核回流形成真实业务链。此仓库与[原 Web 平台](https://github.com/ZAFU-PCHospital/zafu-pchospital-web)及[社团手册](https://github.com/ZAFU-PCHospital/ZAFU-PCHospital-Doc)有需求来源关系，代码和数据独立；不连接生产库，不收录生产密钥或真实维修资料。

## 范围与进度

- 参照对象：以“我的华为”App 服务板块的信息组织为主要参考；其实际版本和页面截图待团队核验。电脑设备场景可参考其他服务应用，知识内容参考获授权的社团手册。
- 客户：后续创建报修/预约、看本人进度、查询有来源的知识、人工确认 AI 生成的报修草稿。
- 工作人员：后续受理和更新状态、填写维修备案、按权限审核记录与知识卡。
- **当前已完成**：ArkTS/ArkUI Stage 工程、首页及三条可导航的模块入口、资源主题和模块目录、项目文档与协作模板。
- **当前未完成**：登录、实验后端、报修业务、维修处理、知识检索、AI 回答、审核回流。当前页面明确标注“待接入”，没有模拟数据。

```text
entry/src/main/ets/
  core/auth/       会话契约与安全存储（待实现）
  core/network/    API 信封、请求和错误处理（待实现）
  core/ui/         导航与主题基础
  features/service/   客户服务入口
  features/repair/    工作人员工作台入口
  features/knowledge/ 知识问答入口
docs/             核查记录、架构决策、环境与待确认事项
```

客户端只访问独立实验后端；服务端负责权限、报修与维修对象、数据库、知识索引和 AI 服务。原 Web API 目前采用 Cookie Session 与写请求 Origin 校验，**尚不能直接作为原生 App 的 Bearer 鉴权接口**，详见[接口盘点](docs/source-audit.md)。

## 环境与运行

本机验证环境：DevEco Studio 安装于 `D:\DevEco Studio`，HarmonyOS SDK 6.1.1/API 24，Hvigor 6.24.4。课程指定版本仍待老师确认。需要 DevEco Studio、同版本 SDK、ohpm 与可调试的 HarmonyOS 手机或模拟器。**Windows 构建路径只能包含英文等受支持字符**；当前工作区的中文父目录会被 Hvigor 拒绝。请将仓库克隆到纯英文路径（例如 `E:\codes\pchospital-harmonyos`）后构建。

1. 用 DevEco Studio 打开仓库根目录；本机命令行构建设置 `DEVECO_SDK_HOME=D:\DevEco Studio\sdk`（指向含 `default/` 的目录）。`local.properties` 由 IDE 生成且不会提交。
2. 运行 `ohpm install`。
3. 运行 `hvigorw --mode module -p product=default assembleHap`，或在 IDE 选择 `entry` 的 Debug 构建。
4. 连接设备并配置本机签名后在 IDE 中运行 `entry`；目前设备状态与实际构建结果记录在[环境核验](docs/environment.md)。

项目尚无可用实验后端。后续使用[配置样例](docs/environment.md)建立独立服务、数据库、存储和测试账号；不要将生产 URL、Cookie、令牌或实际维修数据写入仓库。

## 协作入口

- [项目规则](AGENTS.md)
- [原始需求基线](docs/requirements-baseline.md)
- [原仓库接口与业务对象盘点](docs/source-audit.md)
- [架构决策与模块边界](docs/architecture.md)
- [环境与验证记录](docs/environment.md)
- [待确认事项](docs/open-questions.md)
- [Issue 依赖地图](docs/issue-map.md)
- [GitHub Issues](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues)

## 许可证

本仓库当前**未授予开源许可证**。仓库公开仅便于课程协作与展示，不代表允许复用代码、文档、品牌或手册。待团队确认原创代码及素材权属后，另行选择并提交许可证；原仓库与手册的许可证、引用许可应分别核实。
