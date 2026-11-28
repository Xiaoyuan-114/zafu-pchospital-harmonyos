import { DETAIL_BACKGROUND, DetailHeader, DetailNotice } from '../../core/ui/ReferenceDetail';
import { ReadingSectionLabel, ReadingStatusCard } from '../../core/ui/ReadingReference';
import { ApiRequestError, isSessionExpiredCode } from '../../core/network/ApiClient';
import { ErrorPanel, LoadingPanel } from '../../core/ui/StatePanel';
import { isNetworkErrorCode } from '../knowledge/KnowledgeFlow';
import {
  CARD_GAP,
  CARD_PADDING,
  CARD_RADIUS,
  CHIP_RADIUS,
  CONTROL_HEIGHT_MD,
  FONT_CHIP,
  FONT_NOTE,
  FONT_SUBTITLE,
  FONT_TEXT,
  GAP_SM,
  GAP_XS,
} from '../../core/ui/Theme';
import { DiagnosticFocusParam, RepairOrderFocusParam, ROUTE_DIAGNOSTIC, ROUTE_REPAIR_ORDERS } from '../../core/ui/Routes';
import { formatOrderTime, repairOrderStatusLabel } from '../repair/RepairOrderContract';
import {
  BENEFIT_STATUS_EXPIRED,
  BENEFIT_STATUS_NOT_STARTED,
  BENEFIT_STATUS_VOID,
  BenefitView,
  DeviceCreateRequest,
  DeviceDetailView,
  DeviceOrderSummary,
  benefitKindLabel,
  benefitStatusLabel,
  benefitStatusRank,
  daysRemainingLabel,
  formatCalendarDate,
  formatOptionalDate,
  remainingUsesLabel,
} from './DeviceContract';
import { DeviceForm } from './DeviceForm';
import { DeviceService } from './DeviceService';

/**
 * 客户设备详情页 = 权益查询页（Issue #102）。
 *
 * 版式参照 docs/reference/my-huawei/service-device-benefits.jpg：
 * 顶部「设备信息」卡（机身信息 + 状态），下面按「有效 → 已过期 → 已作废」
 * 堆叠权益卡，每张卡右侧一个图标，卡内四行固定字段：状态 / 有效期至 / 适用区域 / 可用次数。
 *
 * 三条如实记录的原则：
 * 1. **不造假保修**：没有权益记录时显示「暂无权益记录」并说明由谁登记，不放样例数据。
 * 2. 状态只显示服务端算好并给出的值，客户端的系统时间不参与判断。
 * 3. 已作废（VOID）与人工作废分开展示，客户据此知道该找门店还是已经过期。
 */
@Component
export struct DeviceDetailPage {
  /** 设备 ID：由路由参数传入。 */
  @Prop deviceId: string = '';
  /**
   * 上级的设备变更计数：报修单提交、设备改名或解绑后递增，这里跟着重拉详情。
   * 没有它会出这种问题——从详情点「报修这台设备」提交后返回，「关联报修」还写着
   * 「这台设备还没有报修记录」，必须手动点刷新才对。
   */
  @Prop @Watch('onDeviceRevisionChanged') deviceRefreshVersion: number = 0;
  onBack: () => void = () => {};
  onOpen: (route: string, param: Object | null) => void = () => {};
  onSessionExpired: () => void = () => {};
  /** 设备信息变更（改名/解绑）后通知上一级刷新列表。 */
  onChanged: () => void = () => {};
  /** 注册系统返回拦截：编辑表单打开时，返回先收起表单而不是直接离开页面。 */
  onRegisterBackHandler: (handler: () => boolean) => void = () => {};
  @State loading: boolean = true;
  @State detail: DeviceDetailView | null = null;
  @State errorText: string = '';
  @State noticeText: string = '';
  @State editing: boolean = false;
  /** 解绑请求进行中：防连点，同时禁用编辑入口。 */
  @State removing: boolean = false;
  /**
   * 请求序号（请求令牌）：每次发起详情请求自增并捕获，响应回来时只有序号仍是当前值
   * 才允许写入。用于丢弃「返回后又重进」时迟到的旧响应。
   */
  private requestSeq: number = 0;

