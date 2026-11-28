import { ApiRequestError } from '../../core/network/ApiClient';
import { SessionService } from '../../core/auth/SessionService';
import { CheckInView, CommunityService } from './CommunityService';
import { FORUM_ACCENT, FORUM_INK } from './ForumTheme';

@Component
export struct CommunityCheckInPage {
  @Prop @Watch('load') authenticated: boolean = false;
  onLogin: () => void = () => {};
  onSessionExpired: () => void = () => {};
  onOpen: (route: string, param: Object | null) => void = () => {};
  @State status: CheckInView | null = null;
  @State busy: boolean = false;
  @State error: string = '';
  private disposed: boolean = false;
  private generation: number = 0;
  private timer: number = -1;
  aboutToAppear(): void { this.disposed = false; this.load(); }
  aboutToDisappear(): void { this.disposed = true; this.generation += 1; if (this.timer !== -1) clearTimeout(this.timer); }
  private async load(): Promise<void> { await this.request(false); }
  private async request(write: boolean): Promise<void> {
    if (!this.authenticated) { this.status = null; if (write) this.onLogin(); return; }
    if (this.busy) return;
    const stamp: string = SessionService.sessionStamp();
    const generation: number = ++this.generation;
    this.busy = true; this.error = '';
    try {
      const result = write ? await CommunityService.checkIn() : await CommunityService.checkInStatus();
      if (this.disposed || stamp !== SessionService.sessionStamp() || generation !== this.generation) return;
      this.status = result;
      if (this.timer !== -1) clearTimeout(this.timer);
      const delay: number = Math.max(1000, new Date(result.nextDayAt).getTime() - Date.now() + 100);
      this.timer = setTimeout(() => { this.timer = -1; this.load(); }, delay);
    } catch (error) {
      if (this.disposed || stamp !== SessionService.sessionStamp()) return;
      this.error = (error as ApiRequestError).message;
      if ((error as ApiRequestError).status === 401) { this.status = null; this.onSessionExpired(); }
    } finally { if (!this.disposed && generation === this.generation) this.busy = false; }
  }
  private rewards(): number[] { return this.status?.rewards ?? [1, 1, 1, 2, 2, 2, 3]; }
  private completed(index: number): boolean {
    return this.status !== null && this.status.checkedIn && index <= (this.status.streak - 1) % 7;
  }
  build() {
    Scroll() {
      Column({ space: 22 }) {
        Text('校园同行\n每日打卡').fontSize(32).fontWeight(FontWeight.Bold).fontColor(FORUM_INK).lineHeight(44).width('100%')
        Text('记录每一天的参与').fontSize(16).fontColor('#8B6A45').width('100%')
        Button(this.status === null ? '我的积分' : `我的积分  ${this.status.points}  ›`).fontSize(17).fontColor('#8B6A45')
          .backgroundColor(Color.Transparent).padding(0).onClick(() => { this.onOpen('community-points', null); })
        Column({ space: 22 }) {
          Row() {
            Text(this.status === null ? '登录查看打卡状态' : `已连续打卡 ${this.status.streak} 天`).fontSize(20).fontWeight(FontWeight.Bold).fontColor(FORUM_INK).layoutWeight(1)
            if (this.status !== null) { Text(this.status.day).fontSize(11).fontColor('#8B6A45') }
          }.width('100%')
          Row({ space: 4 }) {
            ForEach(this.rewards(), (points: number, index: number) => {
              Column({ space: 10 }) {
                Text('+' + points).fontSize(17).fontWeight(FontWeight.Bold).fontColor(this.completed(index) ? Color.White : '#C97D38')
                Text(this.completed(index) ? '✓' : '○').fontSize(25).fontColor(this.completed(index) ? Color.White : '#ECA958')
                Text(`${index + 1}天`).fontSize(11).fontColor(this.completed(index) ? Color.White : '#8B6A45')
              }.layoutWeight(1).height(104).justifyContent(FlexAlign.Center).borderRadius(10)
                .backgroundColor(this.completed(index) ? '#F2973D' : '#FAF1E8')
            }, (_points: number, index: number) => index.toString())
          }.width('100%')
          if (this.error !== '') { Text(this.error).fontSize(13).fontColor('#B04438').width('100%') }
          Button(this.busy ? '正在确认…' : (this.status?.checkedIn ? '今日已打卡' : (this.authenticated ? '立即打卡' : '登录打卡')))
            .width('100%').height(48).fontSize(17).fontColor(this.status?.checkedIn ? '#8B8D90' : Color.White)
            .backgroundColor(this.status?.checkedIn ? '#F1F2F3' : '#ED923A').enabled(!this.busy && !this.status?.checkedIn)
            .onClick(() => { this.request(true); })
          Button('刷新状态').fontColor(FORUM_ACCENT).backgroundColor(Color.Transparent).enabled(!this.busy)
            .onClick(() => { this.load(); })
        }.padding(20).width('100%').backgroundColor(Color.White).borderRadius(28)
        Text('打卡规则').fontSize(20).fontWeight(FontWeight.Bold).fontColor(FORUM_INK).width('100%')
        Text('每日按北京时间计算，每账号一次。连续七天奖励为 1、1、1、2、2、2、3 分，之后重新循环；中断后从第 1 天开始，不支持补签。')
          .fontSize(14).lineHeight(24).fontColor('#786858').width('100%')
        Text('参加维修活动，由工作人员确认现场签到后，每场活动获得 10 分。社区每日打卡与现场排队分别记录。')
          .fontSize(14).lineHeight(24).fontColor('#786858').width('100%')
      }.padding(20).width('100%').alignItems(HorizontalAlign.Start)
    }.width('100%').height('100%').align(Alignment.Top).backgroundColor('#FFF7E7')
  }
}
