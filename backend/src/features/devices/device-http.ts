import { AppError } from "@/lib/api/errors";

/** 请求体里的必填字符串。缺字段、非字符串、纯空白一律 400。 */
function requiredString(body: Record<string, unknown>, name: string): string {
  const value = body[name];
  if (typeof value !== "string" || !value.trim())
    throw new AppError("VALIDATION_FAILED", `${name} 不能为空`);
  return value;
}

/** 请求体里的选填字符串；缺字段与 null 都归一为 undefined。 */
function optionalString(body: Record<string, unknown>, name: string): string | undefined {
  const value = body[name];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new AppError("VALIDATION_FAILED", `${name} 必须是字符串`);
  return value;
}

/** 选填整数：接受 number 与纯数字字符串（表单常把次数当字符串发上来）。 */
function optionalInteger(body: Record<string, unknown>, name: string): number | undefined {
  const value = body[name];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
  throw new AppError("VALIDATION_FAILED", `${name} 必须是整数`);
}

/** 设备新增/编辑入参。字段名与客户端契约一致（camelCase）。 */
export function deviceDraftInput(body: Record<string, unknown>) {
  return {
    label: requiredString(body, "label"),
    brand: requiredString(body, "brand"),
    model: requiredString(body, "model"),
    serialNumber: optionalString(body, "serialNumber"),
    purchaseOn: optionalString(body, "purchaseOn"),
  };
}

/** 权益登记入参。 */
export function benefitDraftInput(body: Record<string, unknown>) {
  return {
    kind: requiredString(body, "kind"),
    name: requiredString(body, "name"),
    provider: requiredString(body, "provider"),
    startOn: requiredString(body, "startOn"),
    endOn: optionalString(body, "endOn"),
    region: optionalString(body, "region"),
    totalUses: optionalInteger(body, "totalUses"),
    note: optionalString(body, "note"),
  };
}

/** 设备列表筛选：`status` 只接受 ACTIVE/RETIRED，非法值 400 而不是静默忽略。 */
export function deviceListStatus(params: URLSearchParams): string | undefined {
  const value = params.get("status");
  if (!value) return undefined;
  if (value !== "ACTIVE" && value !== "RETIRED")
    throw new AppError("VALIDATION_FAILED", "status 参数无效");
  return value;
}

/** 工作人员按序列号查询时的关键字。 */
export function deviceLookupSerial(params: URLSearchParams): string {
  return (params.get("serial") ?? "").trim();
}

