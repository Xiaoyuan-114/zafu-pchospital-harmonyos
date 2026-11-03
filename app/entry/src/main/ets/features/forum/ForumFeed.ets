import { image } from '@kit.ImageKit';
import { LengthMetrics } from '@kit.ArkUI';
import { ApiRequestError, isSessionExpiredCode } from '../../core/network/ApiClient';
import { ApiPage } from '../../core/network/ApiContract';
import { FORUM_ACCENT, FORUM_BACKGROUND, FORUM_INK, FORUM_LINE, FORUM_MUTED, FORUM_SECONDARY, FORUM_SURFACE } from './ForumTheme';
import { ROUTE_FORUM_POST } from '../../core/ui/Routes';
import {
  FORUM_CATEGORY_EXPERIENCE,
  FORUM_CATEGORY_GENERAL,
  FORUM_CATEGORY_QUESTION,
  ForumImageView,
  ForumPostParam,
  ForumPostView,
  forumCategoryLabel
} from './ForumContract';
import { ForumService } from './ForumService';

function forumTimeText(value: string): string {
  const time: Date = new Date(new Date(value).getTime() + 8 * 3600000);
  return `${time.getUTCFullYear()}-${(time.getUTCMonth() + 1).toString().padStart(2, '0')}-${time.getUTCDate().toString().padStart(2, '0')} ${time.getUTCHours().toString().padStart(2, '0')}:${time.getUTCMinutes().toString().padStart(2, '0')}`;
}

/** 公开帖子图片：按真实 API 路径读取并解码，失败可单独重试。 */
@Component
struct ForumPostImage {
  @Prop @Watch('onUrlChanged') url: string = '';
  @Prop cornerRadius: number = 12;
  @State pixelMap: image.PixelMap | undefined = undefined;
  @State failed: boolean = false;
  private generation: number = 0;

  aboutToAppear(): void {
    this.load();
  }

  aboutToDisappear(): void {
    this.generation += 1;
    const current: image.PixelMap | undefined = this.pixelMap;
    if (current !== undefined) {
      this.pixelMap = undefined;
      current.release().catch(() => {
      });
    }
  }

  private onUrlChanged(): void {
    this.load();
  }

  private async load(): Promise<void> {
    const generation: number = ++this.generation;
    this.failed = false;
    if (this.url === '') {
      this.pixelMap = undefined;
      return;
    }
    try {
      const bytes: ArrayBuffer = await ForumService.imageBytes(this.url);
      if (generation !== this.generation) return;
      const source: image.ImageSource = image.createImageSource(bytes);
      const decoded: image.PixelMap = await source.createPixelMap();
      source.release();
      if (generation !== this.generation) {
        decoded.release().catch(() => {
        });
        return;
      }
      const previous: image.PixelMap | undefined = this.pixelMap;
      this.pixelMap = decoded;
      if (previous !== undefined) {
        previous.release().catch(() => {
        });
      }
    } catch (error) {
      if (generation === this.generation) this.failed = true;
    }
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      if (this.pixelMap !== undefined) {
        Image(this.pixelMap).width('100%').height('100%').objectFit(ImageFit.Cover)
      } else if (this.failed) {
        Column({ space: 4 }) {
          Image($r('app.media.detail_info')).width(20).height(20)
          Text('图片加载失败，点击重试').fontSize(10).fontColor('#7B848B')
        }.onClick(() => {
          this.load();
        })
      } else {
        LoadingProgress().width(22).height(22).color($r('app.color.brand'))
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#E9EEF2')
    .borderRadius(this.cornerRadius)
    .clip(true)
  }
}

interface ForumFeedSnapshot {
  category: string;
  query: string;
  appliedQuery: string;
  posts: ForumPostView[];
  page: number;
  totalPages: number;
  errorText: string;
  initialized: boolean;
  retryAppend: boolean;
  offset: number;
}

/** 独立滚动的论坛信息流；隐藏频道时保留实例，查询与活动完全分离。 */
@Component
struct ForumFeed {
  @Prop @Watch('onRefreshVersionChanged') refreshVersion: number = 0;
  @Prop @Watch('onActiveChanged') active: boolean = true;
  @Link @Watch('onSearchModeChanged') searching: boolean;
  onOpen: (route: string, param: Object | null) => void = () => {};
  onLogin: () => void = () => {};
  onSessionExpired: () => void = () => {};
  @State category: string = '';
  @State query: string = '';
  @State appliedQuery: string = '';
  @State posts: ForumPostView[] = [];
  @State page: number = 1;
  @State totalPages: number = 0;
  @State loading: boolean = false;
  @State loadingMore: boolean = false;
  @State refreshing: boolean = false;
  @State errorText: string = '';
  private generation: number = 0;
  private suspended: boolean = false;
  private initialized: boolean = false;
  private refreshPending: boolean = false;
  private retryAppend: boolean = false;
  private snapshot: ForumFeedSnapshot | null = null;
  private snapshotNeedsRefresh: boolean = false;
  private scroller: ListScroller = new ListScroller();
  private restoreTimer: number = -1;
  private focusTimer: number = -1;
  private firstVisible: number = 0;

