import { ApiClient, ApiRequestError, isSessionExpiredCode } from '../../core/network/ApiClient';
import { ApiConfig } from '../../core/network/ApiConfig';
import { SessionStore } from '../../core/auth/SessionStore';
import { ROUTE_FAVORITES, ROUTE_MESSAGES, ROUTE_REPAIR_RECORDS, ROUTE_STAFF_RECORD } from '../../core/ui/Routes';
import { LoadingPanel } from '../../core/ui/StatePanel';
import { StaffRecordParam, repairRecordStatusLabel } from './StaffRepairContract';
import { RecordListParam } from './RepairRecordsPage';

interface Metric { status: string; value: number | null; }
interface Summary { totalApprovedCount: Metric; monthApprovedCount: Metric; termApprovedCount: Metric; totalApprovedDurationMinutes: Metric; source: string; }
interface Queue { draftCount: number; pendingCount: number; rejectedCount: number; }
interface Recent { id: string; status: string; contentExcerpt: string; }
interface NoticeSummary { available: boolean; unreadCount: number | null; }
interface FavoriteSummary { available: boolean; count: number | null; }
export interface Dashboard { repairSummary: Summary; workQueue: Queue; recentActivity: Recent[]; degraded: string[]; notifications: NoticeSummary; favorites: FavoriteSummary; }
export function metricText(value: Metric): string { return value.status === 'AVAILABLE' && value.value !== null ? `${value.value}` : '待配置'; }

@Component
export struct WorkbenchSummary {
  @Prop @Watch('refresh') refreshVersion: number = 0;
  onOpen: (route: string, param: Object | null) => void = () => {};
  onSessionExpired: () => void = () => {};
  @State dashboard: Dashboard | null = null;
  @State loading: boolean = false;
  @State errorText: string = '';
  private generation: number = 0;

