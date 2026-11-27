import { WorkbenchSummary } from '../repair/WorkbenchSummary';
import { ROUTE_STAFF_ACTIVITIES, ROUTE_MANAGEMENT } from '../../core/ui/Routes';
import { HOME_STAFF } from '../../core/auth/AuthContract';
import { ApiRequestError, isSessionExpiredCode } from '../../core/network/ApiClient';
import { DeviceFocusParam, ROUTE_CASE_LIBRARY, ROUTE_DEVICE_DETAIL, ROUTE_KNOWLEDGE_LIBRARY, ROUTE_KNOWLEDGE_SEARCH, ROUTE_MY_DEVICES, ROUTE_PUBLIC_CASES, ROUTE_PUBLIC_GUIDES, ROUTE_KNOWLEDGE, ROUTE_REPAIR_ORDERS, ROUTE_STAFF_ORDERS, ROUTE_STAFF_REVIEW } from '../../core/ui/Routes';
import { ReferenceBanner, ReferenceTitle, ReferenceShortcut, REFERENCE_BACKGROUND } from '../../core/ui/ReferencePage';
import { ErrorPanel, LoadingPanel } from '../../core/ui/StatePanel';
import { isNetworkErrorCode } from '../knowledge/KnowledgeFlow';
import { DeviceView, deviceStatusLabel } from '../devices/DeviceContract';
import { DeviceService } from '../devices/DeviceService';

/** 设备卡区块的加载状态（四态，与 StatePanel 配套）。 */
const DEVICE_LOADING: number = 0;
const DEVICE_READY: number = 1;
const DEVICE_EMPTY: number = 2;
const DEVICE_ERROR: number = 3;

interface ServiceEntry {
  title: string;
  note: string;
  icon: Resource;
  hue: string;
  route: string;
  /** false = 未接入：图标砖灰底，点击提示而不是跳转。 */
  ready: boolean;
}

function serviceEntries(): ServiceEntry[] {
  return [
    { title: 'AI 故障问诊', note: '故障定位与排查', icon: $r('app.media.ref_shield'), hue: 'orange', route: ROUTE_KNOWLEDGE, ready: true },
    { title: '我要报修', note: '提交电脑故障', icon: $r('app.media.ref_repair'), hue: 'blue', route: ROUTE_REPAIR_ORDERS, ready: true },
    { title: '报修进度', note: '查看处理进度', icon: $r('app.media.ref_cooling'), hue: 'green', route: ROUTE_REPAIR_ORDERS, ready: true },
    { title: '维修指南', note: '查阅公开维修指南', icon: $r('app.media.ref_system'), hue: 'purple', route: ROUTE_PUBLIC_GUIDES, ready: true }
  ];
}

/** 服务主页面对照④：真实绑定设备卡、两列功能卡、主题横幅与快捷入口。
 * 工作人员使用同一外观展示工作台。
 *
 * 设备自 Issue #102 起是**独立绑定数据**（客户自己在「我的设备」里填），
 * 不再从报修单的 `deviceModel` 反推 —— 反推会把同一机型的两台机器并成一条，
 * 也看不到没报修过的设备。
 */
@Component
export struct ServicePage {
  @Prop refreshVersion: number = 0;
  @Prop @Watch('refreshDevices') deviceRefreshVersion: number = 0;
  @Prop @Watch('authChanged') authenticated: boolean = false;
  onActivities: () => void = () => {};
  onOpen: (route: string, param: Object | null) => void = () => {};
  @Prop home: string = '';
  @Prop permissions: string[] = [];
  /** 由 HomePage 注入的导航栈：真实入口统一从这里压栈。 */
  pathStack: NavPathStack = new NavPathStack();
  onSessionExpired: () => void = () => {
  };
  @State deviceState: number = DEVICE_LOADING;
  @State devices: DeviceView[] = [];
  @State deviceErrorText: string = '';
  /** 列表请求进行中标记：防止重试按钮连点触发并发请求。 */
  private requesting: boolean = false;
  private deviceRefreshPending: boolean = false;
  private deviceGeneration: number = 0;

  aboutToAppear(): void {
    if (this.authenticated && this.home !== HOME_STAFF) {
      this.loadDevices();
    }
  }

  aboutToDisappear(): void {
    this.requesting = false;
    this.deviceRefreshPending = false;
    this.deviceGeneration += 1;
  }

  private authChanged(): void {
    this.deviceGeneration += 1;
    this.requesting = false;
    this.deviceRefreshPending = false;
    this.devices = [];
    if (this.authenticated && this.home !== HOME_STAFF) this.loadDevices();
  }

