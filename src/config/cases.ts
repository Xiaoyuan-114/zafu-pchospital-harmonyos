/**
 * 成员案例库（`/member/cases`）文案 —— issue #68。
 *
 * 案例库是「已通过维修记录」的阅读视图：只浏览与筛选，没有审核动作，
 * 因此这里不重复 `repairCopy.list` 的表格列名，只保留案例卡需要的那几项。
 * 「典型案例 / 疑难案例」两个说法直接从 `communityCopy.flags` 取 ——
 * 详情页的案例标记、后台的标记按钮都用它，三处必须是同一个名字。
 */

import { communityCopy } from "@/config/community";

export const casesCopy = {
  title: "案例库",
  label: "Case Library",
  lead: "全站已通过的维修案例都收在这里。想找同类故障的处理办法，先按典型案例或疑难案例筛一遍。",

  /** 三档范围筛选（issue 原文「典型案例还有别的选项」）。 */
  scopeLabel: "案例范围",
  scope: {
    all: "全部案例",
    typical: communityCopy.flags.typical,
    difficult: communityCopy.flags.difficult,
  },

  filtersLabel: "搜索与筛选案例",
  filters: {
    searchLabel: "关键词",
    searchPlaceholder: "搜索故障现象或处理过程",
    category: "故障分类",
    allCategories: "全部分类",
    submit: "搜索",
    reset: "清除",
  },

  /** 当前结果条数，`{count}` 由组件替换。 */
  total: "共 {count} 条",
  loading: "正在加载案例…",
  loadError: "案例加载失败，请稍后重试。",
  reload: "重新加载",
  /** 筛选后无结果与案例库本身为空分开说：后者才说明全站还没有已通过的记录。 */
  emptyFiltered: "没有符合条件的案例，换个分类或关键词试试。",
  empty: "案例库还是空的 —— 目前还没有已通过的维修记录。",

  /** 卡片字段缺失时的占位 */
  uncategorized: "未分类",
  missingContent: "尚未填写维修内容",
  durationLabel: "耗时",

  detailAction: "查看详情",
  paginationLabel: "案例分页",
  previousPage: "上一页",
  nextPage: "下一页",
} as const;
