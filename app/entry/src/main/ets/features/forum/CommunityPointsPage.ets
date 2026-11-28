import { ApiRequestError } from '../../core/network/ApiClient';
import { SessionService } from '../../core/auth/SessionService';
import { CommunityService, PointEntry } from './CommunityService';
import { forumTimeText } from './ForumContract';
import { FORUM_ACCENT, FORUM_BACKGROUND, FORUM_INK } from './ForumTheme';

@Component
export struct CommunityPointsPage {
  onSessionExpired: () => void = () => {};
  @State items: PointEntry[] = [];
  @State points: number | null = null;
  @State error: string = '';
  @State loading: boolean = false;
  @State page: number = 0;
  @State totalPages: number = 0;
  private disposed: boolean = false;
  private generation: number = 0;
  aboutToAppear(): void { this.disposed = false; this.load(false); }
  aboutToDisappear(): void { this.disposed = true; this.generation += 1; }
  private async load(append: boolean): Promise<void> {
    if (this.loading) return;
    const generation: number = ++this.generation; const stamp: string = SessionService.sessionStamp();
    this.loading = true; this.error = '';
    try {
      const status = await CommunityService.checkInStatus();
      const result = await CommunityService.points(append ? this.page + 1 : 1);
      if (this.disposed || generation !== this.generation || stamp !== SessionService.sessionStamp()) return;
      this.points = status.points; this.items = append ? this.items.concat(result.items) : result.items;
      this.page = result.pagination.page; this.totalPages = result.pagination.totalPages;
    } catch (error) {
      if (this.disposed || generation !== this.generation || stamp !== SessionService.sessionStamp()) return;
      this.error = (error as ApiRequestError).message;
      if ((error as ApiRequestError).status === 401) { this.items = []; this.points = null; this.onSessionExpired(); }
    } finally { if (!this.disposed && generation === this.generation) this.loading = false; }
  }
  build() {
    Scroll() {
      Column({ space: 16 }) {
        Column({ space: 10 }) {
          Text('累计积分').fontSize(15).fontColor('#62666F')
          Text(this.points === null ? '—' : this.points.toString()).fontSize(48).fontWeight(FontWeight.Bold).fontColor(FORUM_ACCENT)
          Text('每日打卡与活动现场参与记录').fontSize(13).fontColor('#62666F')
        }.width('100%').padding(24).backgroundColor(Color.White).borderRadius(24)
        Row() {
          Text('积分明细').fontSize(20).fontWeight(FontWeight.Bold).fontColor(FORUM_INK).layoutWeight(1)
          Button('刷新').fontColor(FORUM_ACCENT).backgroundColor(Color.Transparent).enabled(!this.loading).onClick(() => { this.load(false); })
        }.width('100%')
        if (this.error !== '') { Text(this.error).fontColor('#B04438').fontSize(14).width('100%') }
        if (this.loading && this.items.length === 0) { LoadingProgress().width(32).height(32) }
        else if (this.items.length === 0 && this.error === '') { Text('暂无积分记录').fontColor('#62666F').padding(28) }
        ForEach(this.items, (item: PointEntry) => {
          Row({ space: 12 }) {
            Column({ space: 7 }) {
              Text(item.description).fontSize(15).fontColor(FORUM_INK)
              Text(forumTimeText(item.createdAt, true) + '（北京时间）').fontSize(11).fontColor('#62666F')
            }.layoutWeight(1).alignItems(HorizontalAlign.Start)
            Text((item.amount > 0 ? '+' : '') + item.amount).fontSize(21).fontWeight(FontWeight.Bold)
              .fontColor(item.amount > 0 ? FORUM_ACCENT : '#B04438')
          }.width('100%').padding(16).backgroundColor(Color.White).borderRadius(18)
        }, (item: PointEntry) => item.id)
        if (this.page < this.totalPages) {
          Button(this.loading ? '加载中' : '加载更多').enabled(!this.loading).onClick(() => { this.load(true); })
        }
      }.padding(16).width('100%')
    }.width('100%').height('100%').align(Alignment.Top).backgroundColor(FORUM_BACKGROUND)
  }
}