  private refreshDevices(): void {
    if (!this.authenticated || this.home === HOME_STAFF) return;
    if (this.requesting) {
      this.deviceRefreshPending = true;
      return;
    }
    this.loadDevices();
  }

  private entries(): ServiceEntry[] {
    if (this.home !== HOME_STAFF) {
      return serviceEntries();
    }
    const entries: ServiceEntry[] = [
      { title: '报修工作台', note: '待受理与我的处理', icon: $r('app.media.ref_repair'), hue: 'purple', route: ROUTE_STAFF_ORDERS, ready: true },
      { title: '知识问答', note: '有出处的 AI 咨询', icon: $r('app.media.ref_shield'), hue: 'blue', route: ROUTE_KNOWLEDGE, ready: true },
      { title: '典型案例库', note: '已发布的典型案例', icon: $r('app.media.ref_system'), hue: 'gold', route: ROUTE_CASE_LIBRARY, ready: true }
    ];
    if (this.permissions.includes('activity:staff')) entries.push({ title: '成员活动', note: '出勤与现场接待', icon: $r('app.media.ref_activity'), hue: 'purple', route: ROUTE_STAFF_ACTIVITIES, ready: true });
    if (this.permissions.includes('activity:admin')) entries.push({ title: '管理', note: '活动与报名管理', icon: $r('app.media.ref_grid'), hue: 'blue', route: ROUTE_MANAGEMENT, ready: true });
    if (this.permissions.includes('repair:review')) {
      entries.push({ title: '备案审核', note: '审核维修备案', icon: $r('app.media.ref_document'), hue: 'red', route: ROUTE_STAFF_REVIEW, ready: true });
    } else {
      entries.push({ title: '维修备案', note: '在已受理报修中建档', icon: $r('app.media.ref_document'), hue: 'green', route: ROUTE_STAFF_ORDERS, ready: true });
    }
    return entries;
  }

  private handleLoadError(error: Object): void {
    if (error instanceof ApiRequestError) {
      if (isSessionExpiredCode(error.code)) {
        this.onSessionExpired();
        return;
      }
      this.deviceErrorText = isNetworkErrorCode(error.code)
        ? `${error.message}（请检查服务器地址、网络与后端是否已启动）`
        : error.message;
    } else {
      this.deviceErrorText = '加载失败，请重试';
    }
  }

  /** 拉本人设备列表（已绑定），用于首页设备卡。 */
  private async loadDevices(): Promise<void> {
    if (this.requesting) {
      return;
    }
    const generation = ++this.deviceGeneration;
    this.requesting = true;
    this.deviceState = DEVICE_LOADING;
    this.deviceErrorText = '';
    try {
      const items: DeviceView[] = await DeviceService.listMine();
      if (generation !== this.deviceGeneration) return;
      this.devices = items;
      this.deviceState = items.length === 0 ? DEVICE_EMPTY : DEVICE_READY;
    } catch (error) {
      if (generation !== this.deviceGeneration) return;
      this.deviceState = DEVICE_ERROR;
      this.handleLoadError(error);
    } finally {
      if (generation === this.deviceGeneration) {
        this.requesting = false;
        if (this.deviceRefreshPending) {
          this.deviceRefreshPending = false;
          await this.loadDevices();
        }
      }
    }
  }

  private openEntry(entry: ServiceEntry): void {
    if (entry.route === '') {
      this.getUIContext().getPromptAction().showToast({ message: `${entry.title}未接入，接口确定后开放` });
      return;
    }
    this.onOpen(entry.route, null);
  }

  /** 打开设备详情（权益查询）。入口只有已绑定设备，故只需设备 ID。 */
  private openDevice(deviceId: string): void {
    const focus: DeviceFocusParam = { deviceId: deviceId };
    this.onOpen(ROUTE_DEVICE_DETAIL, focus);
  }


  @Builder
  deviceCard(device: DeviceView) {
    Row({ space: 18 }) {
      Image($r('app.media.ref_laptop_hero')).width(96).height(106).objectFit(ImageFit.Contain)
      Column({ space: 10 }) {
        Text('我的设备').fontSize(11).fontColor('#747A7F')
        Text(device.label).fontSize(19).fontWeight(FontWeight.Bold).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(`${device.brand} ${device.model}`).fontSize(12).fontColor('#6D757B').maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(deviceStatusLabel(device.status)).fontSize(12).fontColor('#477886')
          .padding({ left: 9, right: 9, top: 4, bottom: 4 }).backgroundColor('#F2F6F8').borderRadius(16)
      }.alignItems(HorizontalAlign.Start).layoutWeight(1)
      Text('›').fontSize(26).fontColor('#92989D')
    }.width('100%').height(136).padding(16).backgroundColor(Color.White).borderRadius(20)
      .onClick(() => { this.openDevice(device.id); })
  }

