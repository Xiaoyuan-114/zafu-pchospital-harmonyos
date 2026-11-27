import { ApiRequestError } from '../../core/network/ApiClient';
import { SessionService } from '../../core/auth/SessionService';
import { ErrorPanel, LoadingPanel } from '../../core/ui/StatePanel';
import { CircleParam, CircleView, CommunityService } from './CommunityService';
import { FORUM_ACCENT, FORUM_BACKGROUND, FORUM_INK } from './ForumTheme';

@Component
export struct ForumCirclesPage {
  @Prop @Watch('reload') refreshVersion: number = 0;
  @Prop @Watch('onAuthChanged') authenticated: boolean = false;
  @Prop canManage: boolean = false;
  onOpen: (route: string, param: Object | null) => void = () => {};
  onLogin: () => void = () => {};
  onChanged: () => void = () => {};
  @State items: CircleView[] = [];
  @State selected: string = '全部';
  @State loading: boolean = false;
  @State error: string = '';
  @State busyId: string = '';
  @State page: number = 0;
  @State totalPages: number = 0;
  private generation: number = 0;
  private disposed: boolean = false;
  aboutToAppear(): void { this.disposed = false; this.load(false); }
  aboutToDisappear(): void { this.disposed = true; this.generation += 1; }
  private reload(): void { this.load(false); }
  private onAuthChanged(): void {
    this.generation += 1;
    this.items = []; this.page = 0; this.totalPages = 0; this.busyId = ''; this.error = '';
    if (!this.authenticated) this.selected = '全部';
    if (!this.disposed) this.load(false);
  }
  private categories(): string[] {
    const result: string[] = ['全部', '已加入'];
    this.items.forEach((item: CircleView) => { if (!result.includes(item.category)) result.push(item.category); });
    return result;
  }
  private visible(): CircleView[] {
    if (this.selected === '全部') return this.items;
    if (this.selected === '已加入') return this.items.filter((item: CircleView) => item.joined);
    return this.items.filter((item: CircleView) => item.category === this.selected);
  }
  private async load(append: boolean): Promise<void> {
    const generation: number = ++this.generation;
    const stamp: string = SessionService.sessionStamp();
    this.loading = true; this.error = '';
    try {
      const result = await CommunityService.circles(append ? this.page + 1 : 1, this.selected === '已加入');
      if (this.disposed || generation !== this.generation || stamp !== SessionService.sessionStamp()) return;
      this.items = append ? this.items.concat(result.items) : result.items;
      this.page = result.pagination.page; this.totalPages = result.pagination.totalPages;
    } catch (error) {
      if (!this.disposed && generation === this.generation && stamp === SessionService.sessionStamp()) this.error = (error as ApiRequestError).message;
    } finally { if (!this.disposed && generation === this.generation) this.loading = false; }
  }
  private async join(item: CircleView): Promise<void> {
    if (!this.authenticated) { this.onLogin(); return; }
    if (this.busyId !== '') return;
    const stamp: string = SessionService.sessionStamp();
    this.busyId = item.id; this.error = '';
    try {
      const updated = await CommunityService.join(item.id, !item.joined);
      if (this.disposed || stamp !== SessionService.sessionStamp()) return;
      this.items = this.items.map((row: CircleView) => row.id === updated.id ? updated : row);
      this.onChanged();
    } catch (error) {
      if (!this.disposed && stamp === SessionService.sessionStamp()) this.error = (error as ApiRequestError).message;
    } finally { if (!this.disposed && stamp === SessionService.sessionStamp()) this.busyId = ''; }
  }
  build() {
    Column({ space: 12 }) {
      Row() {
        Text('全部圈子').fontSize(24).fontWeight(FontWeight.Bold).fontColor(FORUM_INK).layoutWeight(1)
        if (this.canManage) {
          Button('管理').fontSize(14).fontColor(FORUM_ACCENT).backgroundColor(Color.Transparent)
            .onClick(() => { this.onOpen('forum-circle-admin', null); })
        }
      }.width('100%').padding({ left: 16, right: 16 })
      if (this.error !== '') { ErrorPanel({ message: this.error, onRetry: (): void => { this.load(false); } }) }
      Row({ space: 12 }) {
        Scroll() {
          Column({ space: 12 }) {
            ForEach(this.categories(), (name: string) => {
              Text(name).fontSize(15).fontColor(this.selected === name ? FORUM_ACCENT : '#62666F')
                .fontWeight(this.selected === name ? FontWeight.Bold : FontWeight.Normal)
                .padding({ top: 14, bottom: 14 }).width('100%').onClick(() => {
                  if (name === '已加入' && !this.authenticated) { this.onLogin(); return; }
                  this.selected = name; this.load(false);
                })
            })
          }.width('100%')
        }.width(72).height('100%').align(Alignment.Top)
        Scroll() {
          Column({ space: 18 }) {
            if (this.loading && this.items.length === 0) { LoadingPanel({ text: '正在加载圈子…' }) }
            else if (this.visible().length === 0 && this.error === '') {
              Text(this.selected === '已加入' ? '还没有加入圈子' : '这里还没有圈子').fontSize(15).fontColor('#62666F').padding(24)
            }
            ForEach(this.visible(), (item: CircleView) => {
              Column({ space: 10 }) {
                Row({ space: 10 }) {
                  if (item.coverUrl) { Image(item.coverUrl).width(48).height(48).borderRadius(12).objectFit(ImageFit.Cover) }
                  else { Text(item.name.substring(0, 1)).fontSize(23).fontColor(FORUM_ACCENT).width(48).height(48).textAlign(TextAlign.Center).backgroundColor('#E9F0FC').borderRadius(12) }
                  Column({ space: 4 }) {
                    Text(item.name).fontSize(17).fontWeight(FontWeight.Bold).fontColor(FORUM_INK)
                    Text(`${item.memberCount} 成员 · ${item.postCount} 发帖`).fontSize(11).fontColor('#62666F')
                  }.alignItems(HorizontalAlign.Start).layoutWeight(1)
                }.width('100%').onClick(() => {
                  const param: CircleParam = { circleId: item.id }; this.onOpen('forum-circle', param);
                })
                Row() {
                  Text(item.archived ? '已归档 · 只读' : item.description).fontSize(12).maxLines(2).fontColor('#62666F').layoutWeight(1)
                  if (!item.archived || item.joined) {
                    Button(item.joined ? '退出' : '加入').fontSize(13).height(32).fontColor(FORUM_ACCENT).backgroundColor('#F0F3F8')
                      .enabled(this.busyId === '').onClick(() => { this.join(item); })
                  }
                }.width('100%')
                Divider().color('#DFE5EB')
              }.width('100%').alignItems(HorizontalAlign.Start)
            }, (item: CircleView) => `${item.id}-${item.joined}-${item.memberCount}-${item.archived}`)
            if (this.page < this.totalPages) {
              Button(this.loading ? '加载中' : '加载更多圈子').enabled(!this.loading).onClick(() => { this.load(true); })
            }
          }.width('100%').padding({ bottom: 112 })
        }.layoutWeight(1).height('100%').align(Alignment.Top)
      }.layoutWeight(1).width('100%').padding({ left: 16, right: 16 })
    }.width('100%').height('100%').backgroundColor(FORUM_BACKGROUND)
  }
}
