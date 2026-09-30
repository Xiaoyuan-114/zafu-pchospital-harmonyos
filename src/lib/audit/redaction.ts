import { createHmac } from "node:crypto";

/**
 * 禁止进入审计摘要的字段名。
 *
 * ⚠️ 这里的每个模式都必须**足够窄**：早期版本用裸 `code` 匹配，
 * 结果把 `skillCodes` 这类正常的业务集合也整体丢掉了 —— 审计里 `before` / `after`
 * 全部变成空对象，等于静默丢失审计内容。因此 `code` 只匹配
 * 「邀请码 / 验证码 / 兑换码」这类**凭据性质**的完整字段名，
 * 不匹配 `skillCodes`、`errorCode`、`countryCode` 等普通业务字段。
 */
const BLOCKED_KEY =
  /(password|credential|secret|token|digest|hash|authorization|cookie|^(invite|verify|verification|redeem|reset|otp|sms)_?code(s)?$|^(invite|verify|verification|redeem|reset|otp|sms)?code(s)?$)/i;
const QQ_KEY = /(^|_)(qq)($|_)/i;
const PHONE_KEY = /(phone|mobile)/i;

export function maskQq(value: string): string {
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}${"*".repeat(Math.max(3, value.length - 4))}${value.slice(-2)}`;
}

export function maskPhone(value: string): string {
  if (value.length < 7) return "****";
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}

export function redactAuditSummary(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactAuditSummary);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => {
      if (BLOCKED_KEY.test(key)) return [];
      if (typeof entry === "string" && PHONE_KEY.test(key)) return [[key, maskPhone(entry)]];
      if (typeof entry === "string" && QQ_KEY.test(key)) return [[key, maskQq(entry)]];
      return [[key, redactAuditSummary(entry)]];
    }),
  );
}

export function digestAuditValue(value: string, pepper: string): Uint8Array<ArrayBuffer> {
  const digest = createHmac("sha256", pepper).update(value).digest();
  return new Uint8Array(
    digest.buffer.slice(digest.byteOffset, digest.byteOffset + digest.byteLength),
  );
}
