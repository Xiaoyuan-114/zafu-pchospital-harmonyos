import { ApiRequestError, isSessionExpiredCode } from '../../core/network/ApiClient';
import { KeyboardAvoidMode } from '@kit.ArkUI';
import { ApiPage } from '../../core/network/ApiContract';
import { SessionService } from '../../core/auth/SessionService';
import { ErrorPanel, LoadingPanel } from '../../core/ui/StatePanel';
import { ForumCommentView, ForumImageView, ForumPostParam, ForumPostView, forumCategoryLabel } from './ForumContract';
import { ForumService } from './ForumService';
import { ForumPostImage } from './ForumFeed';
import { FORUM_ACCENT, FORUM_BACKGROUND, FORUM_INK, FORUM_MUTED, FORUM_SECONDARY, FORUM_SURFACE } from './ForumTheme';

function detailTimeText(value: string): string {
  const time: Date = new Date(new Date(value).getTime() + 8 * 3600000);
  return `${time.getUTCFullYear()}-${(time.getUTCMonth() + 1).toString().padStart(2, '0')}-${time.getUTCDate().toString().padStart(2, '0')} ${time.getUTCHours().toString().padStart(2, '0')}:${time.getUTCMinutes().toString().padStart(2, '0')}`;
}

/** 公开帖子详情；写操作以页面生命周期和会话代次丢弃迟到回调。 */
@Component
export struct ForumPostDetailPage {
  @Prop param: ForumPostParam = { postId: '' };
  @Prop @Watch('onAuthenticationChanged') authenticated: boolean = false;
  @Prop refreshVersion: number = 0;
  @Link imagePreviewIndex: number;
  onBack: () => void = () => {};
  onLogin: () => void = () => {};
  onChanged: () => void = () => {};
  onSessionExpired: () => void = () => {};
  @State detail: ForumPostView | null = null;
  @State comments: ForumCommentView[] = [];
  @State commentDraft: string = '';
  @State commentSending: boolean = false;
  @State commentError: string = '';
  @State commentPage: number = 1;
  @State commentTotalPages: number = 0;
  @State commentsLoading: boolean = false;
  @State commentsError: string = '';
  @State loading: boolean = false;
  @State errorText: string = '';
  @State deletePostOpen: boolean = false;
  @State deleteCommentId: string = '';
  @State deleteBusy: boolean = false;
  @State deleteError: string = '';
  @State imageScale: number = 1;
  @State imageOffsetX: number = 0;
  @State imageOffsetY: number = 0;
  @State postContentHeight: number = 0;
  private detailScroller: Scroller = new Scroller();
  private imagePanBaseX: number = 0;
  private imagePanBaseY: number = 0;
  private commentFocusDone: boolean = false;
  private commentFocusTimer: number = -1;
  disposed: boolean = false;
  navigated: boolean = false;
  private generation: number = 0;
  private commentGeneration: number = 0;
  private commentRequestKey: string = '';
  private commentRetryBody: string = '';
  private keyboardModeChanged: boolean = false;
  private previousKeyboardMode: KeyboardAvoidMode = 0;

  aboutToAppear(): void {
    this.imagePreviewIndex = -1;
    this.load();
    this.loadComments(1, false);
  }

  aboutToDisappear(): void {
    if (this.commentFocusTimer !== -1) clearTimeout(this.commentFocusTimer);
    this.restoreKeyboardMode();
    this.disposed = true;
    this.generation += 1;
    this.commentGeneration += 1;
  }

  private onAuthenticationChanged(): void {
    if (!this.disposed && this.detail !== null) {
      this.load();
      this.loadComments(1, false);
    }
  }

  private resizeForKeyboard(): void {
    if (this.keyboardModeChanged) return;
    const context = this.getUIContext();
    this.previousKeyboardMode = context.getKeyboardAvoidMode();
    context.setKeyboardAvoidMode(KeyboardAvoidMode.RESIZE);
    this.keyboardModeChanged = true;
  }

  private restoreKeyboardMode(): void {
    if (!this.keyboardModeChanged) return;
    this.getUIContext().setKeyboardAvoidMode(this.previousKeyboardMode);
    this.keyboardModeChanged = false;
  }