  @Builder
  deviceSection() {
    if (this.home === HOME_STAFF) {
      Row({ space: 16 }) {
        Image($r('app.media.ref_repair')).width(70).height(70)
        Column({ space: 8 }) {
          Text('工作人员工作台').fontSize(20).fontWeight(FontWeight.Bold)
          Text('受理报修 · 跟进处理 · 维修备案').fontSize(12).fontColor('#747A7F')
          Button('查看待处理报修').fontSize(12).height(30).fontColor('#2877D9').backgroundColor('#F0F6FD')
            .onClick(() => { this.onOpen(ROUTE_STAFF_ORDERS, null); })
        }.layoutWeight(1).alignItems(HorizontalAlign.Start)
      }.width('100%').height(136).padding(18).backgroundColor(Color.White).borderRadius(20)
    } else if (this.authenticated && this.deviceState === DEVICE_LOADING) {
      Column() { LoadingPanel({ text: '正在加载我的设备…' }) }
        .width('100%').height(136).backgroundColor(Color.White).borderRadius(20)
    } else if (this.authenticated && this.deviceState === DEVICE_ERROR) {
      Column() {
        ErrorPanel({ message: this.deviceErrorText, onRetry: (): void => { this.loadDevices(); } })
      }.width('100%').backgroundColor(Color.White).borderRadius(20)
    } else if (this.authenticated && this.deviceState === DEVICE_READY) {
      Swiper() {
        ForEach(this.devices, (device: DeviceView) => { this.deviceCard(device); }, (device: DeviceView) => device.id)
      }.height(136).width('100%').loop(false).indicator(false)
    } else {
      Row({ space: 14 }) {
        Image($r('app.media.ref_laptop_hero')).width(98).height(108).objectFit(ImageFit.Contain)
        Column({ space: 8 }) {
          Text(this.authenticated ? '还没有绑定设备' : '我的电脑').fontSize(21).fontWeight(FontWeight.Bold)
          Text(this.authenticated ? '绑定后可在这里查看保修权益与关联报修' : '登录后绑定设备，查看权益与报修进度')
            .fontSize(12).fontColor('#737B81')
          Button(this.authenticated ? '去绑定设备' : '登录查看').fontSize(12).height(30)
            .fontColor('#2877D9').backgroundColor('#F0F6FD')
            .onClick(() => { this.onOpen(ROUTE_MY_DEVICES, null); })
        }.alignItems(HorizontalAlign.Start).layoutWeight(1)
      }.width('100%').height(136).padding(16).backgroundColor(Color.White).borderRadius(20)
    }
  }

  @Builder
  functionCard(entry: ServiceEntry) {
    Button({ type: ButtonType.Normal }) {
      Row({ space: 12 }) {
        Image(entry.icon).width(36).height(40).objectFit(ImageFit.Contain)
        Column({ space: 4 }) {
          Text(entry.title).fontSize(14).fontWeight(FontWeight.Bold).fontColor('#191D20').maxLines(1)
          Text(entry.note).fontSize(11).fontColor('#6D757B').maxLines(2)
        }.alignItems(HorizontalAlign.Start).layoutWeight(1)
      }.width('100%').padding(16)
    }.width('49%').height(76).backgroundColor(Color.White).borderRadius(20).margin({ bottom: 8 })
      .onClick(() => { this.openEntry(entry); })
  }

