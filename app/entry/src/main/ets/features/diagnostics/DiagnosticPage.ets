import { ApiRequestError, isSessionExpiredCode } from '../../core/network/ApiClient';
import { DETAIL_BACKGROUND, DetailHeader, DetailNotice } from '../../core/ui/ReferenceDetail';
import { DeviceFocusParam, RepairOrderFocusParam, ROUTE_DEVICE_DETAIL, ROUTE_MY_DEVICES, ROUTE_REPAIR_ORDERS } from '../../core/ui/Routes';
import { ErrorPanel, LoadingPanel } from '../../core/ui/StatePanel';
import {
  CARD_GAP,
  CARD_PADDING,
  CARD_RADIUS,
  CHIP_RADIUS,
  CONTROL_HEIGHT_MD,
  FONT_BODY,
  FONT_CHIP,
  FONT_HEADING,
  FONT_NOTE,
  FONT_SUBTITLE,
  FONT_TEXT,
  GAP_SM,
  GAP_XS,
  ICON_TILE,
} from '../../core/ui/Theme';
import { isNetworkErrorCode } from '../knowledge/KnowledgeFlow';
import {
  ACTION_ASK_STAFF,
  ACTION_CHECK_BENEFIT,
  ACTION_SUBMIT_REPAIR,
  DiagnosticAnswerInput,
  DiagnosticAnswerView,
  DiagnosticCategoryView,
  DiagnosticOptionView,
  DiagnosticQuestionView,
  DiagnosticSessionView,
  DiagnosticSubmitRequest,
  OUTCOME_NEEDS_REPAIR,
  actionLabel,
  formatSessionDay,
  outcomeColor,
} from './DiagnosticContract';
import { DiagnosticService } from './DiagnosticService';

/** 页面阶段：加载目录 / 入口 / 选题 / 问答 / 结果 / 失败。 */
const VIEW_LOADING: number = 0;
const VIEW_ENTRY: number = 1;
const VIEW_PICKER: number = 2;
const VIEW_QUESTION: number = 3;
const VIEW_RESULT: number = 4;
const VIEW_ERROR: number = 5;

/** 入口页最多回看 3 条历史：这里不是记录列表页，够「上次怎么判的」即可。 */
const HISTORY_LIMIT: number = 3;

/** 分类图标：目录只给键，图片在本地映射，后端换图不影响客户端发版。 */
function diagnosticIcon(icon: string): Resource {
  if (icon === 'battery') {
    return $r('app.media.ref_cooling');
  }
  if (icon === 'power') {
    return $r('app.media.ref_boot');
  }
  if (icon === 'network') {
    return $r('app.media.ref_network');
  }
  if (icon === 'storage') {
    return $r('app.media.ref_disk');
  }
  if (icon === 'account') {
    return $r('app.media.ref_profile');
  }
  return $r('app.media.ref_scan');
}

/**
 * 检测与帮助（Issue #102）。
 *
 * 这一页**不是硬件检测**：它把用户自述的症状按目录归类，给出「自助处理 / 到店确认 /
 * 建议送修 / 判断不了」四选一的建议，并把「为什么这么判」逐条写出来。
 * 页面上因此从不出现「电池健康度 87%」这类读数——本系统读不到。
 *
 * 结论由服务端算，页面只负责收集选项与展示结果；即使改客户端也改不出另一个结论。
 */
@Component
export struct DiagnosticPage {
  onBack: () => void = () => {};
  onOpen: (route: string, param: Object | null) => void = () => {};
  onSessionExpired: () => void = () => {};
  /** 从设备详情页进来时带上设备 ID：结果页可直接跳到这台设备的权益或报修。 */
  deviceId: string = '';

  @State view: number = VIEW_LOADING;
  @State categories: DiagnosticCategoryView[] = [];
  @State disclaimer: string = '';
  @State history: DiagnosticSessionView[] = [];
  @State expandedCode: string = '';
  @State categoryCode: string = '';
  @State questionIndex: number = 0;
  @State answers: DiagnosticAnswerInput[] = [];
  @State result: DiagnosticSessionView | null = null;
  @State errorText: string = '';
  @State submitting: boolean = false;
  /** 请求代次：离开页面后迟到的响应不再写状态。 */
  private generation: number = 0;
  private requesting: boolean = false;

  aboutToAppear(): void {
    this.loadCatalog();
  }

  aboutToDisappear(): void {
    this.generation += 1;
    this.requesting = false;
  }