  private resetImageZoom(): void {
    this.imageScale = 1;
    this.imageOffsetX = 0;
    this.imageOffsetY = 0;
    this.imagePanBaseX = 0;
    this.imagePanBaseY = 0;
  }

  private panImage(x: number, y: number): void {
    this.imageOffsetX = Math.max(-180, Math.min(180, this.imagePanBaseX + x));
    this.imageOffsetY = Math.max(-280, Math.min(280, this.imagePanBaseY + y));
  }

  private showComments(): void {
    this.getUIContext().getFocusController().clearFocus();
    this.detailScroller.scrollTo({ xOffset: 0, yOffset: this.postContentHeight + 8 });
  }

  private onPostAreaChanged(newArea: Area): void {
    this.postContentHeight = Number(newArea.height);
    this.scheduleCommentFocus();
  }

  private scheduleCommentFocus(): void {
    if (!this.param.focusComments || this.commentFocusDone || this.commentFocusTimer !== -1 ||
      this.commentsLoading || this.postContentHeight <= 0 || this.detail === null) return;
    this.commentFocusTimer = setTimeout(() => {
      this.commentFocusTimer = -1;
      if (this.disposed || this.detail === null) return;
      this.commentFocusDone = true;
      this.showComments();
    }, 100);
  }

  private fail(error: Object): string {
    if (error instanceof ApiRequestError) return error.message;
    return '操作失败，请重试';
  }

  private handleSessionError(error: Object): boolean {
    if (error instanceof ApiRequestError && isSessionExpiredCode(error.code)) {
      this.onSessionExpired();
      return true;
    }
    return false;
  }

  async load(): Promise<void> {
    const generation: number = ++this.generation;
    this.loading = true;
    this.errorText = '';
    try {
      const result: ForumPostView = await ForumService.detail(this.param.postId);
      if (this.disposed || generation !== this.generation) return;
      this.detail = result;
    } catch (error) {
      if (this.disposed || generation !== this.generation) return;
      this.detail = null;
      this.comments = [];
      this.errorText = this.fail(error as Object);
      this.handleSessionError(error as Object);
    } finally {
      if (!this.disposed && generation === this.generation) this.loading = false;
    }
  }

  private mergeComments(current: ForumCommentView[], incoming: ForumCommentView[]): ForumCommentView[] {
    const byId: Map<string, ForumCommentView> = new Map();
    current.forEach((item: ForumCommentView) => { byId.set(item.id, item); });
    incoming.forEach((item: ForumCommentView) => { byId.set(item.id, item); });
    return Array.from(byId.values()).sort((a: ForumCommentView, b: ForumCommentView): number => {
      const timeOrder: number = a.createdAt.localeCompare(b.createdAt);
      return timeOrder === 0 ? a.id.localeCompare(b.id) : timeOrder;
    });
  }

  async loadComments(targetPage: number, append: boolean): Promise<void> {
    const generation: number = ++this.commentGeneration;
    this.commentsLoading = true;
    this.commentsError = '';
    try {
      const result: ApiPage<ForumCommentView> = await ForumService.listComments(this.param.postId, targetPage);
      if (this.disposed || generation !== this.commentGeneration) return;
      this.comments = append ? this.mergeComments(this.comments, result.items) : result.items;
      this.commentPage = result.pagination.page;
      this.commentTotalPages = result.pagination.totalPages;
    } catch (error) {
      if (this.disposed || generation !== this.commentGeneration) return;
      this.commentsError = this.fail(error as Object);
      if ((error as ApiRequestError).code === 'FORUM_POST_NOT_FOUND') {
        this.detail = null;
        this.comments = [];
        this.errorText = this.commentsError;
      }
    } finally {
      if (!this.disposed && generation === this.commentGeneration) {
        this.commentsLoading = false;
        this.scheduleCommentFocus();
      }
    }
  }

