import { AppError } from "@/lib/api/errors";
import {
  diagnosticCategories,
  findCategory,
  findOption,
  findQuestion,
  type DiagnosticCategory,
} from "./diagnostic-catalog";
import type { DiagnosticAnswerInput } from "./diagnostic-view";

/**
 * 一次最多答「最长一份目录」的题数，超出即视为异常请求。
 *
 * 由目录推导而不是写死数字：目录加题时上限自动跟上，
 * 也不会再出现「注释说 2 题、常量却是 8」这种对不上的情况。
 */
export const diagnosticAnswerLimit = Math.max(
  ...diagnosticCategories.map((category) => category.questions.length),
);

export type DiagnosticDraftInput = {
  categoryCode: string;
  deviceId?: string;
  answers: DiagnosticAnswerInput[];
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * 把请求体解析成草稿。
 *
 * 只认 `categoryCode` / `deviceId` / `answers`：**结论永远由服务端算**，
 * 客户端传来的 outcome 一律忽略——否则「检测结论」就成了客户端自己写的一句话。
 */
export function normalizeDiagnosticInput(body: Record<string, unknown>): DiagnosticDraftInput {
  const rawAnswers = Array.isArray(body.answers) ? body.answers : [];
  const answers: DiagnosticAnswerInput[] = [];
  for (const item of rawAnswers) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    answers.push({
      questionCode: asText(record.questionCode),
      optionCode: asText(record.optionCode),
    });
  }
  const deviceId = asText(body.deviceId);
  const draft: DiagnosticDraftInput = {
    categoryCode: asText(body.categoryCode).toUpperCase(),
    answers,
  };
  if (deviceId !== "") draft.deviceId = deviceId;
  return draft;
}

/**
 * 校验答案是否完整地对上了目录。
 *
 * 要求「每个问题各答一次」而不是「答几个算几个」：缺答会让结论退化成
 * INCONCLUSIVE，看上去像检测失败，其实是请求没发全，应当在入口就挡掉。
 * 未知问题码、未知选项码、同一问题答两次都算无效请求。
 */
export function validateDiagnosticInput(draft: DiagnosticDraftInput): {
  category: DiagnosticCategory;
  answers: DiagnosticAnswerInput[];
} {
  const category = findCategory(draft.categoryCode);
  if (!category) {
    throw new AppError("VALIDATION_FAILED", "请选择一个故障分类", {
      fieldErrors: { categoryCode: ["故障分类不存在"] },
    });
  }
  if (draft.answers.length === 0 || draft.answers.length > diagnosticAnswerLimit) {
    throw new AppError("VALIDATION_FAILED", "回答数量不正确", {
      fieldErrors: { answers: ["回答数量不正确"] },
    });
  }

  const seen = new Set<string>();
  for (const answer of draft.answers) {
    const question = findQuestion(category, answer.questionCode);
    if (!question) {
      throw new AppError("VALIDATION_FAILED", "问题不属于所选分类", {
        fieldErrors: { answers: [`未知的问题：${answer.questionCode}`] },
      });
    }
    if (seen.has(answer.questionCode)) {
      throw new AppError("VALIDATION_FAILED", "同一个问题只能回答一次", {
        fieldErrors: { answers: [`重复回答：${answer.questionCode}`] },
      });
    }
    seen.add(answer.questionCode);
    if (!findOption(question, answer.optionCode)) {
      throw new AppError("VALIDATION_FAILED", "选项不属于该问题", {
        fieldErrors: { answers: [`未知的选项：${answer.optionCode}`] },
      });
    }
  }

  const missing = category.questions.filter((question) => !seen.has(question.code));
  if (missing.length > 0) {
    throw new AppError("VALIDATION_FAILED", "还有问题没有回答", {
      fieldErrors: { answers: [`未回答：${missing.map((question) => question.title).join("、")}`] },
    });
  }

  // 按目录顺序回传，历史记录里的答案顺序才不会随客户端提交顺序变化。
  const ordered = category.questions.map((question) => {
    const answer = draft.answers.find((item) => item.questionCode === question.code);
    return { questionCode: question.code, optionCode: answer ? answer.optionCode : "" };
  });
  return { category, answers: ordered };
}
