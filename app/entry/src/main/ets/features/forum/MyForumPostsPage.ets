import { ApiRequestError, isSessionExpiredCode } from '../../core/network/ApiClient';
import { ApiPage } from '../../core/network/ApiContract';
import { ErrorPanel, LoadingPanel } from '../../core/ui/StatePanel';
import { ROUTE_FORUM_COMPOSE, ROUTE_FORUM_POST } from '../../core/ui/Routes';
import { ForumImageView, ForumPostParam, ForumPostView, forumCategoryLabel } from './ForumContract';
import { ForumService } from './ForumService';
import { ForumPostImage } from './ForumFeed';
import { FORUM_ACCENT, FORUM_BACKGROUND, FORUM_INK, FORUM_MUTED, FORUM_SECONDARY, FORUM_SURFACE } from './ForumTheme';

function mineTimeText(value: string): string {
  const time: Date = new Date(new Date(value).getTime() + 8 * 3600000);
  return `${time.getUTCFullYear()}-${(time.getUTCMonth() + 1).toString().padStart(2, '0')}-${time.getUTCDate().toString().padStart(2, '0')} ${time.getUTCHours().toString().padStart(2, '0')}:${time.getUTCMinutes().toString().padStart(2, '0')}`;
}

/** 本人帖子：作者范围只由服务端会话确定，不传 authorId。 */
@Component
export struct MyForumPostsPage {
  onBack: () => void = () => {};
  @Prop @Watch('onRefreshChanged') refreshVersion: number = 0;
  onOpen: (route: string, param: Object | null) => void = () => {};
  onSessionExpired: () => void = () => {};
  @State posts: ForumPostView[] = [];
  @State page: number = 1;
  @State totalPages: number = 0;
  @State loading: boolean = false;
  @State errorText: string = '';
  private generation: number = 0;
  private retryPage: number = 1;
  private retryAppend: boolean = false;
  private scroller: Scroller = new Scroller();
  private restoreTimer: number = -1;

  aboutToAppear(): void {
    this.load();
  }

  aboutToDisappear(): void {
    this.generation += 1;
    if (this.restoreTimer !== -1) clearTimeout(this.restoreTimer);
  }

  private onRefreshChanged(): void {
    this.load();
  }

  private handleError(error: Object): void {
    const apiError = error as ApiRequestError;
    if (isSessionExpiredCode(apiError.code)) {
      this.onSessionExpired();
      return;
    }
    this.errorText = apiError.message === undefined ? '我的帖子加载失败，请重试' : apiError.message;
  }

  private async loadPage(targetPage: number, append: boolean): Promise<void> {
    const generation: number = ++this.generation;
    this.retryPage = targetPage;
    this.retryAppend = append;
    this.loading = true;
    this.errorText = '';
    try {
      const result: ApiPage<ForumPostView> = await ForumService.listMine(targetPage);
      if (generation !== this.generation) return;
      this.posts = append ? this.posts.concat(result.items) : result.items;
      this.page = result.pagination.page;
      this.totalPages = result.pagination.totalPages;
    } catch (error) {
      if (generation !== this.generation) return;
      this.handleError(error as Object);
    } finally {
      if (generation === this.generation) this.loading = false;
    }
  }

  async load(): Promise<void> {
    const generation: number = ++this.generation;
    const lastPage: number = Math.max(1, this.page);
    const hadContent: boolean = this.posts.length > 0;
    let previousOffset: number = 0;
    if (hadContent) {
      try { previousOffset = this.scroller.currentOffset().yOffset; } catch (_) { /* 内容尚未挂载时从顶部刷新。 */ }
    }
    if (this.restoreTimer !== -1) clearTimeout(this.restoreTimer);
    this.restoreTimer = -1;
    this.retryPage = 1;
    this.retryAppend = false;
    this.loading = true;
    this.errorText = '';
    try {
      const refreshed: ForumPostView[] = [];
      const seen: Set<string> = new Set();
      let finalPage: number = 1;
      let finalTotalPages: number = 0;
      for (let target: number = 1; target <= lastPage; target += 1) {
        const result: ApiPage<ForumPostView> = await ForumService.listMine(target);
        if (generation !== this.generation) return;
        for (const item of result.items) {
          if (!seen.has(item.id)) { seen.add(item.id); refreshed.push(item); }
        }
        finalPage = result.pagination.page;
        finalTotalPages = result.pagination.totalPages;
        if (target >= finalTotalPages) break;
      }
      this.posts = refreshed;
      this.page = finalPage;
      this.totalPages = finalTotalPages;
      if (hadContent) {
        this.restoreTimer = setTimeout(() => {
          this.restoreTimer = -1;
          if (generation === this.generation) this.scroller.scrollTo({ xOffset: 0, yOffset: previousOffset });
        }, 0);
      }
    } catch (error) {
      if (generation === this.generation) this.handleError(error as Object);
    } finally {
      if (generation === this.generation) this.loading = false;
    }
  }

  async loadMore(): Promise<void> {
    if (this.loading || this.page >= this.totalPages) return;
    return this.loadPage(this.page + 1, true);
  }

  retry(): void {
    if (this.retryAppend) this.loadPage(this.retryPage, true);
    else this.load();
  }

