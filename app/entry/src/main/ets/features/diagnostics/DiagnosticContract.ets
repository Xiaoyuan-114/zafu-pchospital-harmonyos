/**
 * 检测与帮助的契约（Issue #102）。
 *
 * 与后端 `diagnostic-view.ts` 对齐。**结论字段（outcome / headline / steps）只读**：
 * App 从不自己算结论，只把用户选的选项提交上去、把服务端的结果显示出来。
 */

/** 目录里的一个问题选项：只有文案，没有判定信号。 */
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
  /** 图标键（display / battery / power / network / storage / account），App 映射到本地图。 */
  icon: string;
  /** 这一分类能判断什么、不能判断什么。 */
  scope: string;
  questionCount: number;
  questions: DiagnosticQuestionView[];
}

export interface DiagnosticCatalog {
  categories: DiagnosticCategoryView[];
  disclaimer: string;
}

export interface DiagnosticAnswerView {
  questionCode: string;
  questionTitle: string;
  optionCode: string;
  optionLabel: string;
  /** 为什么这个选项会推动结论。 */
  reason: string;
}

/** 结论：自助处理 / 建议到店 / 建议送修 / 判断不了。 */
export const OUTCOME_SELF_SERVICE: string = 'SELF_SERVICE';
export const OUTCOME_NEEDS_SERVICE: string = 'NEEDS_SERVICE';
export const OUTCOME_NEEDS_REPAIR: string = 'NEEDS_REPAIR';
export const OUTCOME_INCONCLUSIVE: string = 'INCONCLUSIVE';

export const ACTION_SELF_STEPS: string = 'SELF_STEPS';
export const ACTION_CHECK_BENEFIT: string = 'CHECK_BENEFIT';
export const ACTION_SUBMIT_REPAIR: string = 'SUBMIT_REPAIR';
export const ACTION_ASK_STAFF: string = 'ASK_STAFF';

export interface DiagnosticSessionView {
  id: string;
  categoryCode: string;
  categoryTitle: string;
  deviceId: string | null;
  answers: DiagnosticAnswerView[];
  outcome: string;
  headline: string;
  detail: string;
  steps: string[];
  suggestedAction: string;
  disclaimer: string;
  createdAt: string;
}

export interface DiagnosticAnswerInput {
  questionCode: string;
  optionCode: string;
}

/** POST /api/v1/customer/diagnostics/sessions 的请求体。 */
export interface DiagnosticSubmitRequest {
  categoryCode: string;
  deviceId?: string;
  answers: DiagnosticAnswerInput[];
}

/** 结论配色：送修要红，到店要橙，自助是绿，判断不了用灰。 */
export function outcomeColor(outcome: string): string {
  if (outcome === OUTCOME_NEEDS_REPAIR) {
    return '#C63B3B';
  }
  if (outcome === OUTCOME_NEEDS_SERVICE) {
    return '#B4681E';
  }
  if (outcome === OUTCOME_SELF_SERVICE) {
    return '#2F7D4F';
  }
  return '#69747C';
}

/** 主按钮文案：不同结论给的动作不一样，不写成统一的「确定」。 */
export function actionLabel(action: string): string {
  if (action === ACTION_CHECK_BENEFIT) {
    return '查看这台设备的权益';
  }
  if (action === ACTION_SUBMIT_REPAIR) {
    return '提交报修';
  }
  if (action === ACTION_ASK_STAFF) {
    return '联系工作人员';
  }
  return '再测一次';
}

/** 历史记录里的一句话摘要，避免列表只显示一个分类名。 */
export function sessionSummary(session: DiagnosticSessionView): string {
  const first: DiagnosticAnswerView | undefined = session.answers.length > 0 ? session.answers[0] : undefined;
  if (first === undefined) {
    return session.headline;
  }
  return `${first.optionLabel}`;
}

/**
 * 检测记录的日期，按本地时区算成 `YYYY-MM-DD`。
 * 不能用 `createdAt.substring(0, 10)`：服务端给的是 UTC，北京时间 0 点到 8 点之间
 * 会显示成前一天（2026-11-28 00:11 会写成 2026-11-27），跟报修单的时间对不上。
 */
export function formatSessionDay(iso: string): string {
  if (iso === null || iso === undefined || iso === '') {
    return '';
  }
  const d: Date = new Date(iso);
  if (isNaN(d.getTime())) {
    return iso.length >= 10 ? iso.substring(0, 10) : iso;
  }
  const month: number = d.getMonth() + 1;
  const day: number = d.getDate();
  const pad = (value: number): string => (value < 10 ? `0${value}` : `${value}`);
  return `${d.getFullYear()}-${pad(month)}-${pad(day)}`;
}