  private async loadCatalog(): Promise<void> {
    if (this.requesting) {
      return;
    }
    const generation: number = ++this.generation;
    this.requesting = true;
    this.view = VIEW_LOADING;
    this.errorText = '';
    try {
      const catalog = await DiagnosticService.catalog();
      if (generation !== this.generation) {
        return;
      }
      this.categories = catalog.categories;
      this.disclaimer = catalog.disclaimer;
      this.view = VIEW_ENTRY;
      // 历史记录是附加信息：拉失败不该把整页打成错误态。
      this.loadHistory(generation);
    } catch (error) {
      if (generation !== this.generation) {
        return;
      }
      this.view = VIEW_ERROR;
      this.handleError(error);
    } finally {
      if (generation === this.generation) {
        this.requesting = false;
      }
    }
  }

  private async loadHistory(generation: number): Promise<void> {
    try {
      const sessions: DiagnosticSessionView[] = await DiagnosticService.listMine();
      if (generation !== this.generation) {
        return;
      }
      this.history = sessions.length > HISTORY_LIMIT ? sessions.slice(0, HISTORY_LIMIT) : sessions;
    } catch (error) {
      // 静默：历史可有可无，不能因此挡住「进入检测」。
    }
  }

  private handleError(error: Object): void {
    if (error instanceof ApiRequestError) {
      if (isSessionExpiredCode(error.code)) {
        this.onSessionExpired();
        return;
      }
      this.errorText = isNetworkErrorCode(error.code)
        ? `${error.message}（请检查服务器地址、网络与后端是否已启动）`
        : error.message;
      return;
    }
    this.errorText = '加载失败，请重试';
  }

  private currentCategory(): DiagnosticCategoryView | null {
    const found: DiagnosticCategoryView | undefined =
      this.categories.find((item: DiagnosticCategoryView) => item.code === this.categoryCode);
    if (found === undefined) {
      return null;
    }
    return found;
  }

  private currentQuestion(): DiagnosticQuestionView | null {
    const category: DiagnosticCategoryView | null = this.currentCategory();
    if (category === null || this.questionIndex >= category.questions.length) {
      return null;
    }
    return category.questions[this.questionIndex];
  }

  /** 某一问已选的选项码：回退上一题时用来还原选中态。 */
  private answeredOption(questionCode: string): string {
    const found: DiagnosticAnswerInput | undefined =
      this.answers.find((item: DiagnosticAnswerInput) => item.questionCode === questionCode);
    if (found === undefined) {
      return '';
    }
    return found.optionCode;
  }

  private startCategory(code: string): void {
    this.categoryCode = code;
    this.questionIndex = 0;
    this.answers = [];
    this.expandedCode = '';
    this.view = VIEW_QUESTION;
  }

  private choose(optionCode: string): void {
    if (this.submitting) {
      return;
    }
    const question: DiagnosticQuestionView | null = this.currentQuestion();
    if (question === null) {
      return;
    }
    const next: DiagnosticAnswerInput[] = this.answers.slice();
    const index: number = next.findIndex((item: DiagnosticAnswerInput) => item.questionCode === question.code);
    const answer: DiagnosticAnswerInput = { questionCode: question.code, optionCode: optionCode };
    if (index >= 0) {
      next[index] = answer;
    } else {
      next.push(answer);
    }
    this.answers = next;

    const category: DiagnosticCategoryView | null = this.currentCategory();
    const total: number = category === null ? 0 : category.questions.length;
    if (this.questionIndex + 1 < total) {
      this.questionIndex += 1;
      return;
    }
    this.submit();
  }

  private previousQuestion(): void {
    if (this.questionIndex === 0) {
      this.backToEntry();
      return;
    }
    this.questionIndex -= 1;
  }

  private async submit(): Promise<void> {
    if (this.submitting) {
      return;
    }
    this.submitting = true;
    const request: DiagnosticSubmitRequest = {
      categoryCode: this.categoryCode,
      answers: this.answers,
    };
    if (this.deviceId !== '') {
      request.deviceId = this.deviceId;
    }
    const generation: number = this.generation;
    try {
      const session: DiagnosticSessionView = await DiagnosticService.submit(request);
      if (generation !== this.generation) {
        return;
      }
      this.result = session;
      this.view = VIEW_RESULT;
      this.loadHistory(generation);
    } catch (error) {
      if (generation !== this.generation) {
        return;
      }
      this.view = VIEW_ERROR;
      this.handleError(error);
    } finally {
      this.submitting = false;
    }
  }