  aboutToAppear(): void {
    this.onRegisterBackHandler((): boolean => {
      return this.handleBack();
    });
    this.fetch();
  }

  aboutToDisappear(): void {
    this.onRegisterBackHandler((): boolean => {
      return false;
    });
    this.requestSeq += 1;
  }

  /** 返回语义与页头返回一致：编辑中先收起表单，否则交给 Navigation 弹栈。 */
  private handleBack(): boolean {
    if (this.editing) {
      this.editing = false;
      return true;
    }
    return false;
  }

  /**
   * 设备变更计数变化：重拉详情。
   * 编辑表单打开时不重拉——用户正在填的内容会被一次后台刷新顶掉；
   * 解绑请求进行中也不重拉，那个流程自己会回列表。
   */
  private onDeviceRevisionChanged(): void {
    if (this.editing || this.removing) {
      return;
    }
    this.fetch();
  }

  private async fetch(): Promise<void> {
    if (this.deviceId === '') {
      this.loading = false;
      this.errorText = '缺少设备信息，请返回重试';
      return;
    }
    this.requestSeq += 1;
    const seq: number = this.requestSeq;
    this.loading = true;
    this.errorText = '';
    try {
      const detail: DeviceDetailView = await DeviceService.detail(this.deviceId);
      if (seq !== this.requestSeq) {
        return;
      }
      this.detail = detail;
    } catch (error) {
      if (seq !== this.requestSeq) {
        return;
      }
      if (error instanceof ApiRequestError) {
        if (isSessionExpiredCode(error.code)) {
          this.onSessionExpired();
          return;
        }
        this.errorText = isNetworkErrorCode(error.code)
          ? `${error.message}（请检查服务器地址、网络与后端是否已启动）`
          : error.message;
      } else {
        this.errorText = '加载失败，请重试';
      }
    } finally {
      if (seq === this.requestSeq) {
        this.loading = false;
      }
    }
  }

  /** 编辑保存：走同一份表单，deviceId 非空即编辑。 */
  private async save(deviceId: string, request: DeviceCreateRequest): Promise<void> {
    await DeviceService.update(deviceId, request);
  }

  private async afterSaved(): Promise<void> {
    this.editing = false;
    this.noticeText = '设备信息已更新。';
    this.onChanged();
    await this.fetch();
  }

  /**
   * 解绑设备：二次确认后才发请求。
   *
   * 后端在设备还有未完成报修时会返回 409 DEVICE_IN_USE，这里把该码翻译成
   * 「还有维修中的单，暂不能解绑」—— 比直接抛「操作失败」有用。
   */
  private async remove(): Promise<void> {
    if (this.removing) {
      return;
    }
    let confirmed: boolean = false;
    try {
      const answer = await this.getUIContext().getPromptAction().showDialog({
        title: '解绑这台设备？',
        message: '解绑后设备不再出现在「我的设备」里，已提交的报修单与历史记录不受影响。',
        buttons: [{ text: '取消', color: '#69747C' }, { text: '确认解绑', color: '#D23F3F' }]
      });
      confirmed = answer.index === 1;
    } catch (error) {
      // 弹窗本身失败（如页面已销毁）时不做任何破坏性操作。
      return;
    }
    if (!confirmed) {
      return;
    }
    this.removing = true;
    try {
      await DeviceService.remove(this.deviceId);
      this.onChanged();
      this.onBack();
    } catch (error) {
      if (error instanceof ApiRequestError) {
        if (isSessionExpiredCode(error.code)) {
          this.onSessionExpired();
          return;
        }
        this.errorText = error.code === 'DEVICE_IN_USE'
          ? '该设备还有未完成的报修，等维修结束后再解绑。'
          : error.message;
      } else {
        this.errorText = '解绑失败，请重试';
      }
    } finally {
      this.removing = false;
    }
  }

  /** 权益排序：有效 → 已过期 → 已作废；同组内按截止日期从近到远。 */
  private sortedBenefits(items: BenefitView[]): BenefitView[] {
    const copy: BenefitView[] = items.slice();
    copy.sort((left: BenefitView, right: BenefitView): number => {
      const rankDiff: number = benefitStatusRank(left.status) - benefitStatusRank(right.status);
      if (rankDiff !== 0) {
        return rankDiff;
      }
      const leftEnd: string = left.endOn === null ? '9999-12-31' : left.endOn;
      const rightEnd: string = right.endOn === null ? '9999-12-31' : right.endOn;
      return leftEnd < rightEnd ? -1 : (leftEnd > rightEnd ? 1 : 0);
    });
    return copy;
  }

