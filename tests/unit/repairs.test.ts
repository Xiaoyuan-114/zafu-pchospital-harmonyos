import assert from "node:assert/strict";
import test from "node:test";
import { AppError, ApiErrorCode } from "../../src/lib/api/errors";
import { detectImageType } from "../../src/features/repairs/repair-photo-service";
import { isRepairTransitionAllowed } from "../../src/features/repairs/repair-state";
import {
  validateDraftFields,
  validateSubmission,
} from "../../src/features/repairs/repair-validation";
import { repairFieldLimits } from "../../src/config/repairs";
import { RepairResult, RepairStatus, RepairTimelineEventType } from "../../src/types/contracts";
import { parseRepairListStatus } from "../../src/features/repairs/repair-http";

test("M2 公共枚举与错误码已冻结", () => {
  assert.deepEqual(RepairStatus, ["DRAFT", "PENDING", "APPROVED", "REJECTED"]);
  assert.deepEqual(RepairResult, ["COMPLETED", "NOT_COMPLETED"]);
  assert.equal(RepairTimelineEventType.includes("FLAG_CHANGED"), true);
  for (const code of [
    "MEMBER_REQUIRED",
    "REPAIR_NOT_FOUND",
    "REPAIR_VERSION_CONFLICT",
    "REPAIR_PHOTO_STORAGE_FAILED",
  ])
    assert.equal(ApiErrorCode.includes(code as never), true);
});
test("维修状态机只接受任务书规定流转", () => {
  assert.equal(isRepairTransitionAllowed("DRAFT", "PENDING"), true);
  assert.equal(isRepairTransitionAllowed("REJECTED", "PENDING"), true);
  assert.equal(isRepairTransitionAllowed("PENDING", "APPROVED"), true);
  assert.equal(isRepairTransitionAllowed("PENDING", "REJECTED"), true);
  assert.equal(isRepairTransitionAllowed("APPROVED", "DRAFT"), false);
  assert.equal(isRepairTransitionAllowed("DRAFT", "APPROVED"), false);
});
test("提交完整性要求日期、分类、正文、结果与至少一张照片", () => {
  assert.throws(
    () =>
      validateSubmission({
        repairDate: null,
        categoryId: null,
        content: null,
        result: null,
        photoCount: 0,
      }),
    (e) => e instanceof AppError && e.code === "REPAIR_SUBMISSION_INCOMPLETE",
  );
  // 正文必填（issue #62 后端3）：空白等同于没填。
  assert.throws(
    () =>
      validateSubmission({
        repairDate: new Date("2026-09-15T00:00:00.000Z"),
        categoryId: "category",
        content: "   ",
        result: "COMPLETED",
        photoCount: 1,
      }),
    (e) => e instanceof AppError && e.code === "REPAIR_SUBMISSION_INCOMPLETE",
  );
  // 其余项齐了、正文有内容即可提交；维修时长不参与提交校验。
  validateSubmission({
    repairDate: new Date("2026-09-15T00:00:00.000Z"),
    categoryId: "category",
    content: "换硅脂",
    result: "COMPLETED",
    photoCount: 1,
  });
  assert.throws(
    () =>
      validateSubmission({
        repairDate: new Date("2026-09-15T00:00:00.000Z"),
        categoryId: "category",
        content: "字".repeat(10001),
        result: "COMPLETED",
        photoCount: 1,
      }),
    (e) => e instanceof AppError && e.code === "REPAIR_SUBMISSION_INCOMPLETE",
  );
  assert.throws(() => validateDraftFields({ durationMinutes: 10081 }), AppError);
});

test("维修日期上下限在保存草稿时就生效，而不是等到提交", () => {
  const future = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 10);
  for (const repairDate of ["2019-12-31", future]) {
    assert.throws(
      () => validateDraftFields({ repairDate }),
      (e) => e instanceof AppError && e.code === "VALIDATION_FAILED",
      `${repairDate} 应当被拒绝`,
    );
  }
  // 边界：下限当天与今天都合法。
  validateDraftFields({ repairDate: repairFieldLimits.repairDateMin });
  validateDraftFields({ repairDate: new Date().toISOString().slice(0, 10) });
});
test("图片魔数拒绝伪造 MIME 并识别 JPEG PNG WebP", () => {
  assert.equal(detectImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
  assert.equal(
    detectImageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "image/png",
  );
  assert.equal(
    detectImageType(Uint8Array.from([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")])),
    "image/webp",
  );
  assert.equal(detectImageType(Uint8Array.from(Buffer.from("not-an-image"))), null);
});

test("维修列表 status 查询白名单：合法预选，非法忽略", () => {
  assert.equal(parseRepairListStatus("REJECTED"), "REJECTED");
  assert.equal(parseRepairListStatus("DRAFT"), "DRAFT");
  assert.equal(parseRepairListStatus("PENDING"), "PENDING");
  assert.equal(parseRepairListStatus("APPROVED"), "APPROVED");
  assert.equal(parseRepairListStatus(""), "");
  assert.equal(parseRepairListStatus(null), "");
  assert.equal(parseRepairListStatus(undefined), "");
  assert.equal(parseRepairListStatus("DONE"), "");
  assert.equal(parseRepairListStatus("rejected"), "");
});