  private backToEntry(): void {
    this.view = VIEW_ENTRY;
    this.categoryCode = '';
    this.questionIndex = 0;
    this.answers = [];
    this.result = null;
    this.errorText = '';
  }

  /**
   * 失败页的重试。
   *
   * 分两种情况，不能一律回入口页：
   * - 答案已经收齐（提交失败）：直接重发，用户刚答的两题还在 `answers` 里，
   *   退回入口等于让他重答一遍。
   * - 目录没拿到：重新加载，本来也没有答案可留。
   */
  private retry(): void {
    if (this.categoryCode !== '' && this.answers.length > 0) {
      this.submit();
      return;
    }
    this.loadCatalog();
  }

  /**
   * 结果页的动作。
   *
   * 「查看权益」在没绑设备时退化为「我的设备」——总不能给一个没有上下文的权益页。
   */
  private runAction(action: string): void {
    if (action === ACTION_CHECK_BENEFIT) {
      if (this.deviceId !== '') {
        const param: DeviceFocusParam = { deviceId: this.deviceId };
        this.onOpen(ROUTE_DEVICE_DETAIL, param);
        return;
      }
      this.onOpen(ROUTE_MY_DEVICES, null);
      return;
    }
    if (action === ACTION_SUBMIT_REPAIR) {
      const focus: RepairOrderFocusParam = { orderId: '' };
      if (this.deviceId !== '') {
        focus.deviceId = this.deviceId;
      }
      this.onOpen(ROUTE_REPAIR_ORDERS, focus);
      return;
    }
    if (action === ACTION_ASK_STAFF) {
      this.getUIContext().getPromptAction().showToast({
        message: '带上这台设备到服务台，或先把没做的那一步做完再测一次'
      });
      return;
    }
    this.startCategory(this.categoryCode);
  }

  private primaryLabel(): string {
    const result: DiagnosticSessionView | null = this.result;
    if (result === null) {
      return '再测一次';
    }
    if (result.suggestedAction === ACTION_CHECK_BENEFIT && this.deviceId === '') {
      return '查看我的设备权益';
    }
    return actionLabel(result.suggestedAction);
  }

  private openHistory(session: DiagnosticSessionView): void {
    this.result = session;
    this.categoryCode = session.categoryCode;
    this.view = VIEW_RESULT;
  }