  private openOrder(order: DeviceOrderSummary): void {
    const param: RepairOrderFocusParam = { orderId: order.id };
    this.onOpen(ROUTE_REPAIR_ORDERS, param);
  }

  /** 为这台设备发起报修：单据挂到它上面，提交后会在「关联报修」里出现。 */
  private repairThisDevice(): void {
    const param: RepairOrderFocusParam = { orderId: '', deviceId: this.deviceId };
    this.onOpen(ROUTE_REPAIR_ORDERS, param);
  }

  /**
   * 带着设备去问诊：结果页可以直接跳回本页的权益，或直接提交报修。
   * 参数就是设备 ID 字符串（见 HomePage 的 ROUTE_DIAGNOSTIC 分支）。
   */
  private diagnoseThisDevice(): void {
    const param: DiagnosticFocusParam = { deviceId: this.deviceId };
    this.onOpen(ROUTE_DIAGNOSTIC, param);
  }

  /** 权益状态行：「有效 · 还有 335 天」/「已过保修期 · 已过期 70 天」/「已作废」。 */
  private statusLine(benefit: BenefitView): string {
    if (benefit.status === BENEFIT_STATUS_VOID) {
      return benefitStatusLabel(benefit.status);
    }
    if (benefit.status === BENEFIT_STATUS_NOT_STARTED) {
      // 未生效时 `daysRemaining` 指的是到期日，「还有 N 天」会被读成「N 天后开始」，
      // 这里直接给生效日，避免误读。
      return `${benefitStatusLabel(benefit.status)} · 自 ${benefit.startOn} 起`;
    }
    return `${benefitStatusLabel(benefit.status)} · ${daysRemainingLabel(benefit.daysRemaining, benefit.status)}`;
  }

  @Builder
  benefitChip(status: string) {
    Text(benefitStatusLabel(status))
      .fontSize(FONT_CHIP)
      .fontColor(status === BENEFIT_STATUS_VOID || status === BENEFIT_STATUS_NOT_STARTED
        ? $r('app.color.text_secondary')
        : (status === BENEFIT_STATUS_EXPIRED ? $r('app.color.danger') : $r('app.color.brand')))
      .padding({ left: GAP_SM, right: GAP_SM, top: 3, bottom: 3 })
      .backgroundColor(status === BENEFIT_STATUS_VOID || status === BENEFIT_STATUS_NOT_STARTED
        ? $r('app.color.field_bg')
        : $r('app.color.brand_soft'))
      .borderRadius(CHIP_RADIUS)
  }

  @Builder
  benefitRow(label: string, value: string) {
    Row({ space: CARD_GAP }) {
      Text(label)
        .fontSize(FONT_NOTE)
        .fontColor($r('app.color.text_secondary'))
        .width(88)
        .textAlign(TextAlign.Start)
      Text(value)
        .fontSize(FONT_TEXT)
        .fontColor($r('app.color.text_primary'))
        .layoutWeight(1)
        .textAlign(TextAlign.Start)
    }
    .width('100%')
    .alignItems(VerticalAlign.Top)
  }

  @Builder
  benefitCard(benefit: BenefitView) {
    Column({ space: GAP_SM }) {
      Row({ space: GAP_SM }) {
        Column({ space: GAP_XS }) {
          Text(benefit.name)
            .fontSize(FONT_SUBTITLE)
            .fontWeight(FontWeight.Medium)
            .fontColor($r('app.color.text_primary'))
            .width('100%')
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .textAlign(TextAlign.Start)
          Text(`${benefitKindLabel(benefit.kind)} · ${benefit.provider}`)
            .fontSize(FONT_NOTE)
            .fontColor($r('app.color.text_secondary'))
            .width('100%')
            .textAlign(TextAlign.Start)
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)

        this.benefitChip(benefit.status)
      }
      .width('100%')

      this.benefitRow('状态', this.statusLine(benefit))
      this.benefitRow('有效期至', formatCalendarDate(benefit.endOn))
      this.benefitRow('适用区域', benefit.region)
      this.benefitRow('可用次数', remainingUsesLabel(benefit.remainingUses, benefit.totalUses, benefit.status))
      if (benefit.note !== null && benefit.note !== '') {
        this.benefitRow('备注', benefit.note)
      }
    }
    .width('100%')
    .padding(CARD_PADDING)
    .backgroundColor($r('app.color.surface'))
    .borderRadius(CARD_RADIUS)
    .alignItems(HorizontalAlign.Start)
  }

