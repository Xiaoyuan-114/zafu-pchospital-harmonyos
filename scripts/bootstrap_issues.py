"""One-time, idempotent GitHub Issue bootstrap. Requires an authenticated gh CLI."""

import json
import subprocess
from pathlib import Path

REPO = "Xiaoyuan-114/zafu-pchospital-harmonyos"
ROOT = Path(__file__).resolve().parents[1]


def gh(*args, payload=None):
    result = subprocess.run(
        ["gh", *args],
        input=json.dumps(payload, ensure_ascii=False) if payload is not None else None,
        text=True,
        encoding="utf-8",
        capture_output=True,
        check=False,
    )
    if result.returncode:
        raise RuntimeError(f"gh {' '.join(args)}: {result.stderr.strip()}")
    return json.loads(result.stdout)


# key, stage/milestone, priority, area, title, estimate, dependencies, role/permission, deliverable, acceptance, anchor
TASKS = [
    ("device", 1, "P0", "qa", "核准 SDK 与真机调试基线", "1d", [], "所有角色；无业务数据", "记录课程指定 API、DevEco 版本、设备型号/系统、签名与最小 HAP 安装步骤", "连接设备；构建并安装本仓库骨架；记录启动截图、日志、失败原因与复现命令", None),
    ("isolation", 1, "P0", "backend", "建立隔离的实验后端与测试资源", "2d", [], "测试账号；禁止生产身份/数据复用", "确定实验后端仓库/commit、数据库、存储、域名/TLS、Secret 管理和重置脚本", "在独立环境启动健康检查；验证库名/域名/桶与生产不同；提交脱敏配置样例和连接记录", None),
    ("contract", 1, "P0", "backend", "定稿客户报修、活动报名与维修备案对象关系", "2d", [], "客户本人、工作人员授权范围、审核员", "以现有 schema/路由为证据画 ER 与两套状态图；列新增端点、字段、错误和迁移方案", "核查源码和实验接口；确认活动 serve 的可空一对一关联；请团队审阅普通报修单关联/取消规则", "auth-network"),
    ("visual_base", 1, "P1", "qa", "采集参照 App 服务页面与本项目映射", "1d", [], "公开参照页面；不采个人账户信息", "记录我的华为实际版本、服务入口/描述/记录/详情路径与截图来源，建立页面映射", "另一人按版本与路径复现；每张截图标明设备、日期、页面和可引用范围", None),
    ("corpus_rights", 1, "P0", "ai", "清点可用于实验的手册与案例授权", "2d", ["isolation"], "公开文档与内部案例分级；不上传原始个人信息", "列手册章节、来源版本、授权；统计经审核且可用案例数量/缺字段/照片风险", "抽样人工核对授权与脱敏；无许可资料不入库；只提交统计与脱敏样本", "ai-knowledge"),
    ("auth_contract", 1, "P0", "backend", "实现实验后端原生 Bearer 会话契约", "3d", ["isolation", "contract"], "客户/工作人员/审核员；服务端判角色与过期", "独立实验接口的登录、/me、刷新或过期、退出、角色变化合同测试；保留 Web Cookie Origin 保护", "用两类账号验证成功、过期、退出和跨角色访问；证明未伪造 Origin、未放开 Cookie 写请求", "auth-network"),
    ("app_network", 1, "P0", "app", "接入 App 网络层与登录会话", "3d", ["device", "auth_contract"], "登录角色的令牌安全存储；不记录凭据", "base URL、信封/错误/分页/超时封装及登录、/me、退出页面", "真机登录并跨重启恢复；过期回登录；错误与断网态可见；附实验接口日志", "auth-network"),
    ("roles", 1, "P0", "backend", "配置客户与工作人员测试身份及权限矩阵", "2d", ["isolation", "auth_contract"], "客户只能看本人单；工作人员按授权范围；审核员审查", "测试账号发放/重置、角色权限表、对象级越权合同测试", "以两名客户和一名工作人员验证 /me、本人/他人记录访问；记录 401/403/404 口径", "auth-network"),
    ("ui_base", 1, "P1", "app", "统一导航、主题和表单列表状态组件", "2d", ["device"], "入口随服务端角色结果展示，UI 不充当授权", "从现有骨架补齐加载、空态、失败态和表单错误原语；明确导航返回规则", "真机逐一展示三种状态、返回与横竖屏基本布局；组件无伪业务数据", None),
    ("ticket_model", 2, "P0", "backend", "新增客户报修单模型与状态迁移", "3d", ["contract", "roles"], "客户归属、工作人员分配、操作者审计", "独立实验库的前向迁移、状态/时间线、幂等键、到 RepairRecord 的可选关联", "空库迁移与重复部署通过；状态非法转换和越权合同测试；不改原生产库", "auth-network"),
    ("ticket_api", 2, "P0", "backend", "提供报修创建、本人列表与详情 API", "3d", ["ticket_model", "auth_contract"], "客户仅创建和读本人；工作人员按授权读", "创建/列表/详情端点、字段校验、分页、照片上传契约与幂等处理", "重复提交只得一单；客户 B 读客户 A 单失败；详情和分页与数据库一致", "auth-network"),
    ("staff_api", 2, "P0", "backend", "提供工作人员受理与状态时间线 API", "3d", ["ticket_api"], "仅获授权工作人员可变更；客户只读本人时间线", "待处理查询、受理/状态更新、备注与操作者时间戳、冲突保护", "工作人员操作后另一客户端刷新见变更；越权/非法状态/重复请求均有明确错误", "auth-network"),
    ("customer_form", 2, "P0", "app", "实现客户报修表单与照片提交", "3d", ["app_network", "ui_base", "ticket_api"], "客户身份；提交后归属本人", "设备/分类/故障描述与合同字段、照片选择上传、校验和防重复提交", "真机填写与上传，提交后在本人列表可见；断网、字段错、连点提交各验证一次", None),
    ("customer_list", 2, "P0", "app", "实现我的报修列表、详情和进度刷新", "2d", ["app_network", "ticket_api"], "只能看本人报修", "分页/刷新、详情时间线、结果与加载/空态/错误态", "A 见自己的单且看不到 B；工作人员更新后刷新可见真实服务端状态", None),
    ("staff_list", 2, "P0", "app", "实现工作人员待处理列表与详情", "2d", ["app_network", "ui_base", "ticket_api", "roles"], "仅工作人员授权范围", "待处理与处理中列表、详情及分页/空态", "与实验后端计数一致；不同权限账号列表不同；客户不能进入数据端点", None),
    ("staff_ui", 2, "P0", "app", "实现受理、状态更新与操作说明", "2d", ["staff_api", "staff_list"], "工作人员写，客户只读", "操作表单、冲突提示和更新时间线", "真机操作后客户机刷新见状态与说明；非法转换不会只改本地画面", None),
    ("record_link", 2, "P0", "backend", "关联报修单与维修备案并提交审核", "3d", ["ticket_model", "staff_api"], "备案成员写；审核员审；客户仅看允许展示结果", "按既有 RepairRecord 草稿/提交规则创建或关联记录，保留独立状态与审计", "报修受理后完成维修备案并提交；审核状态不误当报修进度；重复关联被拒绝", "auth-network"),
    ("cross_role", 2, "P0", "qa", "完成无 AI 的跨角色真机业务链验收", "2d", ["customer_form", "customer_list", "staff_ui", "record_link"], "客户 A/B、工作人员、审核员", "可重置测试数据、端到端脚本、接口/数据库证据和设备录屏", "客户建单→工作人员处理→客户看进度→维修备案提交；换账号复跑并测越权", None),
    ("doc_ingest", 3, "P0", "ai", "导入授权手册章节并保留引用定位", "3d", ["corpus_rights", "isolation"], "公开章节；未经许可不导入", "可重复分段与索引脚本、标题/路径/版本/位置元数据及删除更新流程", "导入 3–5 个获授权主题；打开来源可定位章节；重复运行不重复条目", "ai-knowledge"),
    ("case_audit", 3, "P1", "ai", "建立历史案例脱敏与可用性审查清单", "2d", ["corpus_rights"], "内部原始记录不可直接公开", "字段和照片/评论风险清单、人工审核表、可用案例计数", "抽样核对姓名/电话/QQ/学号/地址/照片；未批准案例不进入公开索引", "ai-knowledge"),
    ("eval_set", 3, "P1", "qa", "冻结首批知识问答评测问题集", "2d", ["corpus_rights", "contract"], "包含客户/工作人员与越权场景", "30–50 个问题、期望证据/行为、人工判准及独立调参集", "覆盖规范、案例、无命中、错误机型、信息不足、越权和草稿抽取；记录版本", "ai-knowledge"),
    ("search_api", 3, "P0", "ai", "提供授权检索与可打开的引用 API", "3d", ["doc_ingest", "auth_contract"], "角色过滤先于返回；内部资料不泄给客户", "检索、分页、文档章节详情与引用 ID 契约", "同问题返回可定位来源；客户查内部案例被拒；无命中返回空而不编造", "ai-knowledge"),
    ("knowledge_ui", 3, "P1", "app", "实现知识搜索、引用与详情页面", "2d", ["app_network", "search_api"], "客户公开内容，工作人员按授权范围", "查询结果、来源标签、详情定位、空态和错误态", "真机从结果打开原章节；无命中和越权各验证一次", "ai-knowledge"),
    ("answer_api", 3, "P0", "ai", "实现有依据回答、追问与无命中处理", "3d", ["search_api", "eval_set"], "客户安全建议；工作人员内部信息受控", "后端检索→授权过滤→生成→引用校验；证据不足时追问/引导报修", "多种问法均能打开支持结论的来源；无证据不编造根因/收费/耗时", "ai-knowledge"),
    ("draft_tool", 3, "P0", "ai", "生成可编辑报修草稿并人工提交", "3d", ["answer_api", "ticket_api", "customer_form"], "仅本人草稿；模型不能提交或改维修状态", "后端字段提取/校验与 App 草稿回填、修改确认流程", "真机问答生成草稿→用户修改→人工提交；缺字段追问；未确认时数据库无新单", "ai-knowledge"),
    ("case_extract", 4, "P0", "ai", "从已审核维修记录抽取带证据故障卡", "3d", ["record_link", "case_audit"], "仅获许可记录；不补写未知事实", "来源 ID、原文位置、可见级别、模型/提示词版本与审核状态；增量抽取", "缺字段保持未知；同来源同内容重复运行不重复；失败可重试并记录 token/费用", "ai-knowledge"),
    ("case_review", 4, "P0", "backend", "实现故障卡审核、退回与发布权限", "3d", ["case_extract", "search_api"], "审核员审批；工作人员不能自越权发布", "审核/退回 API、脱敏预览、审计记录、索引发布闸门", "退回卡不可公开检索；通过卡只暴露批准字段；越权审批被拒", "ai-knowledge"),
    ("incremental", 4, "P0", "ai", "实现审核案例增量索引与撤回", "2d", ["case_review"], "公开/内部索引分别过滤", "按来源 ID/内容哈希增量更新，暂停、断点、失败重试和撤回重建", "审核通过后新问法可命中；撤回后不再命中；重复运行结果稳定", "ai-knowledge"),
    ("backflow", 4, "P0", "qa", "真机验证维修案例审核回流与越权", "2d", ["incremental", "draft_tool", "cross_role"], "客户、工作人员、审核员及另一客户", "一条真实测试链路的重置脚本、录屏、来源与数据库核查记录", "维修完成→抽取→审核→再检索引用；退回与跨角色越权失败；换问法复跑", None),
    ("harmony_cap", 5, "P1", "app", "选择并验证一个原生鸿蒙能力", "2d", ["device", "cross_role"], "仅本人真实业务数据；权限最小化", "在万能卡片/系统能力中选 SDK 与设备可行的一项，提交小范围实现和降级说明", "真机触发、权限拒绝和业务数据更新均可复现；无设备则不宣称完成", None),
    ("visual", 5, "P1", "app", "完成参照页面对照与视觉打磨", "3d", ["visual_base", "cross_role", "knowledge_ui"], "截图不暴露测试账号隐私", "服务首页、表单、记录、详情的对应图与设计取舍；空态/错误态统一", "同一设备截图比较入口层级与信息密度；记录参照版本和非复刻功能", None),
    ("evaluation", 5, "P0", "qa", "运行检索、回答与建单评测并归档失败例", "3d", ["eval_set", "answer_api", "backflow"], "评测数据脱敏；区分客户/工作人员", "命中率、引用支持率、意图落实、拒答/追问、字段正确率与仅文档/文档+案例对比", "固定评测集重跑并留结果、样本量和典型失败例；调参样本不得冒充测试集", "ai-knowledge"),
    ("demo", 5, "P0", "qa", "完成真机回归、演示脚本、报告与贡献记录", "3d", ["backflow", "harmony_cap", "visual", "evaluation"], "客户/工作人员/审核员测试账号；无生产数据", "主链脚本、备用故障说明、版本截图/录屏、报告与四人 Issue/PR 贡献表", "一或两台真机连续跑主链和失败分支；换账号/故障复跑；记录构建包哈希", None),
]


