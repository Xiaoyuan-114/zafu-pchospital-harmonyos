import { randomUUID } from "node:crypto";
import { AppError } from "@/lib/api/errors";
import { paginationMeta } from "@/lib/api/pagination";
import { requirePermission } from "@/lib/auth/permissions";
import type { AuthorizedActor, PaginationInput } from "@/types/contracts";
import { deviceRepository } from "@/features/devices/device-repository";
import { findCategory, type DiagnosticCategory } from "./diagnostic-catalog";
import { diagnosticRepository, type DiagnosticSessionRow } from "./diagnostic-repository";
import {
  DIAGNOSTIC_DISCLAIMER,
  describeAnswers,
  evaluateAnswers,
  isDiagnosticOutcome,
  listCategoryViews,
  outcomeCopyOf,
  stepsOf,
  type DiagnosticAction,
  type DiagnosticAnswerInput,
  type DiagnosticSessionView,
} from "./diagnostic-view";
import { validateDiagnosticInput, type DiagnosticDraftInput } from "./diagnostic-validation";

/** 从 JSON 列里读回答案：结构不对就当作空，不让一条脏记录把整个列表打挂。 */
function answersOf(row: DiagnosticSessionRow): DiagnosticAnswerInput[] {
  const raw = row.answers;
  if (!Array.isArray(raw)) return [];
  const answers: DiagnosticAnswerInput[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const questionCode = typeof record.questionCode === "string" ? record.questionCode : "";
    const optionCode = typeof record.optionCode === "string" ? record.optionCode : "";
    if (questionCode !== "" && optionCode !== "") answers.push({ questionCode, optionCode });
  }
  return answers;
}

function toSessionView(row: DiagnosticSessionRow): DiagnosticSessionView {
  const category: DiagnosticCategory | undefined = findCategory(row.categoryCode);
  const answers = answersOf(row);
  const outcome = isDiagnosticOutcome(row.outcome) ? row.outcome : "INCONCLUSIVE";
  const copy = outcomeCopyOf(outcome);
  // 结论文案用**存下来的** outcome（目录改了也不该让旧记录换结论）；
  // `decisiveOption` 只回答「哪条答案最强」，从答案现算，解析不出时给空串。
  const described = category ? describeAnswers(category, answers) : [];
  const decisiveOption = category ? evaluateAnswers(category, described).decisiveOption : "";
  return {
    id: row.id,
    categoryCode: row.categoryCode,
    categoryTitle: category?.title ?? row.categoryCode,
    deviceId: row.deviceId,
    answers: described,
    outcome,
    headline: copy.headline,
    detail: copy.detail,
    steps: stepsOf(category, answers),
    suggestedAction: copy.action as DiagnosticAction,
    decisiveOption,
    disclaimer: DIAGNOSTIC_DISCLAIMER,
    createdAt: row.createdAt.toISOString(),
  };
}

function requireActor(actor: AuthorizedActor): string {
  if (!actor.userId) throw new AppError("UNAUTHENTICATED", "登录状态无效");
  return actor.userId;
}

export const diagnosticService = {
  /** 目录：分类标题、能判断的范围、问题数。判定规则不下发。 */
  catalog() {
    return { categories: listCategoryViews(), disclaimer: DIAGNOSTIC_DISCLAIMER };
  },

  /**
   * 提交一次问答。
   *
   * 结论在这里算，不在客户端算：客户端只提交「选了哪个选项」，
   * 传来任何 outcome 都会被忽略。
   */
  async run(actor: AuthorizedActor, draft: DiagnosticDraftInput): Promise<DiagnosticSessionView> {
    requirePermission(actor, "diagnostic:run_self");
    const userId = requireActor(actor);
    const { category, answers } = validateDiagnosticInput(draft);

    // 设备可选；一旦指定，只能是自己的（非本人按 404 处理，不暴露存在性）。
    if (draft.deviceId !== undefined) {
      const device = await deviceRepository.findById(draft.deviceId);
      if (!device || device.deletedAt !== null || device.ownerUserId !== userId) {
        throw new AppError("DEVICE_NOT_FOUND", "设备不存在");
      }
    }

    const described = describeAnswers(category, answers);
    const result = evaluateAnswers(category, described);
    const row = await diagnosticRepository.create({
      id: randomUUID(),
      userId,
      deviceId: draft.deviceId ?? null,
      categoryCode: category.code,
      answers,
      outcome: result.outcome,
      now: new Date(),
    });
    return toSessionView(row);
  },

  async list(
    actor: AuthorizedActor,
    pagination: PaginationInput,
  ): Promise<{ items: DiagnosticSessionView[]; pagination: ReturnType<typeof paginationMeta> }> {
    requirePermission(actor, "diagnostic:read_self");
    const userId = requireActor(actor);
    const { items, total } = await diagnosticRepository.listByUser(userId, {
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    });
    return { items: items.map(toSessionView), pagination: paginationMeta(pagination, total) };
  },

  async detail(actor: AuthorizedActor, id: string): Promise<DiagnosticSessionView> {
    requirePermission(actor, "diagnostic:read_self");
    const userId = requireActor(actor);
    const row = await diagnosticRepository.findOwned(id, userId);
    if (!row) throw new AppError("DIAGNOSTIC_SESSION_NOT_FOUND", "检测记录不存在");
    return toSessionView(row);
  },
};
