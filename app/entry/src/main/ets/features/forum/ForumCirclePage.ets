import { ApiRequestError } from '../../core/network/ApiClient';
import { SessionService } from '../../core/auth/SessionService';
import { ErrorPanel } from '../../core/ui/StatePanel';
import { CircleParam, CircleView, CommunityService } from './CommunityService';
import { ForumFeed } from './ForumFeed';
import { FORUM_ACCENT, FORUM_BACKGROUND } from './ForumTheme';

@Component
export struct ForumCirclePage {
  param: CircleParam = { circleId: '' };
  @Prop authenticated: boolean = false;
  @Prop @Watch('load') refreshVersion: number = 0;
  onOpen: (route: string, param: Object | null) => void = () => {};
  onLogin: () => void = () => {};
  onChanged: () => void = () => {};
  @State circle: CircleView | null = null;
  @State searching: boolean = false;
  @State sort: string = 'latest';
  @State error: string = '';
  @State busy: boolean = false;
  private generation: number = 0;
  private disposed: boolean = false;
  aboutToAppear(): void { this.disposed = false; this.load(); }
  aboutToDisappear(): void { this.disposed = true; this.generation += 1; }
  private async load(): Promise<void> {
    const generation: number = ++this.generation;
    const stamp: string = SessionService.sessionStamp();
    try {
      const circle = await CommunityService.circle(this.param.circleId);
      if (!this.disposed && generation === this.generation && stamp === SessionService.sessionStamp()) { this.circle = circle; this.error = ''; }
    } catch (error) { if (!this.disposed && generation === this.generation) this.error = (error as ApiRequestError).message; }
  }
  private async join(): Promise<void> {
    if (!this.authenticated) { this.onLogin(); return; }
    if (this.busy || this.circle === null) return;
    const stamp: string = SessionService.sessionStamp();
    this.busy = true;
    try {
      const circle = await CommunityService.join(this.param.circleId, !this.circle.joined);
      if (!this.disposed && stamp === SessionService.sessionStamp()) { this.circle = circle; this.onChanged(); }
    } catch (error) { if (!this.disposed && stamp === SessionService.sessionStamp()) this.error = (error as ApiRequestError).message; }
    finally { if (!this.disposed && stamp === SessionService.sessionStamp()) this.busy = false; }
  }
  build() {
    Column() {
      if (this.circle !== null) {
        Stack() {
          if (this.circle!.coverUrl) { Image(this.circle!.coverUrl).width('100%').height(160).objectFit(ImageFit.Cover).opacity(0.4) }
          Column({ space: 8 }) {
            Text(this.circle!.name).fontSize(26).fontWeight(FontWeight.Bold).fontColor(Color.White).width('100%')
            Text(this.circle!.description).fontSize(13).fontColor('#DEE6F2').maxLines(2).width('100%')
            Row() {
              Text(`${this.circle!.memberCount} 成员 · ${this.circle!.postCount} 发帖`).fontSize(12).fontColor(Color.White).layoutWeight(1)
              if (!this.circle!.archived || this.circle!.joined) {
                Button(this.circle!.joined ? '已加入 · 退出' : '加入').height(34).fontSize(13)
                  .backgroundColor(FORUM_ACCENT).fontColor(Color.White).enabled(!this.busy).onClick(() => { this.join(); })
              }
            }.width('100%')
          }.padding(20).width('100%').alignItems(HorizontalAlign.Start)
        }.width('100%').height(160).backgroundColor('#182C47')
        Row({ space: 8 }) {
          Button('最新').fontColor(this.sort === 'latest' ? FORUM_ACCENT : '#62666F').backgroundColor(Color.Transparent).onClick(() => { this.sort = 'latest'; })
          Button('热门').fontColor(this.sort === 'hot' ? FORUM_ACCENT : '#62666F').backgroundColor(Color.Transparent).onClick(() => { this.sort = 'hot'; })
          Blank().layoutWeight(1)
          if (this.circle!.canManage) {
            Button('管理').fontColor(FORUM_ACCENT).backgroundColor(Color.Transparent).onClick(() => { this.onOpen('forum-circle-admin', this.param); })
          }
          if (!this.circle!.archived) {
            Button('发帖').fontColor(Color.White).backgroundColor(FORUM_ACCENT).onClick(() => {
              if (!this.authenticated) this.onLogin();
              else if (!this.circle!.joined) this.error = '加入圈子后才能发帖';
              else this.onOpen('forum-compose', this.param);
            })
          } else { Text('已归档 · 只读').fontSize(13).fontColor('#62666F') }
        }.width('100%').padding(8)
      }
      if (this.error !== '') { ErrorPanel({ message: this.error, onRetry: (): void => { this.load(); } }) }
      ForumFeed({ searching: $searching, circleId: this.param.circleId, sort: this.sort,
        authenticated: this.authenticated, refreshVersion: this.refreshVersion, onOpen: this.onOpen,
        onLogin: (): void => { if (this.circle?.canPost) this.onOpen('forum-compose', this.param); else this.join(); },
        onRequireLogin: this.onLogin, onChanged: this.onChanged, onSessionExpired: this.onLogin }).layoutWeight(1)
    }.width('100%').height('100%').backgroundColor(FORUM_BACKGROUND)
  }
}
