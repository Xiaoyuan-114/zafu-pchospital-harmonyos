import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

class ApiError extends Error {
  constructor(public code: string, public status: number, message: string) { super(message); }
}

interface FormState {
  deviceModel: string;
  faultDescription: string;
  contactPhone: string;
  busy: boolean;
  pendingRetry: boolean;
  idempotencyKey: string;
  fieldErrors: Record<string, string>;
  errorText: string;
  onDraftStateChanged: (dirty: boolean, busy: boolean, pending: boolean) => void;
  submit: (request: object, key: string) => Promise<void>;
  onSubmitted: () => Promise<void>;
  notifyDraftState(): void;
  clearFieldError(name: string): void;
  handleSubmit(): Promise<void>;
}

test("修改字段时只清除该字段的旧提示", () => {
  const page = form();
  page.fieldErrors = { deviceModel: "请填写设备机型", contactPhone: "请填写联系电话" };
  page.errorText = "请检查填写内容";
  page.clearFieldError("deviceModel");
  assert.equal(page.fieldErrors.deviceModel, undefined);
  assert.equal(page.fieldErrors.contactPhone, "请填写联系电话");
  assert.equal(page.errorText, "");
});

function form(): FormState {
  const source = readFileSync("../app/entry/src/main/ets/features/repair/RepairOrderForm.ets", "utf8");
  const methods = source.slice(0, source.indexOf("  @Builder"))
    .replace(/import[\s\S]*?from\s+['"][^'"]+['"];\s*/g, "")
    .replace("@Component", "")
    .replace("export struct RepairOrderForm", "class RepairOrderForm")
    .replace(/@State\s+/g, "")
    .replace("export type FieldErrorMap", "type FieldErrorMap");
  const script = ts.transpileModule(`${methods}\n}\nnew RepairOrderForm();`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return runInNewContext(script, {
    ApiRequestError: ApiError,
    isSessionExpiredCode: () => false,
    isNetworkErrorCode: (code: string) => code === "NETWORK_ERROR",
    REPAIR_ORDER_LIMITS: { deviceModelMaxLength: 100, deviceSerialMaxLength: 100, faultDescriptionMinLength: 5, faultDescriptionMaxLength: 1000 },
    util: { generateRandomUUID: () => "next" },
  }) as FormState;
}

test("结果未知后保留原提交键和内容，重试确认成功再清空", async () => {
  const page = form();
  page.deviceModel = "验收设备";
  page.faultDescription = "开机后屏幕无显示";
  page.contactPhone = "13000000302";
  page.idempotencyKey = "original-key";
  const calls: { request: object; key: string }[] = [];
  let complete = 0;
  page.onSubmitted = async () => { complete++; };
  page.submit = async (request, key) => {
    calls.push({ request, key });
    if (calls.length === 1) throw new ApiError("NETWORK_ERROR", 0, "连接中断");
  };
  await page.handleSubmit();
  assert.equal(page.pendingRetry, true);
  assert.equal(page.deviceModel, "验收设备");
  await page.handleSubmit();
  assert.equal(calls[0].key, "original-key");
  assert.equal(calls[1].key, "original-key");
  assert.deepEqual(calls[0].request, calls[1].request);
  assert.equal(complete, 1);
  assert.equal(page.pendingRetry, false);
  assert.equal(page.deviceModel, "");
});

test("请求进行中重复提交被拦截，字段校验错误保持可编辑", async () => {
  const page = form();
  page.deviceModel = "验收设备";
  page.faultDescription = "开机后屏幕无显示";
  page.contactPhone = "13000000302";
  let reject!: (error: Error) => void;
  let calls = 0;
  page.submit = () => { calls++; return new Promise<void>((_resolve, fail) => { reject = fail; }); };
  const first = page.handleSubmit();
  assert.equal(page.busy, true);
  await page.handleSubmit();
  assert.equal(calls, 1);
  reject(new ApiError("VALIDATION_FAILED", 400, "请修改信息"));
  await first;
  assert.equal(page.busy, false);
  assert.equal(page.pendingRetry, false);
});
