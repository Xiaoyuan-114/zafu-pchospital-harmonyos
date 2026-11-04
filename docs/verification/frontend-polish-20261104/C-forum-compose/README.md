# 论坛 C：发布与我的帖子验收

日期：2026-11-04。设计依据为 [论坛设计方向](../../../tasks/current-goals/forum-design-direction.md)；信息流与详情分别接续 #91、#92。本模块基于 #92 的 `b6c23f8`，改动发布页、我的帖子页、返回处理与共用图片选择器。

## 页面与截图

| 页面或状态 | 改前 | 改后或过程 |
| --- | --- | --- |
| 发布页 | [原页面](compose-before.jpeg) | [发布页](compose-final.jpeg)、[表单校验](compose-validation.jpeg)、[离开确认](compose-leave.jpeg) |
| 图片 | — | [系统相册](picker-with-image.jpeg)、[预览](compose-preview-final.jpeg)、[发布后的详情](published-detail.jpeg) |
| 我的帖子 | [原页面](mine-before-same.jpeg) | [新版](mine-final.jpeg)、[第二页返回](mine-page2-return.jpeg)、[工作人员](staff-mine-final.jpeg) |
| 上传失败恢复 | — | [失败提示](upload-failed.jpeg)、[重试完成](upload-retried.jpeg) |
| 工作人员发图 | — | [发布详情](staff-image-published.jpeg) |

“我的帖子”前后对照使用相同的客户账号和本地数据；配图取自仓库已有截图。截图来自 Pura 90 模拟器（1320 × 2856）；预览、第二页及故障截图采自实现过程中的对应版本，最终页面截图来自本次构建。

## 实际检查

- `assembleHap` 成功，HAP 和构建时工作区源码摘要见 [version.json](version.json)，构建日志见 [build.log](build.log)。
- `node --import tsx --test` 执行论坛、游客登录、原生认证、商城和个人记录相关测试：89 项通过；`eslint tests/unit/forum-app.test.ts` 通过。输出见 [tests.log](tests.log)。
- 客户与工作人员分别从系统相册选图并通过真实本地 API 发帖、上传及查看详情；客户删除验收帖后，个人列表和公共列表均不再显示该帖。工作人员的个人列表显示其本人帖子。
- 空表单校验、草稿离开确认、相册取消、添加和移除图片、图片预览与返回均通过模拟器操作。
- 我的帖子加载第二页后进入详情发表评论，返回时保留原滚动位置并更新评论数；刷新重取已加载页。
- 使用 [本地故障代理](local-fault-proxy.cjs) 对首次图片上传注入一次 HTTP 503，其余请求转发隔离课设 API。重试后同一帖子成功获得图片，查询仅返回一条对应帖子；模拟器接口地址已恢复到本地 API。
- 已上传部分图片后再失败的多图续传与总数限制、创建请求结果不确定时的幂等键复用，由单元测试覆盖。

## 后续状态

真机、极端长文输入与键盘遮挡、创建请求异常的模拟器故障注入、维修页面复用图片选择器的实际选图，以及多图部分成功后失败的模拟器场景待验证。草稿跨进程持久化尚未实现。
