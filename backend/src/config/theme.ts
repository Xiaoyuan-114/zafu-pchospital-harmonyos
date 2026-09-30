/**
 * 主题注册表（Theme Registry）与主题配置
 *
 * 本文件只描述三件事：有哪些显示模式、有哪些具体主题、模式如何映射到主题。
 * 具体色值**不在这里** —— 主题色值的唯一来源是 `src/app/globals.css` 的「主题层」
 * （选择器 `html[data-theme="<ThemeId>"]`；默认主题写在 `:root` 上，作为无脚本兜底）。
 *
 * 三个概念必须分清，组件里不要把它们混起来：
 *
 *   Mode    用户能看到的开关     normal | dark
 *   Theme   具体视觉方案         swiss-cobalt | black-yellow
 *   Mapping Mode → Theme         siteThemeConfig
 *
 * 之所以要多一层 Mapping：以后管理员后台要「把正常模式换成 Paper Green」时，
 * 只需改 `siteThemeConfig.normal`，并在 `globals.css` 增加一段
 * `html[data-theme="paper-green"]`。页面与组件一行都不用动，
 * 用户看到的仍然只是一个「正常模式」。
 */

/** 用户可见的显示模式。第一版只有两个，不要把具体主题名暴露给用户。 */
export type ThemeMode = "normal" | "dark";

/** 具体主题 ID。必须与 `globals.css` 中 `html[data-theme="<id>"]` 一一对应。 */
export type ThemeId = "swiss-cobalt" | "black-yellow";

export type ThemeDefinition = {
  id: ThemeId;
  /** 主题名。仅用于后台、文档与调试，不出现在用户界面。 */
  name: string;
  /** 该主题归属的显示模式 */
  mode: ThemeMode;
  /** 与 CSS 中该主题的 color-scheme 保持一致，供布局层同步浏览器 UI */
  colorScheme: "light" | "dark";
  /** 写入 `<meta name="theme-color">`，影响移动端地址栏配色 */
  browserThemeColor: string;
};

/** 主题注册表：新增主题时在这里登记，并在 `globals.css` 补一段同名选择器。 */
export const themeRegistry: Record<ThemeId, ThemeDefinition> = {
  "swiss-cobalt": {
    id: "swiss-cobalt",
    name: "Swiss Cobalt",
    mode: "normal",
    colorScheme: "light",
    browserThemeColor: "#f5f5f2",
  },
  "black-yellow": {
    id: "black-yellow",
    name: "Black Yellow",
    mode: "dark",
    colorScheme: "dark",
    browserThemeColor: "#0b0a08",
  },
};

/**
 * 当前站点配置：显示模式 → 具体主题。
 *
 * 未来管理员后台只替换这里的数据来源（例如改为从数据库读取），
 * 就能把「正常模式」由 Swiss Cobalt 换成 Paper Green、
 * 把「深色模式」由 Black Yellow 换成 Graphite —— 组件不需要任何改动。
 */
export const siteThemeConfig: Record<ThemeMode, ThemeId> = {
  normal: "swiss-cobalt",
  dark: "black-yellow",
};

/**
 * 访客本地没有显式选择时，是否跟随操作系统的 `prefers-color-scheme`。
 * 跟随只决定**首次默认值**：一旦用户点过切换，就以本地保存的选择为准。
 */
export const FALLBACK_FOLLOWS_SYSTEM = true;

/** 跟随系统时，系统偏好深色所对应的模式 */
export const SYSTEM_DARK_MODE: ThemeMode = "dark";

/**
 * 最后一道兜底：系统偏好不可得（或脚本被禁用）时使用的模式。
 * 它同时是 `globals.css` 中 `:root` 默认色板所对应的模式，两者必须一致。
 */
export const DEFAULT_THEME_MODE: ThemeMode = "normal";

/** 用户可见的模式选项，数组顺序即界面上的排列顺序。 */
export const themeModeOptions: readonly { mode: ThemeMode; label: string }[] = [
  { mode: "normal", label: "浅色" },
  { mode: "dark", label: "深色" },
];

/** 判断任意取值是否为合法的显示模式（用于校验 localStorage 里的值） */
export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "normal" || value === "dark";
}

/**
 * 主题解析器：显示模式 → 具体主题。
 *
 * 组件**不要**自己判断 `mode === "dark"` 然后挑颜色。
 * 需要主题身份时（例如同步 `<meta name="theme-color">`）调用这个函数。
 */
export function resolveTheme(mode: ThemeMode): ThemeDefinition {
  return themeRegistry[siteThemeConfig[mode]];
}
