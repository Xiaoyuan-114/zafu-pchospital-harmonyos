import assert from "node:assert/strict";
import test from "node:test";

import { AppError } from "../../src/lib/api/errors";
import { customerPermissions } from "../../src/lib/auth/permissions";
import {
  diagnosticCategories,
  findCategory,
  type DiagnosticCategory,
} from "../../src/features/diagnostics/diagnostic-catalog";
import {
  DIAGNOSTIC_DISCLAIMER,
  describeAnswers,
  evaluateAnswers,
  isDiagnosticOutcome,
  listCategoryViews,
} from "../../src/features/diagnostics/diagnostic-view";
import {
  diagnosticAnswerLimit,
  normalizeDiagnosticInput,
  validateDiagnosticInput,
} from "../../src/features/diagnostics/diagnostic-validation";

/**
 * Issue #102 检测（症状问答）的规则测试。
 *
 * 重点不是「文案对不对」，而是三件会被误用的事：
 * 1. 结论只能由服务端按目录算 —— 客户端传来的 outcome 必须被无视；
 * 2. 最严重的信号优先 —— 碎屏不会因为「重启后还在」就降级成可自助；
 * 3. 缺答必须被拒绝 —— 否则会被当成「判断不了」，把请求错误伪装成检测结果。
 */

function categoryOf(code: string): DiagnosticCategory {
  const found = findCategory(code);
  assert.ok(found, `目录里应有分类 ${code}`);
  return found;
}

/** 每个分类都答「最严重的那个选项」，用于验证优先级。 */
function answersWith(category: DiagnosticCategory, optionCodes: string[]) {
  return category.questions.map((question, index) => ({
    questionCode: question.code,
    optionCode: optionCodes[index],
  }));
}

test("目录自洽：分类码唯一、每题至少两个选项、自助选项自带步骤", () => {
  const codes = new Set<string>();
  for (const category of diagnosticCategories) {
    assert.ok(!codes.has(category.code), `分类码重复：${category.code}`);
    codes.add(category.code);
    assert.ok(category.title.length > 0);
    assert.ok(category.scope.length > 0, `${category.code} 没写「判断不了什么」`);
    assert.ok(category.questions.length >= 2, `${category.code} 至少两问`);
    for (const question of category.questions) {
      assert.ok(question.options.length >= 2, `${question.code} 至少两个选项`);
      for (const option of question.options) {
        assert.ok(option.reason.length > 0, `${option.code} 缺判定理由`);
        if (option.signal === "SELF") {
          assert.ok((option.steps ?? []).length > 0, `${option.code} 判为自助却没给步骤`);
        }
      }
    }
  }
});

test("目录视图下发问题与选项，但不下发判定信号", () => {
  const views = listCategoryViews();
  assert.equal(views.length, diagnosticCategories.length);
  for (const view of views) {
    assert.equal(view.questions.length, view.questionCount);
    for (const question of view.questions) {
      for (const option of question.options) {
        assert.deepEqual(Object.keys(option).sort(), ["code", "label"]);
      }
    }
    assert.ok(!("signal" in view));
  }
});

test("硬件损坏优先于「重启后还在」：碎屏结论是建议送修", () => {
  const category = categoryOf("DISPLAY");
  const answers = describeAnswers(
    category,
    answersWith(category, ["cracked", "still"]),
  );
  const result = evaluateAnswers(category, answers);
  assert.equal(result.outcome, "NEEDS_REPAIR");
  assert.equal(result.suggestedAction, "SUBMIT_REPAIR");
  assert.match(result.decisiveOption, /裂痕/);
});

test("客服先问配件：没充电先被划成自助，换过配件仍不行才升级到到店", () => {
  const category = categoryOf("BATTERY");
  const selfOnly = evaluateAnswers(
    category,
    describeAnswers(category, answersWith(category, ["no_charge", "recovered"])),
  );
  assert.equal(selfOnly.outcome, "SELF_SERVICE");
  assert.ok(selfOnly.steps.length >= 3);

  const needsService = evaluateAnswers(
    category,
    describeAnswers(category, answersWith(category, ["no_charge", "still"])),
  );
  assert.equal(needsService.outcome, "NEEDS_SERVICE");
  // 「先换线」这一步仍然要给出来，不能因为要送修就把自助步骤吞掉。
  assert.ok(needsService.steps.length >= 3);
});

