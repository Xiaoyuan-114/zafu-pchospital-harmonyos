import { image } from '@kit.ImageKit';
import { ApiRequestError, isSessionExpiredCode } from '../../core/network/ApiClient';
import { ApiPage } from '../../core/network/ApiContract';
import { ErrorPanel, LoadingPanel } from '../../core/ui/StatePanel';
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
    .borderRadius(12)
    .clip(true)
  }
}

/** 活动 Tab 内的真实论坛信息流；查询、分页与活动数据完全分离。 */
@Component
struct ForumFeed {
  @Prop @Watch('onRefreshVersionChanged') refreshVersion: number = 0;
  onOpen: (route: string, param: Object | null) => void = () => {};
  onLogin: () => void = () => {};
  onSessionExpired: () => void = () => {};
  @State category: string = FORUM_CATEGORY_GENERAL;
  @State query: string = '';
  @State posts: ForumPostView[] = [];
  @State page: number = 1;
  @State totalPages: number = 0;
  @State loading: boolean = false;
  @State loadingMore: boolean = false;
  @State errorText: string = '';
  private generation: number = 0;

  aboutToAppear(): void {
    this.load();
  }

  aboutToDisappear(): void {
    this.generation += 1;
  }

  private onRefreshVersionChanged(): void {
    this.load();
  }

  private handleError(error: Object): void {
    if (error instanceof ApiRequestError) {
      if (isSessionExpiredCode(error.code)) {
        this.onSessionExpired();
        return;
      }
      this.errorText = error.message;
      return;
    }
    this.errorText = '论坛加载失败，请重试';
  }

