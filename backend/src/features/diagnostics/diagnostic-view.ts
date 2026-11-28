import {
  diagnosticCategories,
  type DiagnosticCategory,
  type DiagnosticSignal,
} from "./diagnostic-catalog";

/**
 * 检测结论。
 *
 * 命名刻意区分「建议到店」和「建议报修」：前者是还需要工具确认，
 * 后者是已经能看出要拆机处理。两者都不等于「已确诊硬件损坏」。
 */
export const diagnosticOutcomeValues = [
  "SELF_SERVICE",
  "NEEDS_SERVICE",
  "NEEDS_REPAIR",
  "INCONCLUSIVE",
] as const;
export type DiagnosticOutcome = (typeof diagnosticOutcomeValues)[number];

export const diagnosticActions = ["SELF_STEPS", "CHECK_BENEFIT", "SUBMIT_REPAIR", "ASK_STAFF"] as const;
export type DiagnosticAction = (typeof diagnosticActions)[number];

/** 结果页固定声明：不管结论是什么都要显示，避免被读成硬件检测报告。 */
export const DIAGNOSTIC_DISCLAIMER =
  "结论来自你选择的症状，对照的是本地故障分类目录，不是对设备的检测结果；本系统读不到电池健康度、屏幕和传感器数据。";

const severity: Record<DiagnosticSignal, number> = { UNKNOWN: 0, SELF: 1, SERVICE: 2, REPAIR: 3 };

/**
 * 一个答案。
 *
 * 刻意写成 `type` 而不是 `interface`：Prisma 的 JSON 列要求可赋给 `InputJsonValue`，
 * 而 interface 没有隐式索引签名，写库时会报「Index signature is missing」。
 */
export type DiagnosticAnswerInput = {
  questionCode: string;
  optionCode: string;
};

export interface DiagnosticAnswerView {
  questionCode: string;
  questionTitle: string;
  optionCode: string;
  optionLabel: string;
  /** 为什么这个选项会推动结论，逐条给用户看。 */
  reason: string;
}

export interface DiagnosticResult {
  outcome: DiagnosticOutcome;
  headline: string;
  detail: string;
  steps: string[];
  suggestedAction: DiagnosticAction;
  /** 最强的那条信号来自哪个选项，用于「为什么是这个结论」。 */
  decisiveOption: string;
}

export interface DiagnosticOptionView {
  code: string;
  label: string;
}

export interface DiagnosticQuestionView {
  code: string;
  title: string;
  options: DiagnosticOptionView[];
}

export interface DiagnosticCategoryView {
  code: string;
  title: string;
  icon: string;
  scope: string;
  questionCount: number;
  /**
   * 问题与选项要下发：App 得靠它渲染问答。
   * 但**只给 code/label**，不给 signal——判定规则留在服务端，
   * 客户端改不了结论，也无法据此拼一个「必定判为在保」的请求。
   */
  questions: DiagnosticQuestionView[];
}

export interface DiagnosticSessionView {
  id: string;
  categoryCode: string;
  categoryTitle: string;
  deviceId: string | null;
  answers: DiagnosticAnswerView[];
  outcome: DiagnosticOutcome;
  headline: string;
  detail: string;
  steps: string[];
  suggestedAction: DiagnosticAction;
  /**
   * 最强的那条信号来自哪个选项（选项文案）。
   *
   * 这是「为什么是这个结论」的锚点：结果页除了列出所有答案，还要能指出
   * 是哪一个把结论拉到这一档的。目录改动后旧记录可能解析不出，给空串。
   */
  decisiveOption: string;
  disclaimer: string;
  createdAt: string;
}

const outcomeCopy: Record<DiagnosticOutcome, { headline: string; detail: string; action: DiagnosticAction }> = {
  SELF_SERVICE: {
    headline: "可以先自己处理",
    detail: "你描述的现象有明确的处理路径，按下面的步骤做一遍通常就够了；做完仍有问题再往下走。",
    action: "SELF_STEPS",
  },
  NEEDS_SERVICE: {
    headline: "建议到店确认",
    detail: "现象指向硬件或系统层面，用软件操作改变不了，需要工作人员用工具确认；现在还不能断定具体是哪个部件。",
    action: "CHECK_BENEFIT",
  },
  NEEDS_REPAIR: {
    headline: "建议尽快送修",
    detail: "按你选的症状，这类问题需要拆机处理，自助操作不会改变结果。送修前可以先看一下这台机器还有没有在保的权益。",
    action: "SUBMIT_REPAIR",
  },
  INCONCLUSIVE: {
    headline: "现在还判断不了",
    detail: "关键的那一步还没做，直接给结论只能是猜。把没做的那步做完，再回来重测一次。",
    action: "ASK_STAFF",
  },
};