  /**
   * 知识与帮助（#83）：知识分类 / 目录、搜索、公开指南与案例从服务进入。
   *
   * 这些入口原来挂在顶层「知识」Tab 上；迁入后统一压导航栈，页内返回与系统返回
   * 都只弹栈，落回本页（客户：服务；工作人员：工作台），不再跳回首页。
   * 案例入口按角色分流：客户走公开案例，工作人员走典型案例库，权限仍在服务端。
   */
  @Builder
  knowledgeSection() {
    Text('知识与帮助').fontSize(20).fontWeight(FontWeight.Bold).margin({ top: 10 })
    Row() {
      ReferenceShortcut({ title: '分类目录', icon: $r('app.media.ref_grid'),
        onSelect: (): void => { this.onOpen(ROUTE_KNOWLEDGE_LIBRARY, null); } })
      ReferenceShortcut({ title: '知识搜索', icon: $r('app.media.home_search'),
        onSelect: (): void => { this.onOpen(ROUTE_KNOWLEDGE_SEARCH, null); } })
      ReferenceShortcut({ title: '维修指南', icon: $r('app.media.ref_system'),
        onSelect: (): void => { this.onOpen(ROUTE_PUBLIC_GUIDES, null); } })
      ReferenceShortcut({ title: this.home === HOME_STAFF ? '典型案例库' : '公开案例', icon: $r('app.media.ref_document'),
        onSelect: (): void => {
          this.onOpen(this.home === HOME_STAFF ? ROUTE_CASE_LIBRARY : ROUTE_PUBLIC_CASES, null);
        } })
    }.width('100%')
    if (this.home === HOME_STAFF) {
      Text('分类、搜索、指南与案例都由本页进入：游客可读公开指南与知识目录，案例按既有权限要求登录，登录成功后自动续接原操作。')
        .fontSize(10).fontColor('#8C949A').lineHeight(16)
    }
  }

  @Builder
  featuredService() {
    Text('精选服务').fontSize(20).fontWeight(FontWeight.Bold).margin({ top: 8 })
    ReferenceBanner({
      title: '电脑医院  校园服务', subtitle: '先排查，再安心维修',
      image: $r('app.media.ref_service_hero'), actionText: '查看维修指南', bannerHeight: 150,
      onSelect: (): void => { this.onOpen(ROUTE_PUBLIC_GUIDES, null); }
    })
  }

  build() {
    Scroll() {
      Column({ space: 10 }) {
        ReferenceTitle({
          title: this.home === HOME_STAFF ? '工作台' : '我的电脑',
          onConsult: (): void => { this.onOpen(ROUTE_KNOWLEDGE, null); },
          onRecords: (): void => { this.onOpen(this.home === HOME_STAFF ? ROUTE_STAFF_ORDERS : ROUTE_REPAIR_ORDERS, null); }
        })
        this.deviceSection()
        if (this.authenticated && this.home === HOME_STAFF && this.permissions.includes('member.profile.read_self')) {
          WorkbenchSummary({ refreshVersion: this.refreshVersion, onOpen: this.onOpen, onSessionExpired: this.onSessionExpired })
        }
        Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
          ForEach(this.entries(), (entry: ServiceEntry) => { this.functionCard(entry); }, (entry: ServiceEntry) => entry.title)
        }.width('100%')
        if (this.home === HOME_STAFF) {
          this.knowledgeSection()
          this.featuredService()
        } else {
          this.featuredService()
          this.knowledgeSection()
        }
        Text('快捷服务').fontSize(20).fontWeight(FontWeight.Bold).margin({ top: 15 })
        Row() {
          if (this.home === HOME_STAFF) {
            ReferenceShortcut({ title: '故障问诊', icon: $r('app.media.ref_shield'), onSelect: (): void => { this.onOpen(ROUTE_KNOWLEDGE, null); } })
          } else {
            // 客户侧「故障问诊」已在上方功能卡里，这里换成设备入口（Issue #102）。
            ReferenceShortcut({ title: '我的设备', icon: $r('app.media.reading_laptop'), onSelect: (): void => { this.onOpen(ROUTE_MY_DEVICES, null); } })
          }
          ReferenceShortcut({ title: this.home === HOME_STAFF ? '报修工作台' : '服务进度', icon: $r('app.media.ref_cooling'), onSelect: (): void => { this.onOpen(this.home === HOME_STAFF ? ROUTE_STAFF_ORDERS : ROUTE_REPAIR_ORDERS, null); } })
          ReferenceShortcut({ title: '维修指南', icon: $r('app.media.ref_system'), onSelect: (): void => { this.onOpen(ROUTE_PUBLIC_GUIDES, null); } })
          ReferenceShortcut({ title: '近期活动', icon: $r('app.media.ref_activity'), onSelect: this.onActivities })
        }.width('100%')
        if (this.authenticated && this.home !== HOME_STAFF) {
          Text('设备由你本人绑定；保修权益由门店工作人员登记，登记后才在设备详情里显示。').fontSize(10).fontColor('#8C949A')
          Button('刷新设备记录').fontSize(12).backgroundColor('#E9EFF4').fontColor('#596874')
            .enabled(!this.requesting).onClick(() => { this.loadDevices(); })
        }
      }.width('100%').padding({ left: 16, right: 16, bottom: 90 }).alignItems(HorizontalAlign.Start)
    }.width('100%').height('100%').scrollBar(BarState.Off).align(Alignment.Top).backgroundColor(REFERENCE_BACKGROUND)
  }
}
