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
  @State selected: string = 'all';
  @State categoryNames: string[] = [];
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
    if (!this.authenticated && this.selected === 'joined') this.selected = 'all';
    if (!this.disposed) this.load(false);
  }
  private selectFilter(key: string): void {
    if (key === this.selected) return;
    if (key === 'joined' && !this.authenticated) {
      this.onLogin();
      return;
    }
    this.selected = key;
    this.items = [];
    this.page = 0;
    this.totalPages = 0;
    this.load(false);
  }
  private async load(append: boolean): Promise<void> {
    const generation: number = ++this.generation;
    const stamp: string = SessionService.sessionStamp();
    this.loading = true; this.error = '';
    try {
      const category: string = this.selected.startsWith('category:') ? this.selected.slice('category:'.length) : '';
      const listing = CommunityService.circles(append ? this.page + 1 : 1, this.selected === 'joined', category);
      const filters = append ? Promise.resolve(this.categoryNames) : CommunityService.circleCategories();
      const results = await Promise.all([listing, filters]);
      const result = results[0];
      const categories = results[1];
      if (this.disposed || generation !== this.generation || stamp !== SessionService.sessionStamp()) return;
      this.categoryNames = categories;
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
      if (this.selected === 'joined' && !updated.joined) {
        this.items = this.items.filter((row: CircleView) => row.id !== updated.id);
      }
      this.onChanged();
    } catch (error) {
      if (!this.disposed && stamp === SessionService.sessionStamp()) this.error = (error as ApiRequestError).message;
    } finally { if (!this.disposed && stamp === SessionService.sessionStamp()) this.busyId = ''; }
  }
  @Builder filterLabel(key: string, label: string) {
    Text(label).fontSize(15).fontColor(this.selected === key ? FORUM_ACCENT : '#62666F')
      .fontWeight(this.selected === key ? FontWeight.Bold : FontWeight.Normal)
      .padding({ top: 14, bottom: 14 }).width('100%').onClick(() => { this.selectFilter(key); })
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
            this.filterLabel('all', '全部')
            this.filterLabel('joined', '已加入')
            ForEach(this.categoryNames, (name: string) => {
              this.filterLabel('category:' + name, name)
            }, (name: string) => name)
          }.width('100%')
        }.width(72).height('100%').align(Alignment.Top)
        Scroll() {
          Column({ space: 18 }) {
            if (this.loading && this.items.length === 0) { LoadingPanel({ text: '正在加载圈子…' }) }
            else if (this.items.length === 0 && this.error === '') {
              Text(this.selected === 'joined' ? '还没有加入圈子' : '这里还没有圈子').fontSize(15).fontColor('#62666F').padding(24)
            }
            ForEach(this.items, (item: CircleView) => {
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