test("「还没试过」压不住已知的自助项：仍给自助步骤", () => {
  const category = categoryOf("STORAGE");
  const result = evaluateAnswers(
    category,
    describeAnswers(category, answersWith(category, ["low_space", "not_tried"])),
  );
  // 空间不足本身有明确处理路径，第二问没做不影响「先清空间」这条建议。
  assert.equal(result.outcome, "SELF_SERVICE");
  assert.ok(result.steps.length > 0);
});

test("全都答「说不清」时不下结论，转人工", () => {
  const category = categoryOf("ACCOUNT");
  const result = evaluateAnswers(
    category,
    describeAnswers(category, answersWith(category, ["other", "not_tried"])),
  );
  assert.equal(result.outcome, "INCONCLUSIVE");
  assert.equal(result.suggestedAction, "ASK_STAFF");
});

test("全部选自助项时才是自助结论", () => {
  const category = categoryOf("NETWORK");
  const result = evaluateAnswers(
    category,
    describeAnswers(category, answersWith(category, ["bluetooth", "recovered"])),
  );
  assert.equal(result.outcome, "SELF_SERVICE");
  assert.equal(result.suggestedAction, "SELF_STEPS");
});

test("客户端传 outcome 无效：normalize 只认分类与选项", () => {
  const draft = normalizeDiagnosticInput({
    categoryCode: "display",
    outcome: "NEEDS_REPAIR",
    deviceId: "  10200000-0000-4000-8000-000000000001  ",
    answers: [
      { questionCode: "display_state", optionCode: "preference" },
      { questionCode: "display_restart", optionCode: "recovered" },
    ],
  });
  assert.equal(draft.categoryCode, "DISPLAY");
  assert.equal(draft.deviceId, "10200000-0000-4000-8000-000000000001");
  assert.deepEqual(Object.keys(draft).sort(), ["answers", "categoryCode", "deviceId"]);

  const { category, answers } = validateDiagnosticInput(draft);
  const result = evaluateAnswers(category, describeAnswers(category, answers));
  assert.equal(result.outcome, "SELF_SERVICE", "伪造的 outcome 不应影响判定");
});

test("缺答 / 未知选项 / 重复回答都被拒绝", () => {
  const missing = normalizeDiagnosticInput({
    categoryCode: "DISPLAY",
    answers: [{ questionCode: "display_state", optionCode: "artifacts" }],
  });
  assert.throws(
    () => validateDiagnosticInput(missing),
    (error: unknown) => error instanceof AppError && error.code === "VALIDATION_FAILED",
  );

  const unknownOption = normalizeDiagnosticInput({
    categoryCode: "DISPLAY",
    answers: [
      { questionCode: "display_state", optionCode: "not-an-option" },
      { questionCode: "display_restart", optionCode: "still" },
    ],
  });
  assert.throws(() => validateDiagnosticInput(unknownOption), AppError);

  const duplicated = normalizeDiagnosticInput({
    categoryCode: "DISPLAY",
    answers: [
      { questionCode: "display_state", optionCode: "artifacts" },
      { questionCode: "display_state", optionCode: "cracked" },
    ],
  });
  assert.throws(() => validateDiagnosticInput(duplicated), AppError);

  const unknownCategory = normalizeDiagnosticInput({ categoryCode: "NOPE", answers: [] });
  assert.throws(() => validateDiagnosticInput(unknownCategory), AppError);
});

test("答案按目录顺序归档，不受提交顺序影响", () => {
  const draft = normalizeDiagnosticInput({
    categoryCode: "POWER",
    answers: [
      { questionCode: "power_restart", optionCode: "still" },
      { questionCode: "power_state", optionCode: "slow" },
    ],
  });
  const { category, answers } = validateDiagnosticInput(draft);
  assert.equal(answers[0].questionCode, category.questions[0].code);
  assert.equal(answers[1].questionCode, category.questions[1].code);
});

test("结论值与声明常量对齐；客户拿到检测权限但没有权益写权限", () => {
  assert.equal(isDiagnosticOutcome("NEEDS_REPAIR"), true);
  assert.equal(isDiagnosticOutcome("SOMETHING"), false);
  assert.ok(DIAGNOSTIC_DISCLAIMER.includes("不是对设备的检测结果"));
  assert.ok(customerPermissions.includes("diagnostic:run_self"));
  assert.ok(customerPermissions.includes("diagnostic:read_self"));
  assert.ok(!(customerPermissions as readonly string[]).includes("benefit:write"));
});

test("回答数量上限由目录推导，目录加题时自动跟上", () => {
  const longest = Math.max(...diagnosticCategories.map((category) => category.questions.length));
  assert.equal(diagnosticAnswerLimit, longest);
  assert.ok(diagnosticAnswerLimit > 0);
});