  aboutToAppear(): void {
    this.suspended = false;
    if (this.active && (!this.initialized || this.refreshPending)) this.load();
  }

  aboutToDisappear(): void {
    this.suspended = true;
    this.pause();
  }

  private pause(): void {
    if (this.loading || this.loadingMore) this.refreshPending = true;
    this.generation += 1;
    this.loading = false;
    this.loadingMore = false;
    this.refreshing = false;
    if (this.restoreTimer !== -1) clearTimeout(this.restoreTimer);
    this.restoreTimer = -1;
    if (this.focusTimer !== -1) clearTimeout(this.focusTimer);
    this.focusTimer = -1;
  }

  private onActiveChanged(): void {
    if (!this.active) this.pause();
    else if (!this.suspended && (!this.initialized || this.refreshPending)) this.load();
  }

  private onRefreshVersionChanged(): void {
    if (this.snapshot !== null) this.snapshotNeedsRefresh = true;
    this.refreshPending = true;
    // 详情覆盖期间只登记刷新，返回后重取已加载页，保留列表上下文。
    if (!this.suspended && this.active) this.load();
  }

  private onSearchModeChanged(): void {
    if (this.searching) {
      this.snapshotNeedsRefresh = false;
      this.snapshot = {
        category: this.category, query: this.query, appliedQuery: this.appliedQuery,
        posts: this.posts, page: this.page, totalPages: this.totalPages,
        errorText: this.errorText, initialized: this.initialized, retryAppend: this.retryAppend, offset: this.readOffset()
      };
    } else if (this.snapshot !== null) {
      const saved: ForumFeedSnapshot = this.snapshot;
      this.pause();
      this.category = saved.category;
      this.query = saved.query;
      this.appliedQuery = saved.appliedQuery;
      this.posts = saved.posts;
      this.page = saved.page;
      this.totalPages = saved.totalPages;
      this.errorText = saved.errorText;
      this.initialized = saved.initialized;
      this.retryAppend = saved.retryAppend;
      this.refreshPending = this.snapshotNeedsRefresh;
      this.snapshot = null;
      if (this.refreshPending && this.active && !this.suspended) this.load();
      else this.restoreOffset(saved.offset);
    }
  }

  private restoreOffset(offset: number): void {
    const generation: number = this.generation;
    if (this.restoreTimer !== -1) clearTimeout(this.restoreTimer);
    this.restoreTimer = setTimeout(() => {
      this.restoreTimer = -1;
      if (this.suspended || !this.active || generation !== this.generation) return;
      this.scroller.scrollTo({ xOffset: 0, yOffset: Math.max(0, offset) });
    }, 0);
  }

  private readOffset(): number {
    try { return this.scroller.currentOffset().yOffset; }
    catch (_error) { return 0; }
  }

  private readAnchorTop(): number {
    try { return this.scroller.getItemRect(this.firstVisible).y; }
    catch (_error) { return 0; }
  }

  private handleError(error: Object): void {
    if (error instanceof ApiRequestError) {
      if (isSessionExpiredCode(error.code)) {
        this.onSessionExpired();
        return;
      }
      this.errorText = error.code === 'NETWORK_ERROR' || error.code === 'REQUEST_TIMEOUT'
        ? '连接失败，请检查网络后重试' : error.message;
      return;
    }
    this.errorText = '论坛加载失败，请重试';
  }

  private mergedPosts(existing: ForumPostView[], incoming: ForumPostView[]): ForumPostView[] {
    const merged: ForumPostView[] = existing.slice();
    for (const item of incoming) {
      const index: number = merged.findIndex((post: ForumPostView) => post.id === item.id);
      if (index < 0) merged.push(item);
      else merged[index] = item;
    }
    return merged;
  }

