/**
 * Prisma 已知错误码判定。
 *
 * adapter 版本不同会把 `code` 放在 `error.code` 或 `error.meta.code` 上，
 * 这里只认前者——本项目用的版本走 `error.code`，与 `account-repository` 的写法一致。
 *
 * 之所以要显式判 P2002：Prisma 抛的是运行时错误，不是 `AppError`，
 * 落到 `toPublicError` 会变成 `INTERNAL_ERROR` 500。两个请求同时绑同一台机器时，
 * 「先查后插」两次都查不到，第二条只能靠唯一索引挡住，此时必须翻译成 409。
 */
export function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