  async sendComment(): Promise<void> {
    if (!this.authenticated) {
      this.onLogin();
      return;
    }
    if (this.commentSending || this.disposed || this.detail === null) return;
    const body: string = this.commentRequestKey === '' ? this.commentDraft.trim() : this.commentRetryBody;
    if (body === '' || body.length > 2000) {
      this.commentError = body === '' ? '请输入评论内容' : '评论最多 2000 字';
      return;
    }
    if (this.commentRequestKey === '') {
      this.commentRequestKey = ForumService.newCreateRequestKey();
      this.commentRetryBody = body;
    }
    const sessionStamp: string = SessionService.sessionStamp();
    this.commentSending = true;
    this.commentError = '';
    try {
      const created: ForumCommentView = await ForumService.createComment(this.param.postId, body, this.commentRequestKey);
      if (this.disposed || SessionService.sessionStamp() !== sessionStamp) return;
      this.comments = this.mergeComments(this.comments, [created]);
      this.commentDraft = '';
      this.commentRequestKey = '';
      this.commentRetryBody = '';
      if (this.detail !== null) this.detail.commentCount += 1;
      this.onChanged();
    } catch (error) {
      if (this.disposed || SessionService.sessionStamp() !== sessionStamp) return;
      const apiError = error as ApiRequestError;
      if (apiError.code === 'FORUM_POST_NOT_FOUND') {
        this.detail = null;
        this.comments = [];
        this.errorText = apiError.message;
        this.commentRequestKey = '';
        this.commentRetryBody = '';
        return;
      }
      if (this.handleSessionError(error as Object)) {
        this.commentRequestKey = '';
        this.commentRetryBody = '';
        return;
      }
      if (apiError.code !== 'NETWORK_ERROR' && apiError.code !== 'UNEXPECTED_RESPONSE') {
        this.commentRequestKey = '';
        this.commentRetryBody = '';
      }
      this.commentError = apiError.code === 'NETWORK_ERROR' || apiError.code === 'UNEXPECTED_RESPONSE'
        ? '评论结果未确认，重试会复用同一请求，避免重复评论'
        : this.fail(error as Object);
    } finally {
      if (!this.disposed && SessionService.sessionStamp() === sessionStamp) this.commentSending = false;
    }
  }

  async retryComment(): Promise<void> {
    return this.sendComment();
  }

  openDeletePost(): void {
    if (!this.authenticated) {
      this.onLogin();
      return;
    }
    this.deleteError = '';
    this.deletePostOpen = true;
  }

  openDeleteComment(id: string): void {
    if (!this.authenticated) {
      this.onLogin();
      return;
    }
    this.deleteError = '';
    this.deleteCommentId = id;
  }

  async confirmDeletePost(): Promise<void> {
    if (this.deleteBusy || this.disposed) return;
    const sessionStamp: string = SessionService.sessionStamp();
    this.deleteBusy = true;
    this.deleteError = '';
    try {
      await ForumService.deletePost(this.param.postId);
      if (this.disposed || SessionService.sessionStamp() !== sessionStamp) return;
      this.detail = null;
      this.comments = [];
      this.deletePostOpen = false;
      this.onChanged();
      this.navigated = true;
      this.onBack();
    } catch (error) {
      if (this.disposed || SessionService.sessionStamp() !== sessionStamp) return;
      const apiError = error as ApiRequestError;
      if (apiError.code === 'FORUM_POST_NOT_FOUND') {
        this.detail = null;
        this.comments = [];
        this.deletePostOpen = false;
        this.errorText = apiError.message;
        this.onChanged();
        return;
      }
      if (this.handleSessionError(error as Object)) return;
      this.deleteError = this.fail(error as Object);
    } finally {
      if (!this.disposed && SessionService.sessionStamp() === sessionStamp) this.deleteBusy = false;
    }
  }

  async confirmDeleteComment(): Promise<void> {
    if (this.deleteBusy || this.disposed || this.deleteCommentId === '') return;
    const id: string = this.deleteCommentId;
    const sessionStamp: string = SessionService.sessionStamp();
    this.deleteBusy = true;
    this.deleteError = '';
    try {
      await ForumService.deleteComment(id);
      if (this.disposed || SessionService.sessionStamp() !== sessionStamp) return;
      this.comments = this.comments.filter((item: ForumCommentView) => item.id !== id);
      this.deleteCommentId = '';
      if (this.detail !== null && this.detail.commentCount > 0) this.detail.commentCount -= 1;
      this.onChanged();
    } catch (error) {
      if (this.disposed || SessionService.sessionStamp() !== sessionStamp) return;
      const apiError = error as ApiRequestError;
      if (apiError.code === 'FORUM_COMMENT_NOT_FOUND') {
        this.comments = this.comments.filter((item: ForumCommentView) => item.id !== id);
        this.deleteCommentId = '';
        this.onChanged();
        return;
      }
      if (this.handleSessionError(error as Object)) return;
      this.deleteError = this.fail(error as Object);
    } finally {
      if (!this.disposed && SessionService.sessionStamp() === sessionStamp) this.deleteBusy = false;
    }
  }