  @Builder
  orderRow(order: DeviceOrderSummary) {
    Row({ space: GAP_SM }) {
      Column({ space: GAP_XS }) {
        Text(order.faultDescription)
          .fontSize(FONT_TEXT)
          .fontColor($r('app.color.text_primary'))
          .width('100%')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .textAlign(TextAlign.Start)
        Text(`${repairOrderStatusLabel(order.status)} · ${formatOrderTime(order.createdAt)}`)
          .fontSize(FONT_CHIP)
          .fontColor($r('app.color.text_secondary'))
          .width('100%')
          .textAlign(TextAlign.Start)
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      Text('›')
        .fontSize(FONT_TEXT)
        .fontColor($r('app.color.text_secondary'))
    }
    .width('100%')
    .padding({ top: GAP_SM, bottom: GAP_SM })
    .onClick(() => {
      this.openOrder(order);
    })
  }

  @Builder
  content(detail: DeviceDetailView) {
    Column({ space: CARD_GAP }) {
      ReadingSectionLabel({ text: '设备信息' })
      ReadingStatusCard({
        title: detail.label,
        subtitle: `${detail.brand} ${detail.model}`,
        text: `序列号  ${formatOptionalDate(detail.serialNumber, '未填写')}\n购买日期  ${formatOptionalDate(detail.purchaseOn, '未记录')}`,
        icon: $r('app.media.reading_laptop')
      })

      ReadingSectionLabel({ text: '保修权益' })
      if (detail.benefits.length === 0) {
        Column({ space: GAP_XS }) {
          Text('暂无权益记录')
            .fontSize(FONT_TEXT)
            .fontColor($r('app.color.text_primary'))
            .width('100%')
            .textAlign(TextAlign.Start)
          Text('保修权益由门店工作人员按机身序列号登记，登记后会自动出现在这里。')
            .fontSize(FONT_NOTE)
            .fontColor($r('app.color.text_secondary'))
            .width('100%')
            .textAlign(TextAlign.Start)
        }
        .width('100%')
        .padding(CARD_PADDING)
        .backgroundColor($r('app.color.surface'))
        .borderRadius(CARD_RADIUS)
        .alignItems(HorizontalAlign.Start)
      } else {
        ForEach(this.sortedBenefits(detail.benefits), (benefit: BenefitView) => {
          this.benefitCard(benefit);
        }, (benefit: BenefitView) => benefit.id)
      }

      ReadingSectionLabel({ text: '关联报修' })
      if (detail.recentOrders.length === 0) {
        Column() {
          Text('这台设备还没有报修记录。')
            .fontSize(FONT_NOTE)
            .fontColor($r('app.color.text_secondary'))
            .width('100%')
            .textAlign(TextAlign.Start)
        }
        .width('100%')
        .padding(CARD_PADDING)
        .backgroundColor($r('app.color.surface'))
        .borderRadius(CARD_RADIUS)
      } else {
        Column() {
          ForEach(detail.recentOrders, (order: DeviceOrderSummary) => {
            this.orderRow(order);
          }, (order: DeviceOrderSummary) => order.id)
        }
        .width('100%')
        .padding({ left: CARD_PADDING, right: CARD_PADDING, top: GAP_XS, bottom: GAP_XS })
        .backgroundColor($r('app.color.surface'))
        .borderRadius(CARD_RADIUS)
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  @Builder
  actionBar() {
    Column({ space: GAP_SM }) {
      Button('报修这台设备')
        .width('100%')
        .height(CONTROL_HEIGHT_MD + 4)
        .fontSize(FONT_SUBTITLE)
        .fontColor(Color.White)
        .backgroundColor($r('app.color.brand'))
        .borderRadius(24)
        .enabled(!this.removing)
        .onClick(() => {
          this.repairThisDevice();
        })
      Button('先测一下是什么问题')
        .width('100%')
        .height(CONTROL_HEIGHT_MD + 4)
        .fontSize(FONT_SUBTITLE)
        .fontColor($r('app.color.brand'))
        .backgroundColor($r('app.color.brand_soft'))
        .borderRadius(24)
        .enabled(!this.removing)
        .onClick(() => {
          this.diagnoseThisDevice();
        })
      Row({ space: CARD_GAP }) {
        Button('编辑信息')
          .layoutWeight(1)
          .height(CONTROL_HEIGHT_MD)
          .fontSize(FONT_TEXT)
          .fontColor($r('app.color.brand'))
          .backgroundColor($r('app.color.surface'))
          .enabled(!this.removing)
          .onClick(() => {
            this.noticeText = '';
            this.editing = true;
          })
        Button(this.removing ? '解绑中…' : '解绑设备')
          .layoutWeight(1)
          .height(CONTROL_HEIGHT_MD)
          .fontSize(FONT_TEXT)
          .fontColor($r('app.color.danger'))
          .backgroundColor($r('app.color.surface'))
          .enabled(!this.removing)
          .onClick(() => {
            this.remove();
          })
      }
      .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  build() {
    Column({ space: 0 }) {
      DetailHeader({
        title: '设备与权益',
        onBack: (): void => {
          if (!this.handleBack()) {
            this.onBack();
          }
        },
        refresh: true,
        onRefresh: (): void => {
          this.fetch();
        }
      })

      if (this.editing) {
        Scroll() {
          Column({ space: CARD_GAP }) {
            DeviceForm({
              deviceId: this.deviceId,
              initialLabel: this.detail === null ? '' : this.detail.label,
              initialBrand: this.detail === null ? '' : this.detail.brand,
              initialModel: this.detail === null ? '' : this.detail.model,
              initialSerial: this.detail === null || this.detail.serialNumber === null ? '' : this.detail.serialNumber,
              initialPurchaseOn: this.detail === null || this.detail.purchaseOn === null ? '' : this.detail.purchaseOn,
              submit: (deviceId: string, request: DeviceCreateRequest): Promise<void> => this.save(deviceId, request),
              onSaved: (): Promise<void> => this.afterSaved(),
              onCancel: (): void => {
                this.editing = false;
              },
              onSessionExpired: (): void => {
                this.onSessionExpired();
              }
            })
          }
          .width('100%')
          .padding({ left: 18, right: 18, top: 14, bottom: 24 })
          .alignItems(HorizontalAlign.Start)
        }
        .width('100%')
        .layoutWeight(1)
        .scrollBar(BarState.Off)
        .align(Alignment.Top)
      } else if (this.loading) {
        Column() {
          LoadingPanel({ text: '正在加载设备与权益…' })
        }
        .width('100%')
        .layoutWeight(1)
        .padding({ left: 18, right: 18, top: 14 })
      } else if (this.detail === null) {
        Column() {
          ErrorPanel({
            message: this.errorText === '' ? '加载失败，请重试' : this.errorText,
            onRetry: (): void => {
              this.fetch();
            }
          })
        }
        .width('100%')
        .layoutWeight(1)
        .padding({ left: 18, right: 18, top: 14 })
      } else {
        Scroll() {
          Column({ space: CARD_GAP }) {
            DetailNotice({
              text: '权益状态以门店登记信息为准。若这里的记录与纸质保修卡不一致，请携带机身到店核对。'
            })
            if (this.noticeText !== '') {
              Text(this.noticeText)
                .fontSize(FONT_NOTE)
                .fontColor($r('app.color.brand'))
                .width('100%')
                .textAlign(TextAlign.Start)
            }
            if (this.errorText !== '') {
              Text(this.errorText)
                .fontSize(FONT_NOTE)
                .fontColor($r('app.color.danger'))
                .width('100%')
                .textAlign(TextAlign.Start)
            }
            this.content(this.detail)
            this.actionBar()
          }
          .width('100%')
          .padding({ left: 18, right: 18, top: 14, bottom: 24 })
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
