import { DETAIL_BACKGROUND, DetailEmptyOrders, DetailHeader, DetailNotice } from '../../core/ui/ReferenceDetail';
import { ApiRequestError, isSessionExpiredCode } from '../../core/network/ApiClient';
import { ErrorPanel, LoadingPanel } from '../../core/ui/StatePanel';
import { isNetworkErrorCode } from '../knowledge/KnowledgeFlow';
import {
  CARD_GAP,
  CARD_PADDING,
  CARD_RADIUS,
  CHIP_RADIUS,
  CONTROL_HEIGHT_MD,
  FONT_BODY,
  FONT_CHIP,
  FONT_NOTE,
  FONT_SUBTITLE,
  FONT_TEXT,
  GAP_SM,
  GAP_XS,
  PAGE_PADDING,
} from '../../core/ui/Theme';
import { DeviceFocusParam, ROUTE_DEVICE_DETAIL } from '../../core/ui/Routes';
import {
  DeviceCreateRequest,
  DeviceView,
  deviceStatusLabel,
} from './DeviceContract';
import { DeviceForm } from './DeviceForm';
import { DeviceService } from './DeviceService';

/** 列表加载状态：加载中 / 有数据 / 空数据 / 失败（四态，与我的报修一致）。 */
const STATE_LOADING: number = 0;
const STATE_READY: number = 1;
const STATE_EMPTY: number = 2;
const STATE_ERROR: number = 3;

/** 保存成功后的即时反馈，避免用户以为「点了一下没反应」。 */
const SAVED_TEXT: string = '设备已保存。保修权益需由门店工作人员登记后才会出现在详情里。';

/**
 * 客户的「我的设备」页（Issue #102）。
 *
 * 这里只有设备本身：绑定、改名、解绑。权益是**只读**的，由工作人员登记，
 * 所以本页与 DeviceService 都没有提交权益的入口 —— 这不是漏做，是权限边界。
 *
 * 设备归属由服务端按令牌判定：页面不传 ownerUserId，改路由参数也看不到别人的设备
 * （详情接口对外人的设备一律 404）。
 */
@Component
export struct MyDevicesPage {
  onBack: () => void = () => {};
  /** 打开设备详情（权益查询入口）。 */
  onOpen: (route: string, param: Object | null) => void = () => {};
  onSessionExpired: () => void = () => {};
  @State state: number = STATE_LOADING;
  @State devices: DeviceView[] = [];
  @State errorText: string = '';
  @State noticeText: string = '';
  @State showForm: boolean = false;
  /** 列表请求进行中（与 state 分开）：防止重试按钮连点触发并发请求。 */
  private requesting: boolean = false;
  /** 请求代次：页面销毁或重新加载后，迟到的响应不再写入状态。 */
  private listGeneration: number = 0;

  aboutToAppear(): void {
    this.load();
  }

  aboutToDisappear(): void {
    this.listGeneration += 1;
    this.requesting = false;
  }

  private async load(): Promise<void> {
    if (this.requesting) {
      return;
    }
    const generation: number = ++this.listGeneration;
    this.requesting = true;
    this.state = STATE_LOADING;
    this.errorText = '';
    try {
      const items: DeviceView[] = await DeviceService.listMine();
      if (generation !== this.listGeneration) {
        return;
      }
      this.devices = items;
      this.state = items.length === 0 ? STATE_EMPTY : STATE_READY;
    } catch (error) {
      if (generation !== this.listGeneration) {
        return;
      }
      this.state = STATE_ERROR;
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
      if (generation === this.listGeneration) {
        this.requesting = false;
      }
    }
  }

  /**
   * 新增与编辑共用一处提交：deviceId 为空即新增。
   * 成功后统一重拉列表，而不是就地拼装 —— 服务端可能复活了已解绑的旧记录，
   * 返回的 id 与本地推测的不一定一致。
   */
  private async save(deviceId: string, request: DeviceCreateRequest): Promise<void> {
    if (deviceId === '') {
      await DeviceService.create(request);
    } else {
      await DeviceService.update(deviceId, request);
    }
  }

  private async afterSaved(): Promise<void> {
    this.showForm = false;
    this.noticeText = SAVED_TEXT;
    await this.load();
  }

  private openDevice(device: DeviceView): void {
    const param: DeviceFocusParam = { deviceId: device.id };
    this.onOpen(ROUTE_DEVICE_DETAIL, param);
  }

  @Builder
  statusChip(status: string) {
    Text(deviceStatusLabel(status))
      .fontSize(FONT_CHIP)
      .fontColor($r('app.color.brand'))
      .padding({ left: GAP_SM, right: GAP_SM, top: 3, bottom: 3 })
      .backgroundColor($r('app.color.brand_soft'))
      .borderRadius(CHIP_RADIUS)
  }

