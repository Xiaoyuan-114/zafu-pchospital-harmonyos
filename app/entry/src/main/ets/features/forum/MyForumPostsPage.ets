import { ApiRequestError, isSessionExpiredCode } from '../../core/network/ApiClient';
import { ApiPage } from '../../core/network/ApiContract';
import { DetailHeader } from '../../core/ui/ReferenceDetail';
import { ErrorPanel, LoadingPanel } from '../../core/ui/StatePanel';
import { ROUTE_FORUM_POST } from '../../core/ui/Routes';
import { ForumPostParam, ForumPostView, forumCategoryLabel } from './ForumContract';
import { ForumService } from './ForumService';

/** 本人帖子：作者范围只由服务端会话确定，不传 authorId。 */
@Component
export struct MyForumPostsPage {
  @Prop @Watch('onRefreshChanged') refreshVersion: number = 0;
  onOpen: (route: string, param: Object | null) => void = () => {};
  onSessionExpired: () => void = () => {};
  @State posts: ForumPostView[] = [];
  @State page: number = 1;
  @State totalPages: number = 0;
  @State loading: boolean = false;
  @State errorText: string = '';
  private generation: number = 0;

  aboutToAppear(): void {
    this.load();
  }

  aboutToDisappear(): void {
    this.generation += 1;
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
    return this.loadPage(1, false);
  }

  async loadMore(): Promise<void> {
    if (this.loading || this.page >= this.totalPages) return;
    return this.loadPage(this.page + 1, true);
  }

  private openPost(item: ForumPostView): void {
    const param: ForumPostParam = { postId: item.id };
    this.onOpen(ROUTE_FORUM_POST, param);
  }

  @Builder
  mineCard(item: ForumPostView) {
    Column({ space: 10 }) {
      Row({ space: 10 }) {
        Text(forumCategoryLabel(item.category)).fontSize(12).fontColor('#376D9C').layoutWeight(1)
        Text(`${item.commentCount} 条评论`).fontSize(12).fontColor('#77838B')
      }.width('100%')
      Text(item.title).fontSize(18).fontWeight(FontWeight.Bold).width('100%')
      Text(item.body).fontSize(14).fontColor('#5C6870').maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis }).width('100%')
      Text('查看详情 ›').fontSize(13).fontColor('#2474D4').width('100%').textAlign(TextAlign.End)
    }.width('100%').padding(16).backgroundColor(Color.White).borderRadius(20).alignItems(HorizontalAlign.Start)
      .onClick(() => {
        this.openPost(item);
      })
  }

  build() {
    Column() {
      DetailHeader({ title: '我的帖子', onBack: () => {}, refresh: true, onRefresh: () => {
        this.load();
      } })
      if (this.loading && this.posts.length === 0) {
        LoadingPanel({ text: '正在加载我的帖子…' }).layoutWeight(1)
      } else if (this.errorText !== '' && this.posts.length === 0) {
        ErrorPanel({ message: this.errorText, onRetry: (): void => { this.load(); } }).layoutWeight(1)
      } else if (this.posts.length === 0) {
        Column({ space: 12 }) {
          Image($r('app.media.ref_document')).width(48).height(48)
          Text('你还没有发布帖子').fontSize(17)
          Text('可以从活动页的论坛频道发布真实内容。').fontSize(13).fontColor('#78848C')
        }.layoutWeight(1).justifyContent(FlexAlign.Center)
      } else {
        Scroll() {
          Column({ space: 14 }) {
            ForEach(this.posts, (item: ForumPostView) => {
              this.mineCard(item);
            }, (item: ForumPostView) => item.id)
            if (this.errorText !== '') {
              ErrorPanel({ message: this.errorText, onRetry: (): void => { this.loadMore(); } })
            }
            if (this.page < this.totalPages) {
              Button(this.loading ? '加载中…' : '加载更多').enabled(!this.loading).onClick(() => {
                this.loadMore();
              })
            } else {
              Text('已显示全部本人帖子').fontSize(12).fontColor('#89939A').textAlign(TextAlign.Center).width('100%')
            }
          }.width('100%').padding({ left: 16, right: 16, bottom: 24 })
        }.width('100%').layoutWeight(1).scrollBar(BarState.Off).align(Alignment.Top)
      }
    }.width('100%').height('100%').backgroundColor('#F1F6F9')
  }
}