  private async loadPage(targetPage: number, append: boolean): Promise<void> {
    if (this.suspended || !this.active) return;
    const generation: number = ++this.generation;
    const sentCategory: string = this.category;
    const sentQuery: string = this.appliedQuery;
    const pagesToRestore: number = append ? targetPage : Math.max(1, this.page);
    const anchorId: string = this.posts[this.firstVisible]?.id ?? '';
    const offset: number = this.readOffset();
    const anchorTop: number = this.posts.length > 0 ? this.readAnchorTop() : 0;
    this.loading = !append;
    this.loadingMore = append;
    this.retryAppend = append;
    this.errorText = '';
    try {
      let items: ForumPostView[] = [];
      let last: ApiPage<ForumPostView> | null = null;
      const firstPage: number = append ? targetPage : 1;
      for (let next: number = firstPage; next <= pagesToRestore; next += 1) {
        const result: ApiPage<ForumPostView> = await ForumService.listPosts(sentCategory, sentQuery, next);
        if (generation !== this.generation || this.suspended || !this.active) return;
        items = this.mergedPosts(items, result.items);
        last = result;
        if (next >= result.pagination.totalPages) break;
      }
      if (last === null) return;
      this.posts = append ? this.mergedPosts(this.posts, items) : items;
      this.page = last.pagination.page;
      this.totalPages = last.pagination.totalPages;
      this.initialized = true;
      this.refreshPending = false;
      if (!append && offset > 0 && anchorId !== '') {
        const index: number = this.posts.findIndex((post: ForumPostView) => post.id === anchorId);
        // 按原可见帖子定位；保留它在视口内的偏移，避免评论刷新回顶。
        this.restoreTimer = setTimeout(() => {
          this.restoreTimer = -1;
          if (this.suspended || !this.active || generation !== this.generation) return;
          if (index >= 0) this.scroller.scrollToIndex(index, false, ScrollAlign.START, { extraOffset: LengthMetrics.vp(-anchorTop) });
          else this.scroller.scrollTo({ xOffset: 0, yOffset: offset });
        }, 0);
      }
    } catch (error) {
      if (generation === this.generation && !this.suspended && this.active) this.handleError(error as Object);
    } finally {
      if (generation === this.generation) {
        this.loading = false;
        this.loadingMore = false;
        this.refreshing = false;
      }
    }
  }

  async load(): Promise<void> {
    return this.loadPage(1, false);
  }

  async loadMore(): Promise<void> {
    if (this.loading || this.loadingMore || this.page >= this.totalPages) return;
    return this.loadPage(this.page + 1, true);
  }

  private resetResults(): void {
    this.posts = [];
    this.page = 1;
    this.totalPages = 0;
    this.firstVisible = 0;
    this.scroller.scrollTo({ xOffset: 0, yOffset: 0 });
  }

  async search(): Promise<void> {
    this.query = this.query.trim().substring(0, 60);
    this.appliedQuery = this.query;
    this.resetResults();
    return this.load();
  }

  async clearSearch(): Promise<void> {
    this.query = '';
    return this.search();
  }

  async selectCategory(category: string): Promise<void> {
    if (this.category === category) return;
    this.category = category;
    this.resetResults();
    return this.load();
  }

  private retry(): void {
    if (this.loading || this.loadingMore) return;
    if (this.retryAppend) this.loadMore();
    else this.load();
  }

  private openPost(item: ForumPostView): void {
    const param: ForumPostParam = { postId: item.id };
    this.onOpen(ROUTE_FORUM_POST, param);
  }

  private postRenderKey(item: ForumPostView): string {
    return `${item.id}:${item.updatedAt}:${item.commentCount}`;
  }

  private focusSearch(): void {
    if (this.focusTimer !== -1) clearTimeout(this.focusTimer);
    // 等本次入口按钮的焦点事务结束，再把焦点交给已挂载的输入框。
    this.focusTimer = setTimeout(() => {
      this.focusTimer = -1;
      if (!this.searching || !this.active || this.suspended) return;
      try { this.getUIContext().getFocusController().requestFocus('forum-search-input'); }
      catch (_error) { /* 用户仍可点击输入框。 */ }
    }, 80);
  }