  private openPost(item: ForumPostView): void {
    const param: ForumPostParam = { postId: item.id };
    this.onOpen(ROUTE_FORUM_POST, param);
  }

  @Builder
  mineCard(item: ForumPostView) {
    Column({ space: 10 }) {
      Row({ space: 8 }) {
        Image($r('app.media.forum_avatar')).width(26).height(26).accessibilityText('默认头像')
        Text(item.author.displayName).fontSize(13).fontColor(FORUM_SECONDARY).layoutWeight(1)
        Text(mineTimeText(item.createdAt)).fontSize(11).fontColor(FORUM_MUTED)
      }.width('100%')
      Text(item.title).fontSize(18).fontWeight(FontWeight.Bold).fontColor(FORUM_INK).lineHeight(25)
        .width('100%').maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis })
      if (item.body.trim() !== item.title.trim()) {
        Text(item.body).fontSize(14).fontColor(FORUM_SECONDARY).lineHeight(21).maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis }).width('100%')
      }
      if (item.images.length === 1) {
        ForumPostImage({ url: item.images[0].url, cornerRadius: 8,
          onOpen: (): void => { this.openPost(item); } }).width('100%').height(180)
      } else if (item.images.length > 1) {
        Row({ space: 6 }) {
          ForEach(item.images.slice(0, 3), (forumImage: ForumImageView) => {
            ForumPostImage({ url: forumImage.url, cornerRadius: 8,
              onOpen: (): void => { this.openPost(item); } }).layoutWeight(1).height(104)
          }, (forumImage: ForumImageView) => forumImage.id)
        }.width('100%')
      }
      Row() {
        Text(`# ${forumCategoryLabel(item.category)}`).fontSize(12).fontColor(FORUM_MUTED).layoutWeight(1)
        Image($r('app.media.forum_comment')).width(16).height(16).margin({ right: 5 })
        Text(item.commentCount === 0 ? '参与讨论' : `${item.commentCount} 条评论`).fontSize(12).fontColor(FORUM_MUTED)
      }.width('100%').margin({ top: 2 })
    }.width('100%').padding(16).backgroundColor(FORUM_SURFACE).alignItems(HorizontalAlign.Start)
      .accessibilityText(`${item.title}，${item.commentCount} 条评论`).onClick(() => { this.openPost(item); })
  }

  @Builder
  mineHeader() {
    Row() {
      Button({ type: ButtonType.Normal }) {
        Image($r('app.media.detail_back')).width(22).height(22)
      }.width(44).height(48).padding(0).backgroundColor(Color.Transparent).accessibilityText('返回').onClick(this.onBack)
      Text('我的帖子').fontSize(19).fontWeight(FontWeight.Bold).fontColor(FORUM_INK).layoutWeight(1)
      Button({ type: ButtonType.Normal }) {
        Image($r('app.media.detail_refresh')).width(21).height(21)
      }.width(44).height(48).padding(0).backgroundColor(Color.Transparent)
        .accessibilityText('刷新我的帖子').onClick(() => { this.load(); })
    }.width('100%').height(56).padding({ left: 8, right: 8 }).backgroundColor(FORUM_SURFACE)
  }

  build() {
    Column() {
      this.mineHeader()
      if (this.loading && this.posts.length === 0) {
        LoadingPanel({ text: '正在加载我的帖子…' }).layoutWeight(1)
      } else if (this.errorText !== '' && this.posts.length === 0) {
        ErrorPanel({ message: this.errorText, onRetry: (): void => { this.retry(); } }).layoutWeight(1)
      } else if (this.posts.length === 0) {
        Column({ space: 12 }) {
          Image($r('app.media.forum_comment')).width(36).height(36)
          Text('还没有发布帖子').fontSize(17).fontWeight(FontWeight.Medium).fontColor(FORUM_INK)
          Text('分享你的经验，或向大家提问。').fontSize(13).fontColor(FORUM_MUTED)
          Button('发布帖子').height(40).backgroundColor(FORUM_ACCENT).fontColor(FORUM_INK)
            .onClick(() => { this.onOpen(ROUTE_FORUM_COMPOSE, null); })
        }.width('100%').layoutWeight(1).justifyContent(FlexAlign.Center)
      } else {
        Scroll(this.scroller) {
          Column({ space: 8 }) {
            ForEach(this.posts, (item: ForumPostView) => {
              this.mineCard(item);
            }, (item: ForumPostView) => `${item.id}:${item.updatedAt}:${item.commentCount}`)
            if (this.errorText !== '') {
              ErrorPanel({ message: this.errorText, onRetry: (): void => { this.retry(); } })
            }
            if (this.page < this.totalPages) {
              Button(this.loading ? '加载中…' : '加载更多').enabled(!this.loading).onClick(() => { this.loadMore(); })
            } else {
              Text('已显示全部本人帖子').fontSize(12).fontColor(FORUM_MUTED).textAlign(TextAlign.Center)
                .width('100%').padding({ top: 12, bottom: 16 })
            }
          }.width('100%').padding({ bottom: 24 })
        }.width('100%').layoutWeight(1).scrollBar(BarState.Off).align(Alignment.Top)
      }
    }.width('100%').height('100%').backgroundColor(FORUM_BACKGROUND)
  }
}
