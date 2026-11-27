import { ApiRequestError } from '../../core/network/ApiClient';
import { SessionService } from '../../core/auth/SessionService';
import { ErrorPanel, LoadingPanel } from '../../core/ui/StatePanel';
import { CommunityService, FollowView } from './CommunityService';
import { FORUM_ACCENT, FORUM_BACKGROUND, FORUM_INK } from './ForumTheme';

@Component
export struct ForumFollowingPage {
  onChanged: () => void = () => {};
  onSessionExpired: () => void = () => {};
  @State items: FollowView[] = [];
  @State loading: boolean = false;
  @State error: string = '';
  @State busyId: string = '';
  @State page: number = 0;
  @State totalPages: number = 0;
  private generation: number = 0;
  private disposed: boolean = false;
  aboutToAppear(): void { this.disposed = false; this.load(false); }
  aboutToDisappear(): void { this.disposed = true; this.generation += 1; }
  private async load(append: boolean): Promise<void> {
    if (this.loading) return;
    const generation: number = ++this.generation;
    const stamp: string = SessionService.sessionStamp();
    this.loading = true; this.error = '';
    try {
      const result = await CommunityService.following(append ? this.page + 1 : 1);
      if (this.disposed || generation !== this.generation || stamp !== SessionService.sessionStamp()) return;
      this.items = append ? this.items.concat(result.items) : result.items;
      this.page = result.pagination.page; this.totalPages = result.pagination.totalPages;
      // 取消请求超时后，通过重新读取确认真实状态并刷新信息流。
      if (!append) this.onChanged();
    } catch (error) {
      if (this.disposed || generation !== this.generation || stamp !== SessionService.sessionStamp()) return;
      this.error = (error as ApiRequestError).message;
      if ((error as ApiRequestError).status === 401) { this.items = []; this.onSessionExpired(); }
    } finally { if (generation === this.generation && !this.disposed) this.loading = false; }
  }
  private async unfollow(item: FollowView): Promise<void> {
    if (this.busyId !== '') return;
    const stamp: string = SessionService.sessionStamp();
    this.busyId = item.id; this.error = '';
    try {
      await CommunityService.follow(item.id, false);
      if (this.disposed || stamp !== SessionService.sessionStamp()) return;
      this.onChanged();
      // 删除后从第一页重新查询，避免分页边界移动而漏人。
      this.items = []; this.load(false);
    } catch (error) {
      if (!this.disposed && stamp === SessionService.sessionStamp()) this.error = (error as ApiRequestError).message;
    } finally { if (!this.disposed && stamp === SessionService.sessionStamp()) this.busyId = ''; }
  }
  build() {
    Scroll() {
      Column({ space: 14 }) {
        Text('关注你感兴趣的校园作者').fontSize(14).fontColor('#62666F').width('100%')
        if (this.error !== '') { ErrorPanel({ message: this.error, onRetry: (): void => { this.load(false); } }) }
        if (this.loading && this.items.length === 0) { LoadingPanel({ text: '正在加载关注…' }) }
        else if (this.items.length === 0 && this.error === '') {
          Text('还没有关注任何人\n在帖子作者旁点击关注，动态将在关注频道出现。')
            .fontSize(15).fontColor('#62666F').lineHeight(26).padding(32)
        }
        ForEach(this.items, (item: FollowView) => {
          Row({ space: 12 }) {
            Image($r('app.media.forum_avatar')).width(40).height(40)
            Text(item.displayName).fontSize(16).fontColor(FORUM_INK).layoutWeight(1)
            Button(this.busyId === item.id ? '处理中' : '取消关注').fontSize(13).height(36)
              .fontColor(FORUM_ACCENT).backgroundColor('#F2F5F9').enabled(this.busyId === '')
              .onClick(() => { this.unfollow(item); })
          }.width('100%').padding(16).backgroundColor(Color.White).borderRadius(20)
        }, (item: FollowView) => item.id)
        if (this.page < this.totalPages) {
          Button(this.loading ? '加载中' : '加载更多').enabled(!this.loading).onClick(() => { this.load(true); })
        }
      }.width('100%').padding(16)
    }.width('100%').height('100%').align(Alignment.Top).backgroundColor(FORUM_BACKGROUND)
  }
}
