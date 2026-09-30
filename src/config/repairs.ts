import { RepairResult, RepairStatus } from "@/types/contracts";

export const repairCopy = {
  list: {
    title: "维修记录",
    label: "Repair Records",
    lead: "按日期、成员与处理状态快速查找社团的维修记录。草稿和退回记录仅本人及管理员可见。",
    total: "当前结果",
    newAction: "新建记录",
    quickFilters: {
      all: "全部",
      pending: "待审核",
      draft: "草稿",
      rejected: "已退回",
    },
    filters: {
      searchLabel: "搜索维修记录",
      searchPlaceholder: "搜索维修内容、备注或成员",
      status: "状态",
      category: "分类",
      member: "维修成员",
      result: "维修结果",
      dateFrom: "起始日期",
      dateTo: "结束日期",
      allStatuses: "全部状态",
      allCategories: "全部分类",
      allMembers: "全部成员",
      allResults: "全部结果",
      more: "更多筛选",
      less: "收起筛选",
      difficult: "仅看疑难案例",
      typical: "仅看典型案例",
      submit: "搜索",
      reset: "清除",
    },
    columns: {
      date: "日期",
      category: "分类",
      content: "维修内容",
      member: "维修成员",
      result: "结果",
      status: "状态",
      action: "操作",
    },
    loading: "正在加载维修记录…",
    loadError: "维修记录加载失败，请稍后重试。",
    reload: "重新加载",
    uncategorized: "未分类",
    missingContent: "尚未填写维修内容",
    missingDate: "日期待填",
    missingResult: "结果待填",
    difficult: "疑难",
    typical: "典型",
    view: "查看",
    previousPage: "上一页",
    nextPage: "下一页",
  },
  create: {
    title: "新建维修记录",
    label: "New Repair",
    lead: "先建立草稿，再填写内容、上传照片并提交审核。",
  },
  edit: {
    title: "编辑维修记录",
    label: "Edit Repair",
    lead: "保存草稿不会进入统计；提交后等待管理员审核。",
  },
  detail: {
    title: "维修记录详情",
    label: "Repair Detail",
    lead: "查看维修信息、审核历史、记录时间线与内部讨论。",
  },
  empty: "暂时没有符合条件的维修记录。",
} as const;
export const repairStatusLabels: Record<(typeof RepairStatus)[number], string> = {
  DRAFT: "草稿",
  PENDING: "待审核",
  APPROVED: "已通过",
  REJECTED: "已退回",
};
export const repairResultLabels: Record<(typeof RepairResult)[number], string> = {
  COMPLETED: "已完成",
  NOT_COMPLETED: "未完成",
};
/**
 * 维修记录字段的硬限制。
 *
 * 服务端校验与表单 HTML 属性共用这一组数值 —— 两边各写一份是「限制看着有、实际没生效」
 * 的常见来源（issue #62 后端3）。
 */
export const repairFieldLimits = {
  contentMaxLength: 10000,
  remarkMaxLength: 2000,
  durationMinutesMin: 1,
  durationMinutesMax: 10080,
  /** 维修日期下限：早于它的基本是年份打错（1026 年、202 年这类）。 */
  repairDateMin: "2020-01-01",
} as const;
export const repairEditorCopy = {
  requiredMark: "必填",
  /** 表单是「先存草稿、再提交」两步，必填只针对提交那一刻。 */
  requiredNote: "标注「必填」的字段在提交审核前必须填齐；草稿可以先保存。",
  dateHint: "默认今天；不得晚于今天。",
  contentHint: `提交审核时必填，最多 ${repairFieldLimits.contentMaxLength} 字。`,
  /** 照片上限来自服务端（随详情下发），所以文案留占位符而不是写死数字。 */
  photoHint: "支持 JPEG、PNG、WebP；单张不超过 {size}、最多 {count} 张。提交审核至少需要一张。",
  photoTooLarge: "「{name}」有 {size}，超过单张 {limit} 的上限，请压缩或换一张。",
  photoTooMany: "已上传 {count} 张，最多只能再传 {remain} 张。",
};
/** 照片体积的可读写法：提示文案与服务端报错共用，避免两处各写一份换算。 */
export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${Number(mb.toFixed(mb >= 10 ? 0 : 1))} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}
/** 成员端不填写维修结果，缺省按「已完成」记录；管理员仍可在管理端改成「未完成」。 */
export const defaultRepairResult: RepairResult = "COMPLETED";
export const repairTimelineLabels = {
  CREATED: "创建草稿",
  UPDATED: "修改记录",
  PHOTO_ADDED: "添加照片",
  PHOTO_REMOVED: "移除照片",
  SUBMITTED: "提交审核",
  RESUBMITTED: "重新提交",
  APPROVED: "审核通过",
  REJECTED: "审核退回",
  DELETED: "软删除",
  FLAG_CHANGED: "标记变化",
} as const;