  @Builder
  entryView() {
    Column({ space: CARD_GAP }) {
      // 顶部：盾牌 + 主按钮，对应参考图的「进入检测」
      Column({ space: 18 }) {
        Image($r('app.media.ref_shield')).width(96).height(108).objectFit(ImageFit.Contain)
        Button('进入检测')
          .fontSize(FONT_BODY)
          .height(CONTROL_HEIGHT_MD + 4)
          .width(180)
          .fontColor(Color.White)
          .backgroundColor($r('app.color.brand'))
          .borderRadius(CONTROL_HEIGHT_MD + 4)
          .onClick(() => {
            this.view = VIEW_PICKER;
          })
        Text('按你描述的现象归类，不读取硬件数据')
          .fontSize(FONT_CHIP)
          .fontColor($r('app.color.text_secondary'))
      }
      .width('100%')
      .padding({ top: 12, bottom: 20 })
      .alignItems(HorizontalAlign.Center)

      Row({ space: GAP_SM }) {
        Text('?')
          .fontSize(FONT_CHIP)
          .fontColor(Color.White)
          .width(16)
          .height(16)
          .textAlign(TextAlign.Center)
          .backgroundColor($r('app.color.text_secondary'))
          .borderRadius(8)
        Text('获取帮助')
          .fontSize(FONT_SUBTITLE)
          .fontWeight(FontWeight.Medium)
          .fontColor($r('app.color.text_primary'))
      }
      .width('100%')
      .margin({ top: GAP_SM })

      ForEach(this.categories, (category: DiagnosticCategoryView) => {
        this.categoryRow(category);
      }, (category: DiagnosticCategoryView) => category.code)

      if (this.history.length > 0) {
        Text('最近检测')
          .fontSize(FONT_SUBTITLE)
          .fontWeight(FontWeight.Medium)
          .fontColor($r('app.color.text_primary'))
          .width('100%')
          .margin({ top: GAP_SM })

        ForEach(this.history, (session: DiagnosticSessionView) => {
          this.historyRow(session);
        }, (session: DiagnosticSessionView) => session.id)
      }

      if (this.disclaimer !== '') {
        Text(this.disclaimer)
          .fontSize(FONT_CHIP)
          .fontColor($r('app.color.text_secondary'))
          .lineHeight(19)
          .width('100%')
          .padding({ top: GAP_SM })
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  @Builder
  categoryRow(category: DiagnosticCategoryView) {
    Column({ space: GAP_SM }) {
      Row({ space: CARD_GAP }) {
        Image(diagnosticIcon(category.icon))
          .width(ICON_TILE)
          .height(ICON_TILE)
        Text(category.title)
          .fontSize(FONT_SUBTITLE)
          .fontColor($r('app.color.text_primary'))
          .layoutWeight(1)
        Text(this.expandedCode === category.code ? '⌃' : '⌄')
          .fontSize(FONT_BODY)
          .fontColor($r('app.color.text_secondary'))
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      if (this.expandedCode === category.code) {
        Text(category.scope)
          .fontSize(FONT_NOTE)
          .fontColor($r('app.color.text_secondary'))
          .lineHeight(20)
          .width('100%')
        Button('开始这一类检测')
          .fontSize(FONT_TEXT)
          .height(CONTROL_HEIGHT_MD)
          .fontColor($r('app.color.brand'))
          .backgroundColor($r('app.color.brand_soft'))
          .borderRadius(CONTROL_HEIGHT_MD)
          .onClick(() => {
            this.startCategory(category.code);
          })
      }
    }
    .width('100%')
    .padding(CARD_PADDING)
    .backgroundColor($r('app.color.surface'))
    .borderRadius(CARD_RADIUS)
    .alignItems(HorizontalAlign.Start)
    .onClick(() => {
      this.expandedCode = this.expandedCode === category.code ? '' : category.code;
    })
  }

  @Builder
  historyRow(session: DiagnosticSessionView) {
    Row({ space: CARD_GAP }) {
      Column({ space: GAP_XS }) {
        Text(session.categoryTitle)
          .fontSize(FONT_TEXT)
          .fontWeight(FontWeight.Medium)
          .fontColor($r('app.color.text_primary'))
          .width('100%')
        Text(session.headline)
          .fontSize(FONT_CHIP)
          .fontColor(outcomeColor(session.outcome))
          .width('100%')
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      Text('›')
        .fontSize(FONT_BODY)
        .fontColor($r('app.color.text_secondary'))
    }
    .width('100%')
    .padding(CARD_PADDING)
    .backgroundColor($r('app.color.surface'))
    .borderRadius(CARD_RADIUS)
    .alignItems(VerticalAlign.Center)
    .onClick(() => {
      this.openHistory(session);
    })
  }

  @Builder
  pickerView() {
    Column({ space: CARD_GAP }) {
      Text('第 1 步 · 你要排查哪一类？')
        .fontSize(FONT_HEADING)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('app.color.text_primary'))
        .width('100%')
      Text('选一类后回答两个问题，就能得到处理建议。')
        .fontSize(FONT_NOTE)
        .fontColor($r('app.color.text_secondary'))
        .width('100%')

      ForEach(this.categories, (category: DiagnosticCategoryView) => {
        Row({ space: CARD_GAP }) {
          Image(diagnosticIcon(category.icon)).width(ICON_TILE).height(ICON_TILE)
          Column({ space: GAP_XS }) {
            Text(category.title)
              .fontSize(FONT_TEXT)
              .fontColor($r('app.color.text_primary'))
              .width('100%')
            Text(`${category.questionCount} 个问题`)
              .fontSize(FONT_CHIP)
              .fontColor($r('app.color.text_secondary'))
              .width('100%')
          }
          .layoutWeight(1)
          .alignItems(HorizontalAlign.Start)
          Text('›')
            .fontSize(FONT_BODY)
            .fontColor($r('app.color.text_secondary'))
        }
        .width('100%')
        .padding(CARD_PADDING)
        .backgroundColor($r('app.color.surface'))
        .borderRadius(CARD_RADIUS)
        .alignItems(VerticalAlign.Center)
        .onClick(() => {
          this.startCategory(category.code);
        })
      }, (category: DiagnosticCategoryView) => category.code)

      Button('返回')
        .fontSize(FONT_TEXT)
        .height(CONTROL_HEIGHT_MD)
        .width('100%')
        .fontColor($r('app.color.text_secondary'))
        .backgroundColor($r('app.color.surface'))
        .borderRadius(CARD_RADIUS)
        .margin({ top: GAP_SM })
        .onClick(() => {
          this.backToEntry();
        })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  @Builder
  optionRow(question: DiagnosticQuestionView, option: DiagnosticOptionView) {
    Row({ space: CARD_GAP }) {
      Text(this.answeredOption(question.code) === option.code ? '◉' : '○')
        .fontSize(FONT_SUBTITLE)
        .fontColor(this.answeredOption(question.code) === option.code
          ? $r('app.color.brand')
          : $r('app.color.text_secondary'))
      Text(option.label)
        .fontSize(FONT_TEXT)
        .fontColor($r('app.color.text_primary'))
        .lineHeight(22)
        .layoutWeight(1)
    }
    .width('100%')
    .padding(CARD_PADDING)
    .backgroundColor(this.answeredOption(question.code) === option.code
      ? $r('app.color.brand_soft')
      : $r('app.color.surface'))
    .borderRadius(CARD_RADIUS)
    .alignItems(VerticalAlign.Center)
    .onClick(() => {
      this.choose(option.code);
    })
  }

  @Builder
  questionView() {
    Column({ space: CARD_GAP }) {
      if (this.currentQuestion() !== null) {
        Text(`第 ${this.questionIndex + 1} / ${this.currentCategory() === null ? 1 : this.currentCategory()!.questions.length} 问`)
          .fontSize(FONT_CHIP)
          .fontColor($r('app.color.brand'))
          .width('100%')
        Text(this.currentQuestion()!.title)
          .fontSize(FONT_HEADING)
          .fontWeight(FontWeight.Medium)
          .fontColor($r('app.color.text_primary'))
          .lineHeight(28)
          .width('100%')

        ForEach(this.currentQuestion()!.options, (option: DiagnosticOptionView) => {
          this.optionRow(this.currentQuestion()!, option);
        }, (option: DiagnosticOptionView) => option.code)

        Text(this.submitting ? '正在给出建议…' : '选一个最接近的；不确定就选「还没试过」，不会硬给结论。')
          .fontSize(FONT_CHIP)
          .fontColor($r('app.color.text_secondary'))
          .lineHeight(19)
          .width('100%')
          .padding({ top: GAP_SM })

        Button('上一题')
          .fontSize(FONT_TEXT)
          .height(CONTROL_HEIGHT_MD)
          .width('100%')
          .fontColor($r('app.color.text_secondary'))
          .backgroundColor($r('app.color.surface'))
          .borderRadius(CARD_RADIUS)
          .enabled(!this.submitting)
          .onClick(() => {
            this.previousQuestion();
          })
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  @Builder
  answerRow(answer: DiagnosticAnswerView) {
    Column({ space: GAP_XS }) {
      Text(answer.questionTitle)
        .fontSize(FONT_CHIP)
        .fontColor($r('app.color.text_secondary'))
        .width('100%')
      Text(answer.optionLabel)
        .fontSize(FONT_TEXT)
        .fontColor($r('app.color.text_primary'))
        .width('100%')
      if (answer.reason !== '') {
        Text(answer.reason)
          .fontSize(FONT_CHIP)
          .fontColor($r('app.color.text_secondary'))
          .lineHeight(19)
          .width('100%')
      }
    }
    .width('100%')
    .padding(CARD_PADDING)
    .backgroundColor($r('app.color.field_bg'))
    .borderRadius(CARD_RADIUS)
    .alignItems(HorizontalAlign.Start)
  }

  @Builder
  resultView(session: DiagnosticSessionView) {
    Column({ space: CARD_GAP }) {
      Column({ space: GAP_SM }) {
        Text(session.headline)
          .fontSize(FONT_HEADING)
          .fontWeight(FontWeight.Bold)
          .fontColor(outcomeColor(session.outcome))
          .width('100%')
        Text(session.detail)
          .fontSize(FONT_TEXT)
          .fontColor($r('app.color.text_primary'))
          .lineHeight(23)
          .width('100%')
        Text(`${session.categoryTitle} · ${formatSessionDay(session.createdAt)}`)
          .fontSize(FONT_CHIP)
          .fontColor($r('app.color.text_secondary'))
          .width('100%')
      }
      .width('100%')
      .padding(CARD_PADDING)
      .backgroundColor($r('app.color.surface'))
      .borderRadius(CARD_RADIUS)
      .alignItems(HorizontalAlign.Start)

      if (session.steps.length > 0) {
        Text('可以先做这几步')
          .fontSize(FONT_SUBTITLE)
          .fontWeight(FontWeight.Medium)
          .fontColor($r('app.color.text_primary'))
          .width('100%')
          .margin({ top: GAP_SM })
        ForEach(session.steps, (step: string, index: number) => {
          Row({ space: GAP_SM }) {
            Text(`${index + 1}`)
              .fontSize(FONT_CHIP)
              .fontColor($r('app.color.brand'))
              .width(20)
              .height(20)
              .textAlign(TextAlign.Center)
              .backgroundColor($r('app.color.brand_soft'))
              .borderRadius(10)
            Text(step)
              .fontSize(FONT_TEXT)
              .fontColor($r('app.color.text_primary'))
              .lineHeight(22)
              .layoutWeight(1)
          }
          .width('100%')
          .padding(CARD_PADDING)
          .backgroundColor($r('app.color.surface'))
          .borderRadius(CARD_RADIUS)
          .alignItems(VerticalAlign.Top)
        }, (step: string) => step)
      }

      Text('你选的是')
        .fontSize(FONT_SUBTITLE)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('app.color.text_primary'))
        .width('100%')
        .margin({ top: GAP_SM })
      ForEach(session.answers, (answer: DiagnosticAnswerView) => {
        this.answerRow(answer);
      }, (answer: DiagnosticAnswerView) => answer.questionCode)

      Text(session.disclaimer)
        .fontSize(FONT_CHIP)
        .fontColor($r('app.color.text_secondary'))
        .lineHeight(19)
        .width('100%')
        .padding({ top: GAP_SM })

      Button(this.primaryLabel())
        .fontSize(FONT_SUBTITLE)
        .height(CONTROL_HEIGHT_MD + 4)
        .width('100%')
        .fontColor(Color.White)
        .backgroundColor(session.outcome === OUTCOME_NEEDS_REPAIR
          ? $r('app.color.danger')
          : $r('app.color.brand'))
        .borderRadius(24)
        .margin({ top: GAP_SM })
        .onClick(() => {
          this.runAction(session.suggestedAction);
        })

      Button('再测一次')
        .fontSize(FONT_TEXT)
        .height(CONTROL_HEIGHT_MD)
        .width('100%')
        .fontColor($r('app.color.text_secondary'))
        .backgroundColor($r('app.color.surface'))
        .borderRadius(CARD_RADIUS)
        .onClick(() => {
          this.retry();
        })

      Button('返回入口')
        .fontSize(FONT_TEXT)
        .height(CONTROL_HEIGHT_MD)
        .width('100%')
        .fontColor($r('app.color.text_secondary'))
        .backgroundColor($r('app.color.surface'))
        .borderRadius(CARD_RADIUS)
        .onClick(() => {
          this.backToEntry();
        })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  build() {
    Column({ space: 0 }) {
      DetailHeader({
        title: '检测与帮助',
        onBack: this.onBack,
        refresh: this.view !== VIEW_QUESTION && this.view !== VIEW_PICKER,
        onRefresh: (): void => {
          this.loadCatalog();
        }
      })

      if (this.view === VIEW_ENTRY) {
        Column() {
          DetailNotice({
            text: '这里按你描述的现象给出处理方向，结论不等于硬件检测；保修权益以工作人员登记的为准。'
          })
        }
        .width('100%')
        .padding({ left: 18, right: 18, top: 14, bottom: 10 })
      }

      if (this.view === VIEW_LOADING) {
        Column() {
          LoadingPanel({ text: '正在加载故障分类…' })
        }
        .width('100%')
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
      } else if (this.view === VIEW_ERROR) {
        Column() {
          ErrorPanel({
            message: this.errorText === '' ? '加载失败，请重试' : this.errorText,
            onRetry: (): void => {
              this.loadCatalog();
            }
          })
        }
        .width('100%')
        .padding({ left: 18, right: 18 })
      } else {
        Scroll() {
          Column() {
            if (this.view === VIEW_ENTRY) {
              this.entryView();
            } else if (this.view === VIEW_PICKER) {
              this.pickerView();
            } else if (this.view === VIEW_QUESTION) {
              this.questionView();
            } else if (this.result !== null) {
              this.resultView(this.result);
            }
          }
          .width('100%')
          .padding({ left: 18, right: 18, top: 6, bottom: 24 })
          .alignItems(HorizontalAlign.Start)
        }
        .width('100%')
        .layoutWeight(1)
        .scrollBar(BarState.Off)
        .align(Alignment.Top)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(DETAIL_BACKGROUND)
  }
}