  aboutToAppear(): void { this.load(); }
  aboutToDisappear(): void { this.generation += 1; this.loading = false; }
  private refresh(): void { this.load(); }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    this.loading = true;
    this.errorText = '';
    try {
      const token = await SessionStore.readToken();
      if (token === '') throw new ApiRequestError('UNAUTHENTICATED', '请先登录', 401, '');
      const dashboard = await ApiClient.get<Dashboard>(ApiConfig.getBaseUrl(), '/api/v1/member/dashboard', token);
      if (generation === this.generation) this.dashboard = dashboard;
    } catch (error) {
      if (generation !== this.generation) return;
      this.dashboard = null;
      if (error instanceof ApiRequestError && isSessionExpiredCode(error.code)) { this.onSessionExpired(); return; }
      this.errorText = error instanceof ApiRequestError
        ? (error.code === 'NETWORK_ERROR' || error.code === 'UNEXPECTED_RESPONSE'
          ? '工作摘要加载失败，请检查连接' : error.message)
        : '工作摘要加载失败';
    } finally {
      if (generation === this.generation) this.loading = false;
    }
  }

  private openRecords(library: boolean): void {
    const param: RecordListParam = { library: library };
    this.onOpen(ROUTE_REPAIR_RECORDS, param);
  }

  @Builder
  metricCard(label: string, value: Metric) {
    Column({ space: 6 }) {
      Text(metricText(value)).fontSize(20).fontWeight(FontWeight.Bold).fontColor('#315F71')
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
      Text(label).fontSize(12).fontColor('#69747C').maxLines(2)
    }.width('48%').height(76).padding({ left: 13, right: 10, top: 11, bottom: 9 })
      .backgroundColor('#F3F7F9').borderRadius(14).alignItems(HorizontalAlign.Start)
  }

  @Builder
  queueCell(label: string, count: number) {
    Column({ space: 4 }) {
      Text(`${count}`).fontSize(20).fontWeight(FontWeight.Bold).fontColor('#315F71')
      Text(label).fontSize(12).fontColor('#69747C')
    }.layoutWeight(1).alignItems(HorizontalAlign.Start)
  }

  @Builder
  recentCard(record: Recent) {
    Row({ space: 9 }) {
      Text(repairRecordStatusLabel(record.status)).fontSize(11).fontColor('#286DA6')
        .padding({ left: 8, right: 8, top: 4, bottom: 4 })
        .backgroundColor('#E9F2F8').borderRadius(10)
      Text(record.contentExcerpt || '正文尚未填写').fontSize(13).fontColor('#303A40')
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis }).layoutWeight(1)
      Text('›').fontSize(20).fontColor('#829099')
    }.width('100%').padding(12).backgroundColor('#F3F7F9').borderRadius(14)
      .onClick(() => {
        const param: StaffRecordParam = { recordId: record.id, faultDescription: '' };
        this.onOpen(ROUTE_STAFF_RECORD, param);
      })
  }

  build() {
    Column({ space: 14 }) {
      Row() {
        Column({ space: 3 }) {
          Text('我的维修工作').fontSize(19).fontWeight(FontWeight.Bold).fontColor('#151B1F')
          Text('备案与维修贡献').fontSize(12).fontColor('#79848B')
        }.layoutWeight(1).alignItems(HorizontalAlign.Start)
        Button(this.loading ? '更新中…' : '刷新').fontSize(12).height(34)
          .fontColor('#286DA6').backgroundColor('#EEF5FA').enabled(!this.loading)
          .onClick(() => { this.load(); })
      }.width('100%')
      if (this.loading && this.dashboard === null) {
        LoadingPanel({ text: '正在读取工作摘要…' })
      }
      if (this.errorText !== '') {
        Row({ space: 10 }) {
          Text(this.errorText).fontSize(12).lineHeight(18).fontColor('#9B3D35').layoutWeight(1)
          Button('重试').fontSize(12).width(64).height(34)
            .fontColor('#286DA6').backgroundColor(Color.White)
            .onClick(() => { this.load(); })
        }.width('100%').padding(12).backgroundColor('#FFF5F2').borderRadius(14)
      }
      if (this.dashboard !== null) {
        Column({ space: 9 }) {
          Text('我的备案状态').fontSize(14).fontWeight(FontWeight.Medium).fontColor('#303A40')
          if (this.dashboard.degraded.includes('workQueue')) {
            Text('备案状态暂时不可用，刷新重试').fontSize(12).fontColor('#C34141')
          } else {
            Row({ space: 8 }) {
              this.queueCell('草稿', this.dashboard.workQueue.draftCount)
              this.queueCell('审核中', this.dashboard.workQueue.pendingCount)
              this.queueCell('已退回', this.dashboard.workQueue.rejectedCount)
            }.width('100%').padding(12).backgroundColor('#F3F7F9').borderRadius(14)
          }
        }.width('100%').alignItems(HorizontalAlign.Start)
        Row({ space: 9 }) {
          Button('本人备案 ›').layoutWeight(1).height(38).fontSize(13)
            .fontColor('#286DA6').backgroundColor('#EEF5FA')
            .onClick(() => { this.openRecords(false); })
          Button('已审核备案库 ›').layoutWeight(1).height(38).fontSize(13)
            .fontColor('#286DA6').backgroundColor('#EEF5FA')
            .onClick(() => { this.openRecords(true); })
        }.width('100%')
        Column({ space: 9 }) {
          Text('维修贡献').fontSize(14).fontWeight(FontWeight.Medium).fontColor('#303A40')
          if (this.dashboard.degraded.includes('repairSummary')) {
            Text('维修统计暂时不可用，刷新重试').fontSize(12).fontColor('#C34141')
          } else {
            Column({ space: 9 }) {
              Row() {
                this.metricCard('累计已审核', this.dashboard.repairSummary.totalApprovedCount)
                this.metricCard('本月已审核', this.dashboard.repairSummary.monthApprovedCount)
              }.width('100%').justifyContent(FlexAlign.SpaceBetween)
              Row() {
                this.metricCard('本学期已审核', this.dashboard.repairSummary.termApprovedCount)
                this.metricCard('累计维修分钟', this.dashboard.repairSummary.totalApprovedDurationMinutes)
              }.width('100%').justifyContent(FlexAlign.SpaceBetween)
            }.width('100%')
          }
        }.width('100%').alignItems(HorizontalAlign.Start)
        Column({ space: 9 }) {
          Text('近期备案').fontSize(14).fontWeight(FontWeight.Medium).fontColor('#303A40')
          if (this.dashboard.degraded.includes('recentActivity')) {
            Text('近期备案暂时不可用').fontSize(12).fontColor('#C34141')
          } else if (this.dashboard.recentActivity.length === 0) {
            Text('暂无本人备案').fontSize(13).fontColor('#79848B')
          } else {
            ForEach(this.dashboard.recentActivity, (record: Recent) => {
              this.recentCard(record);
            }, (record: Recent) => record.id)
          }
        }.width('100%').alignItems(HorizontalAlign.Start)
        Row({ space: 9 }) {
          Button(this.dashboard.notifications.available ? `消息 ${this.dashboard.notifications.unreadCount}` : '消息暂不可用')
            .layoutWeight(1).height(36).fontSize(12).fontColor('#52616B').backgroundColor('#F3F7F9')
            .onClick(() => { this.onOpen(ROUTE_MESSAGES, null); })
          Button(this.dashboard.favorites.available ? `收藏 ${this.dashboard.favorites.count}` : '收藏暂不可用')
            .layoutWeight(1).height(36).fontSize(12).fontColor('#52616B').backgroundColor('#F3F7F9')
            .onClick(() => { this.onOpen(ROUTE_FAVORITES, null); })
        }.width('100%')
      }
    }.width('100%').padding(16).backgroundColor(Color.White).borderRadius(20)
      .alignItems(HorizontalAlign.Start)
  }
}