  @Builder
  commentCard(item: ForumCommentView) {
    Row({ space: 10 }) {
      Image($r('app.media.forum_avatar')).width(32).height(32).alignSelf(ItemAlign.Start)
      Column({ space: 6 }) {
        Row({ space: 6 }) {
          Text(item.author.displayName).fontSize(13).fontWeight(FontWeight.Medium).fontColor(FORUM_SECONDARY)
          if (this.detail !== null && item.author.id === this.detail.author.id) {
            Text('作者').fontSize(10).fontColor(FORUM_INK).backgroundColor('#F7E9AD')
              .padding({ left: 4, right: 4, top: 1, bottom: 1 }).borderRadius(3)
          }
          Blank().layoutWeight(1)
          if (item.actions.canDelete) {
            Text('删除').fontSize(12).fontColor('#B04438').padding({ left: 10, right: 2 }).onClick(() => {
              this.openDeleteComment(item.id);
            })
          }
        }.width('100%')
        Text(item.body).fontSize(15).lineHeight(23).fontColor(FORUM_INK).width('100%')
        Text(detailTimeText(item.createdAt)).fontSize(11).fontColor(FORUM_MUTED).width('100%')
      }.layoutWeight(1).alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .padding({ top: 14, bottom: 14 })
    .alignItems(VerticalAlign.Top)
  }

  @Builder
  deleteSheet(post: boolean) {
    Column() {
      Column().width('100%').layoutWeight(1).backgroundColor('#66000000').onClick(() => {
        if (!this.deleteBusy) {
          this.deletePostOpen = false;
          this.deleteCommentId = '';
        }
      })
      Column({ space: 16 }) {
        Text(post ? '删除这篇帖子？' : '删除这条评论？').fontSize(21).fontWeight(FontWeight.Bold).width('100%')
        Text(post ? '帖子、图片和评论将一并移除，删除后不能继续查看。' : '删除后这条评论将不再显示。')
          .fontSize(14).fontColor('#66727A').lineHeight(21).width('100%')
        if (this.deleteError !== '') {
          Text(this.deleteError).fontSize(13).fontColor($r('app.color.danger')).width('100%')
        }
        Button(this.deleteBusy ? '删除中…' : '确认删除')
          .width('100%').height(46).backgroundColor('#B04438').fontColor(Color.White).enabled(!this.deleteBusy)
          .onClick(() => {
            if (post) this.confirmDeletePost();
            else this.confirmDeleteComment();
          })
        Button('取消').width('100%').height(42).backgroundColor('#EEF2F5').fontColor('#35424B').enabled(!this.deleteBusy)
          .onClick(() => {
            this.deletePostOpen = false;
            this.deleteCommentId = '';
          })
      }
      .width('100%')
      .padding({ left: 20, right: 20, top: 22, bottom: 24 })
      .backgroundColor(Color.White)
      .borderRadius({ topLeft: 24, topRight: 24 })
    }.width('100%').height('100%').justifyContent(FlexAlign.End)
  }

  @Builder
  detailHeader() {
    Row() {
      Button({ type: ButtonType.Normal }) {
        Image($r('app.media.detail_back')).width(22).height(22)
      }.width(44).height(48).padding(0).backgroundColor(Color.Transparent)
        .accessibilityText('返回').onClick(this.onBack)
      Text('帖子').fontSize(19).fontWeight(FontWeight.Bold).fontColor(FORUM_INK).layoutWeight(1)
      Button({ type: ButtonType.Normal }) {
        Image($r('app.media.detail_refresh')).width(21).height(21)
      }.width(44).height(48).padding(0).backgroundColor(Color.Transparent)
        .accessibilityText('刷新帖子').onClick(() => {
          this.load();
          this.loadComments(1, false);
        })
    }.width('100%').height(56).padding({ left: 8, right: 8 }).backgroundColor(FORUM_SURFACE)
  }

  @Builder
  commentBar() {
    Column({ space: 4 }) {
      if (this.commentError !== '') {
        Text(this.commentError).fontSize(12).fontColor('#B04438').width('100%')
      }
      Row({ space: 10 }) {
        TextInput({ text: $$this.commentDraft, placeholder: this.authenticated ? '写下你的想法…' : '登录后参与评论' })
          .layoutWeight(1).height(42).fontSize(14).backgroundColor('#F2F3F5').borderRadius(21).maxLength(2000)
          .enabled(!this.commentSending).onFocus(() => { this.resizeForKeyboard(); })
          .onBlur(() => { this.restoreKeyboardMode(); })
        Button(this.commentSending ? '发送中…' : (this.commentRequestKey === '' ? '发送' : '重试'))
          .height(42).fontSize(14).backgroundColor(FORUM_ACCENT).fontColor(FORUM_INK).enabled(!this.commentSending)
          .onClick(() => {
            if (this.commentRequestKey === '') this.sendComment();
            else this.retryComment();
          })
        Button({ type: ButtonType.Normal }) {
          Row({ space: 4 }) {
            Image($r('app.media.forum_comment')).width(18).height(18)
            Text(`${this.detail?.commentCount ?? 0}`).fontSize(12).fontColor(FORUM_SECONDARY)
          }
        }.height(42).padding({ left: 4, right: 4 }).backgroundColor(Color.Transparent)
          .accessibilityText(`查看 ${this.detail?.commentCount ?? 0} 条评论`).onClick(() => { this.showComments(); })
      }.width('100%')
    }.width('100%').padding({ left: 16, right: 16, top: 8, bottom: 12 }).backgroundColor(FORUM_SURFACE)
  }

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      Column() {
        this.detailHeader()
        if (this.loading && this.detail === null) {
          LoadingPanel({ text: '正在加载帖子…' }).layoutWeight(1)
        } else if (this.errorText !== '' && this.detail === null) {
          ErrorPanel({ message: this.errorText, onRetry: (): void => {
            this.load();
            this.loadComments(1, false);
          } }).layoutWeight(1)
        } else if (this.detail !== null) {
          Scroll(this.detailScroller) {
            Column({ space: 8 }) {
              Column({ space: 14 }) {
                Text(forumCategoryLabel(this.detail!.category)).fontSize(12).fontColor(FORUM_SECONDARY)
                Text(this.detail!.title).fontSize(23).fontWeight(FontWeight.Bold).lineHeight(32)
                  .fontColor(FORUM_INK).width('100%')
                Row({ space: 10 }) {
                  Image($r('app.media.forum_avatar')).width(34).height(34)
                  Column({ space: 3 }) {
                    Text(this.detail!.author.displayName).fontSize(14).fontWeight(FontWeight.Medium).fontColor(FORUM_INK)
                    Text(detailTimeText(this.detail!.createdAt)).fontSize(11).fontColor(FORUM_MUTED)
                  }.layoutWeight(1).alignItems(HorizontalAlign.Start)
                }.width('100%')
                Text(this.detail!.body).fontSize(16).lineHeight(27).fontColor(FORUM_INK).width('100%')
                if (this.detail!.images.length > 0) {
                  Flex({ wrap: FlexWrap.Wrap }) {
                    ForEach(this.detail!.images, (forumImage: ForumImageView, index: number) => {
                      ForumPostImage({ url: forumImage.url, cornerRadius: 8,
                        onOpen: (): void => { this.resetImageZoom(); this.imagePreviewIndex = index; } })
                        .width('31%').height(112).margin({ right: 8, bottom: 8 })
                    }, (forumImage: ForumImageView) => forumImage.id)
                  }.width('100%')
                }
                if (this.detail!.actions.canDelete) {
                  Button('删除帖子').fontSize(13).height(36).backgroundColor('#FBEAE7').fontColor('#B04438')
                    .onClick(() => { this.openDeletePost(); })
                }
              }.width('100%').padding({ left: 16, right: 16, top: 16, bottom: 20 })
                .backgroundColor(FORUM_SURFACE).alignItems(HorizontalAlign.Start)
                .onAreaChange((_oldArea: Area, newArea: Area) => { this.onPostAreaChanged(newArea); })

              Column({ space: 4 }) {
                Text(`评论 ${this.detail!.commentCount}`).fontSize(17).fontWeight(FontWeight.Bold).fontColor(FORUM_INK).width('100%')
                if (this.commentsLoading && this.comments.length === 0) {
                  LoadingPanel({ text: '正在加载评论…' })
                } else if (this.commentsError !== '' && this.comments.length === 0) {
                  ErrorPanel({ message: this.commentsError, onRetry: (): void => { this.loadComments(1, false); } })
                } else if (this.comments.length === 0) {
                  Text('还没有评论，欢迎补充真实经验。').fontSize(14).fontColor(FORUM_MUTED).padding({ top: 24, bottom: 24 }).width('100%')
                } else {
                  ForEach(this.comments, (item: ForumCommentView) => {
                    this.commentCard(item);
                  }, (item: ForumCommentView) => item.id)
                  if (this.commentsError !== '') {
                    ErrorPanel({ message: this.commentsError, onRetry: (): void => { this.loadComments(this.commentPage + 1, true); } })
                  }
                  if (this.commentPage < this.commentTotalPages) {
                    Button(this.commentsLoading ? '加载中…' : '加载更多评论').fontSize(13).enabled(!this.commentsLoading)
                      .onClick(() => { this.loadComments(this.commentPage + 1, true); })
                  }
                }
              }.width('100%').padding(16).backgroundColor(FORUM_SURFACE).alignItems(HorizontalAlign.Start)
            }.width('100%')
          }.width('100%').layoutWeight(1).scrollBar(BarState.Off).align(Alignment.Top)
          this.commentBar()
        }
      }.width('100%').height('100%').backgroundColor(FORUM_BACKGROUND)

      if (this.deletePostOpen) {
        this.deleteSheet(true);
      } else if (this.deleteCommentId !== '') {
        this.deleteSheet(false);
      }
      if (this.imagePreviewIndex >= 0 && this.detail !== null) {
        Column() {
          Row() {
            Button('关闭').fontSize(14).fontColor(Color.White).backgroundColor(Color.Transparent)
              .onClick(() => { this.imagePreviewIndex = -1; })
            Text(this.imageScale > 1 ? '拖动查看 · 双击还原' : '双击放大').fontSize(12).fontColor('#B5B5B5')
              .textAlign(TextAlign.Center).layoutWeight(1)
            Text(`${this.imagePreviewIndex + 1} / ${this.detail!.images.length}`)
              .fontSize(14).fontColor(Color.White)
          }.width('100%').height(56).padding({ left: 12, right: 20 })
          Swiper() {
            ForEach(this.detail!.images, (forumImage: ForumImageView) => {
              ForumPostImage({ url: forumImage.url, cornerRadius: 0, imageFit: ImageFit.Contain,
                imageBackground: '#101010', viewer: true, viewerZoomed: this.imageScale > 1,
                onZoom: (): void => { if (this.imageScale > 1) this.resetImageZoom(); else this.imageScale = 2; },
                onPan: (x: number, y: number): void => { this.panImage(x, y); },
                onPanEnd: (): void => { this.imagePanBaseX = this.imageOffsetX; this.imagePanBaseY = this.imageOffsetY; } })
                .scale({ x: this.imageScale, y: this.imageScale })
                .translate({ x: this.imageOffsetX, y: this.imageOffsetY })
            }, (forumImage: ForumImageView) => forumImage.id)
          }.index(this.imagePreviewIndex).loop(false).indicator(false).disableSwipe(this.imageScale > 1)
            .layoutWeight(1).width('100%')
            .onChange((index: number) => { this.resetImageZoom(); this.imagePreviewIndex = index; })
        }.width('100%').height('100%').backgroundColor('#101010')
      }
    }.width('100%').height('100%')
  }
}
