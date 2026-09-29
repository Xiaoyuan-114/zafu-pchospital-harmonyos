# Issue 依赖地图

每个里程碑内的两位编号用于列表排序；实际开工顺序以“前置”依赖为准，可并行的任务无需等待较小编号完成。每项默认未分配，成员认领时填写 owner 与 reviewer。

| 顺序 | Issue | 阶段 | 优先级 | 前置 |
|---|---|---|---|---|
| `W1-2/01` | [#1](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/1) 核准 SDK 与真机调试基线 | W1–2 | P0 | 无 |
| `W1-2/02` | [#2](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/2) 建立隔离的实验后端与测试资源 | W1–2 | P0 | 无 |
| `W1-2/03` | [#3](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/3) 定稿客户报修、活动报名与维修备案对象关系 | W1–2 | P0 | 无 |
| `W1-2/04` | [#4](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/4) 采集参照 App 服务页面与本项目映射 | W1–2 | P1 | 无 |
| `W1-2/05` | [#5](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/5) 清点可用于实验的手册与案例授权 | W1–2 | P0 | #2 |
| `W1-2/06` | [#6](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/6) 实现实验后端原生 Bearer 会话契约 | W1–2 | P0 | #2, #3 |
| `W1-2/07` | [#7](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/7) 接入 App 网络层与登录会话 | W1–2 | P0 | #1, #6 |
| `W1-2/08` | [#8](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/8) 配置客户与工作人员测试身份及权限矩阵 | W1–2 | P0 | #2, #6 |
| `W1-2/09` | [#9](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/9) 统一导航、主题和表单列表状态组件 | W1–2 | P1 | #1 |
| `W3-4/01` | [#10](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/10) 新增客户报修单模型与状态迁移 | W3–4 | P0 | #3, #8 |
| `W3-4/02` | [#11](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/11) 提供报修创建、本人列表与详情 API | W3–4 | P0 | #10, #6 |
| `W3-4/03` | [#12](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/12) 提供工作人员受理与状态时间线 API | W3–4 | P0 | #11 |
| `W3-4/04` | [#13](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/13) 实现客户报修表单与照片提交 | W3–4 | P0 | #7, #9, #11 |
| `W3-4/05` | [#14](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/14) 实现我的报修列表、详情和进度刷新 | W3–4 | P0 | #7, #11 |
| `W3-4/06` | [#15](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/15) 实现工作人员待处理列表与详情 | W3–4 | P0 | #7, #9, #11, #8 |
| `W3-4/07` | [#16](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/16) 实现受理、状态更新与操作说明 | W3–4 | P0 | #12, #15 |
| `W3-4/08` | [#17](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/17) 关联报修单与维修备案并提交审核 | W3–4 | P0 | #10, #12 |
| `W3-4/09` | [#18](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/18) 完成无 AI 的跨角色真机业务链验收 | W3–4 | P0 | #13, #14, #16, #17 |
| `W5-6/01` | [#19](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/19) 导入授权手册章节并保留引用定位 | W5–6 | P0 | #5, #2 |
| `W5-6/02` | [#20](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/20) 建立历史案例脱敏与可用性审查清单 | W5–6 | P1 | #5 |
| `W5-6/03` | [#21](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/21) 冻结首批知识问答评测问题集 | W5–6 | P1 | #5, #3 |
| `W5-6/04` | [#22](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/22) 提供授权检索与可打开的引用 API | W5–6 | P0 | #19, #6 |
| `W5-6/05` | [#23](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/23) 实现知识搜索、引用与详情页面 | W5–6 | P1 | #7, #22 |
| `W5-6/06` | [#24](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/24) 实现有依据回答、追问与无命中处理 | W5–6 | P0 | #22, #21 |
| `W5-6/07` | [#25](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/25) 生成可编辑报修草稿并人工提交 | W5–6 | P0 | #24, #11, #13 |
| `W7-8/01` | [#26](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/26) 从已审核维修记录抽取带证据故障卡 | W7–8 | P0 | #17, #20 |
| `W7-8/02` | [#27](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/27) 实现故障卡审核、退回与发布权限 | W7–8 | P0 | #26, #22 |
| `W7-8/03` | [#28](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/28) 实现审核案例增量索引与撤回 | W7–8 | P0 | #27 |
| `W7-8/04` | [#29](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/29) 真机验证维修案例审核回流与越权 | W7–8 | P0 | #28, #25, #18 |
| `W9-10/01` | [#30](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/30) 选择并验证一个原生鸿蒙能力 | W9–10 | P1 | #1, #18 |
| `W9-10/02` | [#31](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/31) 完成参照页面对照与视觉打磨 | W9–10 | P1 | #4, #18, #23 |
| `W9-10/03` | [#32](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/32) 运行检索、回答与建单评测并归档失败例 | W9–10 | P0 | #21, #24, #29 |
| `W9-10/04` | [#33](https://github.com/Xiaoyuan-114/zafu-pchospital-harmonyos/issues/33) 完成真机回归、演示脚本、报告与贡献记录 | W9–10 | P0 | #29, #30, #31, #32 |
