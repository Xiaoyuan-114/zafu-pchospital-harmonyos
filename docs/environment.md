# 环境与验证记录

## 本机盘点（2026-09-29）

- GitHub：`Xiaoyuan-114` 已认证，有 `repo` 权限；个人公开仓库已创建。
- DevEco Studio：安装于 `D:\DevEco Studio`；本地 SDK `sdk/default/hms` 和 `openharmony` 存在，SDK 包显示 HarmonyOS 6.1.1/API 24；Hvigor 6.24.4 可执行。
- `hdc list targets` 返回 `[Empty]`，目前没有连接的真机或模拟器。因此不能报告装机、截图或跨角色真机验收。
- 首次在含中文的工作区路径运行 `ohpm install` 成功，但 `hvigorw --mode module -p product=default assembleHap` 被 Hvigor 拒绝：`00306003 Invalid project path`。Junction 别名也未通过路径检查。
- 将源码复制到纯英文的临时目录 `E:\codes\pchospital-harmony-stage`，设置 `DEVECO_SDK_HOME=D:\DevEco Studio\sdk`，运行 `ohpm install` 和 `hvigorw --mode module -p product=default assembleHap`：**BUILD SUCCESSFUL**。更新自制图标后的最终构建产物为 `entry-default-unsigned.hap`（SHA-256 `9fb46ee70287ed049979f598511d679c7b0b39e5cc695788fd4daf3c308ceb54`）；因仓库不含签名配置而未签名。该构建仅验证可编译，未进行安装或运行。
- 课程要求的目标 SDK/API、设备型号和调试授权仍待团队确认。

## 本地实验后端配置样例（计划）

以下只用于新建的实验服务；变量名需在其仓库合同定稿后调整。不要填写生产值或提交真实 `.env`。

```dotenv
APP_BASE_URL=https://experiment.example.invalid
DATABASE_URL=mysql://course_user:replace-me@127.0.0.1:3306/pchospital_course_test
OBJECT_STORAGE_BUCKET=pchospital-course-test
```

App 的 API Base URL 需要由构建配置或本机调试配置注入，默认不得指向生产域名。首次连调前核查 TLS、设备网络、测试账号和数据库隔离。
