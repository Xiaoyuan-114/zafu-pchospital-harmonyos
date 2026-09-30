# 鸿蒙电脑医院

四人课程项目，使用 ArkTS / ArkUI 实现原生 HarmonyOS 手机 App，界面参考“我的华为”。开发范围见 [开发方案](docs/development-plan.md)，进度由团队自行安排。

主要功能：客户报修与进度查询、工作人员处理与维修备案、带来源的 AI 问答、维修案例审核回流。当前工程只有首页、三个模块入口、导航和主题；登录与业务接口尚未接入。

## 保留内容

```text
AppScope/                 应用信息和图标
entry/src/main/ets/       页面与模块骨架
  core/                   会话、网络、导航和主题
  features/               客户服务、工作人员、知识问答
entry/src/main/resources/ 应用资源
hvigor/                   构建配置
docs/development-plan.md  功能范围与业务基础
docs/reference/my-huawei/ 五张参考截图
AGENTS.md                 简短开发规则
```

## 打开和运行

工程使用 HarmonyOS 6.1.1 / API 24。本机 DevEco Studio 位于 `D:\DevEco Studio`。请把仓库克隆到纯英文目录，例如 `E:\codes\pchospital-harmonyos`，用 DevEco Studio 打开根目录，安装依赖后构建 `entry`；连接设备并配置本机签名后运行。

命令行构建可在 DevEco 的终端中执行：

```powershell
$env:DEVECO_SDK_HOME = 'D:\DevEco Studio\sdk'
ohpm install
hvigorw --mode module -p product=default assembleHap
```

2026-09-30 已从精简后的仓库源码在英文目录重新执行 `ohpm install` 和 `assembleHap`，结果 **BUILD SUCCESSFUL**，产物为未签名 HAP。`hdc list targets` 返回 `[Empty]`，尚未做真机安装。中文父目录会触发 Hvigor `Invalid project path`，因此不能在当前中文工作区直接构建。

## 本地后端

[课设后端仓库](https://github.com/Xiaoyuan-114/zafu-pchospital-experiment-api)直接使用本机 Node / pnpm 和 MySQL，启动方法以其 README 为准。开发不使用 Docker，也不要求域名或服务器部署。

后端在电脑上运行时，App 真机需与电脑处于同一网络，API 地址填电脑的局域网 IP 和实际端口；手机上的 `localhost` 指向手机自身。网络与原生登录仍需实际联调。

## 开发方式

直接按功能推进，不使用 Issue 拆分、固定周计划或强制 PR 审批。提交前检查相关变更，构建、接口和真机验证分别记录实际结果。

- [开发方案](docs/development-plan.md)
- [五张参考截图](docs/reference/my-huawei/README.md)
- [Agent 开发规则](AGENTS.md)

业务基础来自原维护者授权复用的 [电脑医院 Web 项目](https://github.com/ZAFU-PCHospital/zafu-pchospital-web)。