  @Builder
  searchBar() {
    Row({ space: 8 }) {
      Button({ type: ButtonType.Normal }) {
        Image($r('app.media.detail_back')).width(22).height(22)
      }.width(40).height(44).backgroundColor(Color.Transparent).accessibilityText('返回论坛')
        .onClick(() => { this.searching = false; })
      Row({ space: 8 }) {
        Image($r('app.media.home_search')).width(18).height(18)
        TextInput({ text: $$this.query, placeholder: '搜索论坛帖子' }).layoutWeight(1).height(40)
          .id('forum-search-input').fontSize(15).backgroundColor(Color.Transparent).padding(0).maxLength(60)
          .enableKeyboardOnFocus(true)
          .onAppear(() => { this.focusSearch(); })
          .enterKeyType(EnterKeyType.Search).onSubmit(() => { this.search(); })
        if (this.query !== '') {
          Button({ type: ButtonType.Normal }) {
            Image($r('app.media.detail_close')).width(16).height(16)
          }.width(32).height(40).backgroundColor(Color.Transparent).accessibilityText('清空论坛搜索')
            .onClick(() => { this.clearSearch(); })
        }
      }.layoutWeight(1).height(40).padding({ left: 12, right: 4 }).backgroundColor(FORUM_BACKGROUND).borderRadius(8)
      Button('搜索').height(44).fontSize(14).fontWeight(FontWeight.Medium).fontColor(FORUM_INK)
        .backgroundColor(Color.Transparent).padding({ left: 8, right: 8 }).onClick(() => { this.search(); })
    }.height(56).width('100%').padding({ left: 8, right: 8 }).backgroundColor(FORUM_SURFACE)
  }

  @Builder
  categoryBar() {
    Row() {
      ForEach(['', FORUM_CATEGORY_GENERAL, FORUM_CATEGORY_EXPERIENCE, FORUM_CATEGORY_QUESTION], (name: string) => {
        Button({ type: ButtonType.Normal }) {
          Column({ space: 6 }) {
            Text(name === '' ? '全部' : forumCategoryLabel(name)).fontSize(14)
              .fontColor(this.category === name ? FORUM_INK : FORUM_SECONDARY)
              .fontWeight(this.category === name ? FontWeight.Bold : FontWeight.Regular).maxLines(1)
            Rect().width(16).height(3).radius(2).fill(this.category === name ? FORUM_ACCENT : Color.Transparent)
          }.justifyContent(FlexAlign.Center).width('100%').height(44)
        }.width('25%').height(44).backgroundColor(Color.Transparent).borderRadius(0)
          .accessibilityText(`${name === '' ? '全部' : forumCategoryLabel(name)}${this.category === name ? '，已选中' : ''}`)
          .onClick(() => { this.selectCategory(name); })
      })
    }.width('100%').padding({ left: 12, right: 12 }).backgroundColor(FORUM_SURFACE)
  }