def main():
    existing = gh("issue", "list", "--repo", REPO, "--state", "all", "--limit", "100", "--json", "number,title")
    by_title = {item["title"]: item["number"] for item in existing}
    numbers = {}
    stage_order = {}
    lines = ["# Issue 依赖地图", "", "每个里程碑内的两位编号用于列表排序；实际开工顺序以“前置”依赖为准，可并行的任务无需等待较小编号完成。每项默认未分配，成员认领时填写 owner，可按需邀请 reviewer。", "", "| 顺序 | Issue | 阶段 | 优先级 | 前置 |", "|---|---|---|---|---|"]
    for key, stage, priority, area, title, estimate, deps, role, delivery, acceptance, anchor in TASKS:
        stage_name = ['1-2', '3-4', '5-6', '7-8', '9-10'][stage-1]
        old_title = f"[W{['1–2','3–4','5–6','7–8','9–10'][stage-1]}] {title}"
        stage_order[stage] = stage_order.get(stage, 0) + 1
        order = f"W{stage_name}/{stage_order[stage]:02d}"
        full_title = f"[{order}] {title}"
        dep_refs = [f"#{numbers[d]}" for d in deps]
        body = f"""## 目标与交付
{delivery}

## 范围
预计 {estimate}，限定于本标题的可验收交付；新增范围另开 Issue。

## 前置依赖与契约
依赖：{', '.join(dep_refs) if dep_refs else '无'}。合同、字段和状态以 `docs/source-audit.md` 及前置 Issue 的核验结果为准。

## 角色与数据权限
{role}

## 验收步骤
1. 准备独立实验环境和对应角色测试账号；记录设备/系统/服务 commit。
2. {acceptance}
3. 在 PR 中附实际命令、构建/测试结果、真机截图或录屏；缺设备时标明未验证范围。

## 完成定义
- [ ] 交付物和必要契约/文档已提交，依赖 Issue 已完成
- [ ] 相关构建、测试及越权/错误场景有真实证据
- [ ] 真机验证已附设备与版本；未验证只标代码完成
- [ ] PR 记录验证结果，合并后确认远端 commit/ref（无需另一位成员批准）
"""
        labels = [f"priority:{priority}", f"stage:W{['1-2','3-4','5-6','7-8','9-10'][stage-1]}", f"area:{area}"]
        if anchor:
            labels.append(f"needs-anchor:{anchor}")
        if full_title in by_title:
            number = by_title[full_title]
        elif old_title in by_title:
            number = by_title[old_title]
            gh("api", f"repos/{REPO}/issues/{number}", "-X", "PATCH", "--input", "-", payload={"title": full_title})
            print(f"renamed #{number} {full_title}", flush=True)
        else:
            issue = gh("api", f"repos/{REPO}/issues", "-X", "POST", "--input", "-", payload={
                "title": full_title, "body": body, "labels": labels, "milestone": stage
            })
            number = issue["number"]
            print(f"created #{number} {full_title}", flush=True)
        numbers[key] = number
        lines.append(f"| `{order}` | [#{number}](https://github.com/{REPO}/issues/{number}) {title} | W{['1–2','3–4','5–6','7–8','9–10'][stage-1]} | {priority} | {', '.join(dep_refs) if dep_refs else '无'} |")
    (ROOT / "docs" / "issue-map.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