export function toCategoryView(category: DiagnosticCategory): DiagnosticCategoryView {
  return {
    code: category.code,
    title: category.title,
    icon: category.icon,
    scope: category.scope,
    questionCount: category.questions.length,
    questions: category.questions.map((question) => ({
      code: question.code,
      title: question.title,
      options: question.options.map((option) => ({ code: option.code, label: option.label })),
    })),
  };
}

/** 目录：只给前台展示需要的字段，判定规则（signal）不下发。 */
export function listCategoryViews(): DiagnosticCategoryView[] {
  return diagnosticCategories.map(toCategoryView);
}

/**
 * 按答案算结论。
 *
 * 规则只有一条：取所有选项里**最严重**的那个信号（REPAIR > SERVICE > SELF > UNKNOWN）。
 * 不做加权打分——权重一旦可调，结论就变成可以「凑」出来的数字，
 * 也没法向用户解释为什么是这个结果。这里每个选项都带人话理由，结论可逐条追溯。
 */
export function evaluateAnswers(
  category: DiagnosticCategory,
  answers: DiagnosticAnswerView[],
): DiagnosticResult {
  let worst: DiagnosticSignal = "UNKNOWN";
  let decisiveOption = "";
  const steps: string[] = [];

  for (const answer of answers) {
    const question = category.questions.find((item) => item.code === answer.questionCode);
    const option = question?.options.find((item) => item.code === answer.optionCode);
    if (!option) continue;
    if (option.steps) {
      for (const step of option.steps) {
        if (!steps.includes(step)) steps.push(step);
      }
    }
    if (severity[option.signal] > severity[worst]) {
      worst = option.signal;
      decisiveOption = option.label;
    }
  }

  const outcome: DiagnosticOutcome =
    worst === "REPAIR"
      ? "NEEDS_REPAIR"
      : worst === "SERVICE"
        ? "NEEDS_SERVICE"
        : worst === "SELF"
          ? "SELF_SERVICE"
          : "INCONCLUSIVE";

  const copy = outcomeCopy[outcome];
  return {
    outcome,
    headline: copy.headline,
    detail: copy.detail,
    steps,
    suggestedAction: copy.action,
    decisiveOption,
  };
}

/** 把「问题 / 选项 / 理由」展开成可读的答案列表，供结果页与历史记录共用。 */
export function describeAnswers(
  category: DiagnosticCategory,
  answers: DiagnosticAnswerInput[],
): DiagnosticAnswerView[] {
  return answers.map((answer) => {
    const question = category.questions.find((item) => item.code === answer.questionCode);
    const option = question?.options.find((item) => item.code === answer.optionCode);
    return {
      questionCode: answer.questionCode,
      questionTitle: question?.title ?? answer.questionCode,
      optionCode: answer.optionCode,
      optionLabel: option?.label ?? answer.optionCode,
      reason: option?.reason ?? "",
    };
  });
}

/**
 * 结论文案表。
 *
 * 历史记录用**存下来的 outcome**，而不是拿旧答案重算：目录文案改动后，
 * 一条三天前的记录不该突然变成另一个结论。代价是选项被删掉时步骤会变少，
 * 这比「结论自己变了」可接受。
 */
export function outcomeCopyOf(outcome: DiagnosticOutcome): { headline: string; detail: string; action: DiagnosticAction } {
  return outcomeCopy[outcome];
}

/** 从答案里收集仍能解析到的自助步骤（去重、保持目录顺序）。 */
export function stepsOf(category: DiagnosticCategory | undefined, answers: DiagnosticAnswerInput[]): string[] {
  if (!category) return [];
  const steps: string[] = [];
  for (const answer of answers) {
    const question = category.questions.find((item) => item.code === answer.questionCode);
    const option = question?.options.find((item) => item.code === answer.optionCode);
    for (const step of option?.steps ?? []) {
      if (!steps.includes(step)) steps.push(step);
    }
  }
  return steps;
}

export function isDiagnosticOutcome(value: string): value is DiagnosticOutcome {
  return (diagnosticOutcomeValues as readonly string[]).includes(value);
}