  @Builder
  postCard(item: ForumPostView) {
    Column({ space: 10 }) {
      Row({ space: 8 }) {
        Image($r('app.media.forum_avatar')).width(26).height(26).accessibilityText('默认头像')
        Text(item.author.displayName).fontSize(13).fontColor(FORUM_SECONDARY).maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis }).layoutWeight(1)
        Text(forumTimeText(item.createdAt)).fontSize(11).fontColor(FORUM_MUTED)
      }.width('100%')
      Text(item.title).fontSize(18).fontWeight(FontWeight.Bold).fontColor(FORUM_INK).lineHeight(25)
        .width('100%').maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis })
      if (item.body.trim() !== item.title.trim()) {
        Text(item.body).fontSize(14).fontColor(FORUM_SECONDARY).lineHeight(21).maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis }).width('100%')
      }
      if (item.images.length === 1) {
        ForumPostImage({ url: item.images[0].url, cornerRadius: 8 }).width('100%').height(180)
      } else if (item.images.length > 1) {
        Row({ space: 6 }) {
          ForEach(item.images.slice(0, 3), (forumImage: ForumImageView, index: number) => {
            Stack({ alignContent: Alignment.BottomEnd }) {
              ForumPostImage({ url: forumImage.url, cornerRadius: 8 })
              if (index === 2 && item.images.length > 3) {
                Text(`共 ${item.images.length} 张`).fontSize(11).fontColor(Color.White)
                  .padding({ left: 6, right: 6, top: 3, bottom: 3 }).backgroundColor('#99000000').borderRadius(4).margin(5)
              }
            }.layoutWeight(1).height(item.images.length === 2 ? 150 : 104)
          }, (forumImage: ForumImageView) => forumImage.id)
        }.width('100%')
      }
      Row() {
        Text(`# ${forumCategoryLabel(item.category)}`).fontSize(12).fontColor(FORUM_MUTED).layoutWeight(1)
        Image($r('app.media.forum_comment')).width(16).height(16).margin({ right: 5 })
        Text(item.commentCount === 0 ? '参与讨论' : `${item.commentCount} 条评论`).fontSize(12).fontColor(FORUM_MUTED)
      }.width('100%').margin({ top: 2 })
    }.width('100%').padding(16).backgroundColor(FORUM_SURFACE).alignItems(HorizontalAlign.Start)
      .accessibilityText(`${item.author.displayName}，${item.title}，${item.commentCount} 条评论`)
      .onClick(() => { this.openPost(item); })
  }

  @Builder
  skeleton() {
    Column({ space: 16 }) {
      ForEach([0, 1, 2], (_index: number) => {
        Column({ space: 12 }) {
          Row({ space: 8 }) {
            Circle().width(26).height(26).fill(FORUM_LINE)
            Rect().width(84).height(12).radius(3).fill(FORUM_LINE)
          }.width('100%')
          Rect().width('86%').height(18).radius(3).fill(FORUM_LINE)
          Rect().width('100%').height(12).radius(3).fill(FORUM_BACKGROUND)
          Rect().width('68%').height(12).radius(3).fill(FORUM_BACKGROUND)
        }.padding(16).width('100%').backgroundColor(FORUM_SURFACE).alignItems(HorizontalAlign.Start)
      })
    }.width('100%').accessibilityText('正在加载论坛帖子')
  }

  @Builder
  emptyState() {
    Column({ space: 12 }) {
      Image($r('app.media.forum_comment')).width(36).height(36)
      Text(this.errorText !== '' ? '暂时无法加载帖子' : (this.appliedQuery !== '' ? '没有找到相关帖子' : '这里还没有帖子'))
        .fontSize(16).fontWeight(FontWeight.Medium).fontColor(FORUM_INK)
      Text(this.errorText !== '' ? this.errorText : (this.appliedQuery !== '' ? '换个关键词，或清空搜索再看看' : '来分享第一条经验，或提出你的问题'))
        .fontSize(13).fontColor(FORUM_SECONDARY).textAlign(TextAlign.Center).lineHeight(20)
      Button(this.errorText !== '' ? '重新加载' : (this.appliedQuery !== '' ? '清空搜索' : '发布帖子'))
        .height(36).fontSize(13).fontColor(FORUM_INK).backgroundColor(FORUM_ACCENT).borderRadius(8)
        .padding({ left: 20, right: 20 }).margin({ top: 4 }).onClick(() => {
          if (this.errorText !== '') this.retry();
          else if (this.appliedQuery !== '') this.clearSearch();
          else this.onLogin();
        })
    }.width('100%').padding({ left: 24, right: 24, top: 64, bottom: 64 })
  }

  @Builder
  footer() {
    Column({ space: 8 }) {
      if (this.errorText !== '') {
        Text(this.errorText).fontSize(12).fontColor(FORUM_SECONDARY).textAlign(TextAlign.Center)
        Button('重试').fontSize(13).height(36).fontColor(FORUM_INK).backgroundColor(FORUM_SURFACE)
          .borderRadius(8).onClick(() => { this.retry(); })
      } else if (this.loading || this.loadingMore) {
        Row({ space: 8 }) {
          LoadingProgress().width(18).height(18).color(FORUM_MUTED)
          Text(this.loadingMore ? '加载更多帖子' : '正在更新').fontSize(12).fontColor(FORUM_MUTED)
        }
      } else if (this.page < this.totalPages) {
        Button('加载更多').height(36).fontSize(13).fontColor(FORUM_SECONDARY).backgroundColor(Color.Transparent)
          .onClick(() => { this.loadMore(); })
      } else {
        Text('已经到底了').fontSize(12).fontColor(FORUM_MUTED)
      }
    }.width('100%').padding(20)
  }

  build() {
    Column() {
      if (this.searching) { this.searchBar() }
      this.categoryBar()
      Divider().color(FORUM_LINE).strokeWidth(0.5)
      Refresh({ refreshing: $$this.refreshing }) {
        List({ space: 8, scroller: this.scroller }) {
          if (this.posts.length === 0) {
            ListItem() {
              if (this.loading) { this.skeleton() }
              else { this.emptyState() }
            }
          } else {
            ForEach(this.posts, (item: ForumPostView) => {
              ListItem() { this.postCard(item) }
            }, (item: ForumPostView) => this.postRenderKey(item))
            ListItem() { this.footer() }
          }
        }.width('100%').height('100%').scrollBar(BarState.Off)
          .padding({ bottom: 104 }).edgeEffect(EdgeEffect.Spring)
          .onScrollIndex((start: number) => { this.firstVisible = start; })
          .onReachEnd(() => { if (this.errorText === '' && this.active) this.loadMore(); })
      }.layoutWeight(1).width('100%')
        .onRefreshing(() => { this.load(); })
    }.width('100%').height('100%').backgroundColor(FORUM_BACKGROUND)
  }
}

export { ForumFeed, ForumPostImage };
