import { AppError } from "@/lib/api/errors";

/**
 * 读取 JSON 请求体：空体 400（写接口都要求实体），非对象 400。
 *
 * 设备与检测两组写接口原先各有一份一字不差的实现，抽到这里的目的是
 * 「请求体不合法」只有一种口径，改动时不会只改到一半。
 */
export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text.trim()) throw new AppError("VALIDATION_FAILED", "请求体不能为空");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AppError("VALIDATION_FAILED", "请求体不是合法 JSON");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
    throw new AppError("VALIDATION_FAILED", "请求体必须是 JSON 对象");
  return parsed as Record<string, unknown>;
}
