/**
 * M4 内部交流与通知文案
 *
 * 页面与组件不得硬编码展示文案。未接入的能力（排行）仍走 memberCopy 的「尚未接入」。
 */

import { COMMENT_BODY_MAX_LENGTH, COMMENT_MENTION_LIMIT } from "@/types/contracts";

export const communityCopy = {
  comments: {
    title: "交流讨论",
    tag: "Discussion",
    empty: "还没有评论。围绕这条维修记录补充经验或提问。",
    placeholder: "写下评论。可用 @姓名 提及其他成员。",
    replyPlaceholder: "回复这条评论…",
    submit: "发表评论",
    reply: "回复",
    cancelReply: "取消回复",
    delete: "删除",
    deleting: "正在删除…",
    submitting: "正在发表…",
    loading: "正在加载评论…",
    loadError: "评论加载失败，请稍后重试。",
    reload: "重新加载",
    mentionHint: `正文里写 @姓名 即可提及（输入 @ 会出现候选），单条最多 ${COMMENT_MENTION_LIMIT} 人，正文不超过 ${COMMENT_BODY_MAX_LENGTH} 字。`,
    mentionMenuLabel: "提及成员",
    mentionEmpty: "没有匹配的成员。",
    replyTo: "回复 {name}",
    deleted: "评论已删除。",
    rootCount: "根评论 {count} 条",
  },
  pagination: {
    previous: "上一页",
    next: "下一页",
  },
  favorite: {
    add: "收藏",
    remove: "取消收藏",
    adding: "正在收藏…",
    removing: "正在取消…",
  },
  flags: {
    difficult: "疑难案例",
    typical: "典型案例",
    save: "保存标记",
    saving: "正在保存…",
    saved: "案例标记已更新。",
    saveFailed: "案例标记保存失败。",
  },
  notifications: {
    title: "消息通知",
    label: "Notifications",
    lead: "查看被提及、评论与审核结果。删除为软删除，未读状态会保留。",
    empty: "暂时没有通知。",
    unreadEmpty: "没有未读通知。",
    loading: "正在加载通知…",
    loadError: "通知加载失败，请稍后重试。",
    reload: "重新加载",
    markRead: "标为已读",
    markAllRead: "全部标为已读",
    marking: "正在更新…",
    delete: "删除",
    filterAll: "全部",
    filterUnread: "未读",
    filterRead: "已读",
    unreadCount: "未读 {count} 条",
    types: {
      MENTIONED: "在评论中提及了你",
      REPAIR_COMMENTED: "评论了你的维修记录",
      REPAIR_APPROVED: "你的维修记录已通过审核",
      REPAIR_REJECTED: "你的维修记录被退回",
    } as Record<string, string>,
  },
  favorites: {
    title: "收藏",
    label: "Favorites",
    lead: "收藏的维修记录便于回顾疑难与典型案例。取消收藏后可再次收藏同一条。",
    empty: "还没有收藏任何维修记录。",
    loading: "正在加载收藏…",
    loadError: "收藏加载失败，请稍后重试。",
    reload: "重新加载",
    count: "共 {count} 条",
    open: "查看记录",
    remove: "取消收藏",
  },
} as const;