  private async loadPage(targetPage: number, append: boolean): Promise<void> {
    const generation: number = ++this.generation;
    const sentCategory: string = this.category;
    const sentQuery: string = this.query.trim().substring(0, 60);
    if (append) this.loadingMore = true;
    else this.loading = true;
    this.errorText = '';
    try {
      const result: ApiPage<ForumPostView> = await ForumService.listPosts(sentCategory, sentQuery, targetPage);
      if (generation !== this.generation) return;
      this.posts = append ? this.posts.concat(result.items) : result.items;
      this.page = result.pagination.page;
      this.totalPages = result.pagination.totalPages;
    } catch (error) {
      if (generation !== this.generation) return;
      this.handleError(error as Object);
    } finally {
      if (generation === this.generation) {
        this.loading = false;
        this.loadingMore = false;
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

  async search(): Promise<void> {
    this.query = this.query.trim().substring(0, 60);
    return this.load();
  }

  async clearSearch(): Promise<void> {
    this.query = '';
    return this.load();
  }

  async selectCategory(category: string): Promise<void> {
    this.category = category;
    return this.load();
  }

  private retry(): void {
    if (this.loadingMore || (this.errorText !== '' && this.posts.length > 0 && this.page < this.totalPages)) {
      this.loadMore();
    } else {
      this.load();
    }
  }

  private openPost(item: ForumPostView): void {
    const param: ForumPostParam = { postId: item.id };
    this.onOpen(ROUTE_FORUM_POST, param);
  }

  @Builder
  postCard(item: ForumPostView) {
    Column({ space: 12 }) {
      Row({ space: 8 }) {
        Text(forumCategoryLabel(item.category))
          .fontSize(11)
          .fontColor('#496B8C')
          .padding({ left: 8, right: 8, top: 4, bottom: 4 })
          .backgroundColor('#EDF4FA')
          .borderRadius(10)
        Text(item.author.displayName).fontSize(12).fontColor('#69747C').layoutWeight(1)
        Text(forumTimeText(item.createdAt)).fontSize(10).fontColor('#8A9399')
      }.width('100%')
      Text(item.title).fontSize(18).fontWeight(FontWeight.Bold).fontColor('#151A1D').width('100%')
      Text(item.body)
        .fontSize(14)
        .fontColor('#515B62')
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .width('100%')
      if (item.images.length > 0) {
        Row({ space: 8 }) {
          ForEach(item.images.slice(0, 3), (forumImage: ForumImageView) => {
            ForumPostImage({ url: forumImage.url }).layoutWeight(1).height(104)
          }, (forumImage: ForumImageView) => forumImage.id)
        }.width('100%')
      }
      Row() {
        Text(`${item.commentCount} 条评论`).fontSize(12).fontColor('#707A81').layoutWeight(1)
        Text('查看详情 ›').fontSize(12).fontColor('#2474D4')
      }.width('100%')
    }
    .width('100%')
    .padding(16)
    .backgroundColor(Color.White)
    .borderRadius(20)
    .alignItems(HorizontalAlign.Start)
    .onClick(() => {
      this.openPost(item);
    })
  }

  build() {
    Column({ space: 14 }) {
      Row({ space: 10 }) {
        Text('校园论坛').fontSize(24).fontWeight(FontWeight.Bold).layoutWeight(1)
        Button('发布帖子')
          .fontSize(13)
          .height(34)
          .fontColor('#176DCB')
          .backgroundColor('#E6F0FB')
          .onClick(() => {
            this.onLogin();
          })
      }.width('100%')

      Row({ space: 8 }) {
        ForEach([FORUM_CATEGORY_GENERAL, FORUM_CATEGORY_EXPERIENCE, FORUM_CATEGORY_QUESTION], (name: string) => {
          Text(forumCategoryLabel(name))
            .fontSize(14)
            .fontWeight(this.category === name ? FontWeight.Bold : FontWeight.Regular)
            .fontColor(this.category === name ? '#176DCB' : '#67727A')
            .padding({ left: 12, right: 12, top: 7, bottom: 7 })
            .backgroundColor(this.category === name ? '#E2EEFB' : '#F7F9FA')
            .borderRadius(18)
            .onClick(() => {
              this.selectCategory(name);
            })
        })
      }.width('100%')

      Row({ space: 8 }) {
        Image($r('app.media.home_search')).width(17).height(17)
        TextInput({ text: $$this.query, placeholder: '搜索论坛帖子（最多 60 字）' })
          .fontSize(15)
          .height(40)
          .layoutWeight(1)
          .backgroundColor(Color.Transparent)
          .padding(0)
          .maxLength(60)
          .onSubmit(() => {
            this.search();
          })
        if (this.query !== '') {
          Button('清空').fontSize(12).height(32).backgroundColor('#E8EDF1').fontColor('#52616C')
            .onClick(() => {
              this.clearSearch();
            })
        }
        Button('搜索').fontSize(12).height(32).backgroundColor('#2474D4').fontColor(Color.White)
          .onClick(() => {
            this.search();
          })
      }
      .height(46)
      .width('100%')
      .padding({ left: 12, right: 8 })
      .backgroundColor(Color.White)
      .borderRadius(24)

      if (this.loading && this.posts.length === 0) {
        LoadingPanel({ text: '正在加载论坛帖子…' })
      } else if (this.errorText !== '' && this.posts.length === 0) {
        ErrorPanel({ message: this.errorText, onRetry: (): void => this.retry() })
      } else if (this.posts.length === 0) {
        Column({ space: 10 }) {
          Image($r('app.media.ref_document')).width(42).height(42)
          Text(this.query.trim() === '' ? '这个分类还没有帖子' : '没有匹配的论坛帖子').fontSize(16)
          Text(this.query.trim() === '' ? '发布后可以在这里看到真实内容' : '试试清空搜索或切换分类')
            .fontSize(12)
            .fontColor('#7B848B')
          Button('刷新论坛').fontSize(13).onClick(() => {
            this.load();
          })
        }.width('100%').padding(26).backgroundColor(Color.White).borderRadius(20)
      } else {
        ForEach(this.posts, (item: ForumPostView) => {
          this.postCard(item);
        }, (item: ForumPostView) => item.id)
        if (this.errorText !== '') {
          ErrorPanel({ message: this.errorText, onRetry: (): void => this.retry() })
        }
        if (this.loadingMore) {
          LoadingPanel({ text: '正在加载更多帖子…' })
        } else if (this.page < this.totalPages) {
          Button('加载更多').width('100%').fontSize(14).backgroundColor('#E4EDF7').fontColor('#246BBD')
            .onClick(() => {
              this.loadMore();
            })
        } else {
          Text('已显示当前查询的全部帖子').fontSize(12).fontColor('#8A9399').textAlign(TextAlign.Center).width('100%')
        }
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

export { ForumFeed, ForumPostImage };
