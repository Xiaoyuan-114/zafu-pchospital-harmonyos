/**
 * 错误页文案
 *
 * `error.tsx` 与 `global-error.tsx` 都是客户端组件，出错时读不到任何运行时数据，
 * 因此文案集中在这里，组件只负责版式（与 `not-found.tsx` 同一套版式语言）。
 *
 * 两页共有的一个事实：**服务端渲染阶段抛错时，Next 会用自己的错误文档
 * （`<html id="__next_error__">`）替换整份 `<head>`**，根布局里那段防闪烁的主题脚本
 * 因此不在场，页面固定落在默认主题（2026-09-27 实测：`data-theme` / `data-mode` 均为空，
 * body 背景是 `:root` 的 `#f5f5f2`）。客户端抛错不会走到这一步 —— 那时文档早就带着
 * 用户的主题了。这是承重事实，不是漏改。
 */

/** 路由级错误页（某个页面段抛错，Header / Footer 仍在） */
export const routeErrorPage = {
  code: "500",
  labelEn: "Error",
  title: "这个页面没能打开",
  lead: "页面在加载时遇到了意外错误，代码或数据的一处问题把它打断了。可以重试一次；如果反复出现，请在 QQ 群里把页面地址告诉我们。",
  retryAction: "重试",
  homeAction: "回到首页",
} as const;

/**
 * 全局错误页（根布局自身抛错，整站骨架都不可用）
 *
 * 这一页是最后一道兜底：不需要 Header / Footer，也不依赖站点数据，
 * 所以它自己渲染 `<html>` / `<body>`，并自行引入全局样式。
 */
export const globalErrorPage = {
  code: "500",
  labelEn: "Fatal Error",
  title: "站点暂时无法显示",
  lead: "站点在渲染时遇到了严重错误，整页都没能生成。请稍后重试；如果一直这样，请在 QQ 群里告诉我们。",
  retryAction: "重试",
  homeAction: "回到首页",
} as const;
