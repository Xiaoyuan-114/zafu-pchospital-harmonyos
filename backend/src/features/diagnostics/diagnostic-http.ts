import { AppError } from "@/lib/api/errors";
import { normalizeDiagnosticInput, type DiagnosticDraftInput } from "./diagnostic-validation";

/** 读取 JSON 请求体：空体、非对象都按 400 处理（与设备接口同一口径）。 */
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

export async function diagnosticDraftInput(request: Request): Promise<DiagnosticDraftInput> {
  return normalizeDiagnosticInput(await readJsonBody(request));
}
