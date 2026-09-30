/**
 * `/member/rankings` 页面文案（内部排行榜）。
 *
 * 与其余页面一致：文案集中在此，组件不写死文本。
 * 名次的**颜色不是唯一线索** —— 列表同时给出名次数字与「并列」文字，
 * 前端不得只靠金银铜色区分前三名。
 */

export const rankingsPage = {
  title: "维修排行",
  label: "Rankings",
  lead: "按审核已通过的维修记录统计。仅统计已通过的记录，草稿、待审核与已退回不计入。",
} as const;

export const rankingsSections = {
  board: { index: "01", label: "Board", title: "排行榜" },
} as const;

export const rankingsCopy = {
  scopeLabel: "统计范围",
  metricLabel: "排行指标",
  scopes: {
    MONTH: "本月",
    TERM: "本学期",
    ALL_TIME: "总榜",
  },
  metrics: {
    REPAIR_COUNT: "维修数量",
    DURATION_MINUTES: "维修时长",
  },
  /** 名次用文字标注，避免只靠颜色 */
  rankPrefix: "第",
  rankSuffix: "名",
  tiedLabel: "并列",
  currentBadge: "我",
  countUnit: "次",
  durationLabel: "时长",
  empty: "当前范围暂无上榜记录。",
  unconfigured: "本学期区间未配置，暂不提供排行。",
  loadFailed: "排行榜加载失败。",
  reload: "重新加载",
  myRankTitle: "我的排名",
  myRankEmpty: "当前范围暂无上榜记录。",
  paginationPrev: "上一页",
  paginationNext: "下一页",
  paginationSummary: "第 {page} / {totalPages} 页 · 共 {total} 人上榜",
} as const;