  @Builder
  deviceCard(device: DeviceView) {
    Row({ space: CARD_GAP }) {
      Column({ space: GAP_SM }) {
        Row({ space: GAP_SM }) {
          Text(device.label)
            .fontSize(FONT_SUBTITLE)
            .fontWeight(FontWeight.Medium)
            .fontColor($r('app.color.text_primary'))
            .layoutWeight(1)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          this.statusChip(device.status)
        }
        .width('100%')

        Text(`${device.brand} ${device.model}`)
          .fontSize(FONT_TEXT)
          .fontColor($r('app.color.text_secondary'))
          .width('100%')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .textAlign(TextAlign.Start)

        Text(device.serialNumber === null || device.serialNumber === ''
          ? '序列号未填写'
          : `序列号 ${device.serialNumber}`)
          .fontSize(FONT_NOTE)
          .fontColor($r('app.color.text_secondary'))
          .width('100%')
          .textAlign(TextAlign.Start)

        Text(device.repairOrderCount > 0 ? `关联报修 ${device.repairOrderCount} 次` : '暂无关联报修')
          .fontSize(FONT_CHIP)
          .fontColor($r('app.color.text_secondary'))
          .width('100%')
          .textAlign(TextAlign.Start)
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
      this.openDevice(device);
    })
  }

  @Builder
  emptyView() {
    Column({ space: CARD_GAP }) {
      DetailEmptyOrders({ text: '还没有绑定设备' })
      Text('绑定后可以在设备详情里查看保修权益与关联报修。')
        .fontSize(FONT_NOTE)
        .fontColor($r('app.color.text_secondary'))
        .textAlign(TextAlign.Center)
        .padding({ left: PAGE_PADDING, right: PAGE_PADDING })
    }
    .width('100%')
  }

  @Builder
  errorView() {
    Column() {
      ErrorPanel({
        message: this.errorText === '' ? '加载失败，请重试' : this.errorText,
        onRetry: (): void => {
          this.load();
        }
      })
    }
    .width('100%')
    .backgroundColor($r('app.color.surface'))
    .borderRadius(CARD_RADIUS)
  }

  build() {
    Column({ space: 0 }) {
      DetailHeader({
        title: '我的设备',
        onBack: this.onBack,
        refresh: true,
        onRefresh: (): void => {
          this.load();
        }
      })

      if (this.showForm) {
        Scroll() {
          Column({ space: CARD_GAP }) {
            DeviceForm({
              submit: (deviceId: string, request: DeviceCreateRequest): Promise<void> => this.save(deviceId, request),
              onSaved: (): Promise<void> => this.afterSaved(),
              onCancel: (): void => {
                this.showForm = false;
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
      } else {
        Column() {
          DetailNotice({
            text: '设备由你本人绑定，用于记录序列号与购买日期；保修权益由门店工作人员登记，登记后在此可见。'
          })
        }
        .width('100%')
        .padding({ left: 18, right: 18, top: 14, bottom: 14 })

        if (this.noticeText !== '') {
          Text(this.noticeText)
            .fontSize(FONT_NOTE)
            .fontColor($r('app.color.brand'))
            .padding({ left: 18, right: 18, bottom: 10 })
        }

        if (this.state === STATE_EMPTY) {
          Column() {
            this.emptyView()
          }
          .width('100%')
          .layoutWeight(1)
        } else {
          Scroll() {
            Column({ space: CARD_GAP }) {
              if (this.state === STATE_LOADING) {
                LoadingPanel({ text: '正在加载设备…' })
              } else if (this.state === STATE_ERROR) {
                this.errorView()
              } else {
                ForEach(this.devices, (device: DeviceView) => {
                  this.deviceCard(device);
                }, (device: DeviceView) => device.id)
                Text('点开任一设备可查看权益与关联报修。')
                  .fontSize(FONT_NOTE)
                  .fontColor($r('app.color.text_secondary'))
                  .width('100%')
                  .textAlign(TextAlign.Start)
                  .padding({ top: GAP_XS })
              }
            }
            .width('100%')
            .padding({ left: 18, right: 18, bottom: 16 })
            .alignItems(HorizontalAlign.Start)
          }
          .layoutWeight(1)
          .width('100%')
          .scrollBar(BarState.Off)
          .align(Alignment.Top)
        }

        Button('添加设备')
          .fontSize(FONT_SUBTITLE)
          .height(CONTROL_HEIGHT_MD + 4)
          .width(184)
          .backgroundColor($r('app.color.brand'))
          .fontColor(Color.White)
          .borderRadius(24)
          .margin({ top: GAP_SM, bottom: 18 })
          .onClick(() => {
            this.noticeText = '';
            this.showForm = true;
          })
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(DETAIL_BACKGROUND)
  }
}
