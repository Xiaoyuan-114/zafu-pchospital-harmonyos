/**
 * 上海日历日 `YYYY-MM-DD`。
 *
 * 表单的 `max={shanghaiToday()}` 与服务端「维修日期不得晚于今天」必须同一天：
 * 直接用 `toISOString()` 是 UTC，上海 00:00–08:00 会算成昨天，管理员早上填当天日期
 * 就会被 HTML 拦下来。
 */
export function shanghaiToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
