import { image } from '@kit.ImageKit';
import { ApiRequestError, isSessionExpiredCode } from '../../core/network/ApiClient';
import { SessionService } from '../../core/auth/SessionService';
import { KeyboardAvoidMode } from '@kit.ArkUI';
import { PickedImage, PickImagesResult, PhotoPicker } from '../repair/PhotoPicker';
import {
  FORUM_CATEGORY_EXPERIENCE,
  FORUM_CATEGORY_GENERAL,
  FORUM_CATEGORY_QUESTION,
  ForumPostDraft,
  ForumPostParam,
  ForumPostView,
  forumCategoryLabel
} from './ForumContract';
import { ForumService } from './ForumService';
import { FORUM_ACCENT, FORUM_BACKGROUND, FORUM_INK, FORUM_MUTED, FORUM_SECONDARY, FORUM_SURFACE } from './ForumTheme';

interface PendingForumImage extends PickedImage {
  uploadKey: string;
}

/** 已选图片的本地预览，不上传第二份、不使用网络占位图。 */
@Component
struct PendingForumImageView {
  @Prop fileName: string = '';
  @Prop imageFit: ImageFit = ImageFit.Cover;
  bytes: ArrayBuffer = new ArrayBuffer(0);
  @State pixelMap: image.PixelMap | undefined = undefined;
  @State failed: boolean = false;
  private generation: number = 0;

  aboutToAppear(): void {
    this.decode();
  }

  aboutToDisappear(): void {
    this.generation += 1;
    if (this.pixelMap !== undefined) {
      this.pixelMap.release().catch(() => {
      });
      this.pixelMap = undefined;
    }
  }

  private async decode(): Promise<void> {
    const generation: number = ++this.generation;
    try {
      const source: image.ImageSource = image.createImageSource(this.bytes);
      let decoded: image.PixelMap;
      try {
        decoded = await source.createPixelMap();
      } finally {
        source.release();
      }
      if (generation !== this.generation) {
        decoded.release().catch(() => {});
        return;
      }
      this.pixelMap = decoded;
    } catch (error) {
      if (generation === this.generation) this.failed = true;
    }
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      if (this.pixelMap !== undefined) {
        Image(this.pixelMap).width('100%').height('100%').objectFit(this.imageFit)
      } else {
        Text(this.failed ? '图片读取失败' : '正在读取图片…').fontSize(11).fontColor('#737F87')
      }
    }.width('100%').height('100%').backgroundColor('#E9EEF2').borderRadius(12).clip(true)
  }
}

/** 发布与图片恢复：savedId 之后只续传，绝不重复建帖。 */
@Component
export struct ForumComposePage {
  onSaved: (postId: string) => void = () => {};
  onSessionExpired: () => void = () => {};
  onBack: () => void = () => {};
  onRegisterBackHandler: (handler: () => boolean) => void = () => {};
  @State savedId: string = '';
  @State savedPostId: string = '';
  @State category: string = FORUM_CATEGORY_GENERAL;
  @State title: string = '';
  @State body: string = '';
  @State pending: PendingForumImage[] = [];
  @State uploadedCount: number = 0;
  @State createRequestKey: string = '';
  @State submitting: boolean = false;
  @State picking: boolean = false;
  @State uploadMessage: string = '';
  @State errorText: string = '';
  @State previewIndex: number = -1;
  @State leaveConfirmOpen: boolean = false;
  private disposed: boolean = false;
  private keyboardModeChanged: boolean = false;
  private previousKeyboardMode: KeyboardAvoidMode = 0;

  aboutToAppear(): void {
    this.onRegisterBackHandler((): boolean => this.requestBack());
  }

  aboutToDisappear(): void {
    this.restoreKeyboardMode();
    this.onRegisterBackHandler((): boolean => false);
    this.disposed = true;
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

  requestBack(): boolean {
    if (this.previewIndex >= 0) {
      this.previewIndex = -1;
      return true;
    }
    if (this.leaveConfirmOpen) {
      this.leaveConfirmOpen = false;
      return true;
    }
    if (this.submitting || this.picking) {
      this.errorText = this.submitting ? '正在发布，请稍候' : '正在读取图片，请稍候';
      return true;
    }
    if (this.savedId !== '' || this.createRequestKey !== '' || this.title.trim() !== '' ||
      this.body.trim() !== '' || this.pending.length > 0 || this.category !== FORUM_CATEGORY_GENERAL) {
      this.leaveConfirmOpen = true;
      return true;
    }
    return false;
  }

  leaveEditor(): void {
    this.leaveConfirmOpen = false;
    if (this.savedId !== '') this.onSaved(this.savedId);
    else this.onBack();
  }

  private fail(error: Object): void {
    if (this.disposed || SessionService.sessionStamp() === '') return;
    const apiError = error as ApiRequestError;
    if (isSessionExpiredCode(apiError.code)) {
      this.onSessionExpired();
      return;
    }
    this.errorText = apiError.message === undefined ? '发布失败，请重试' : apiError.message;
  }

  async pickImages(): Promise<void> {
    if (this.submitting || this.picking) return;
    const remain: number = 9 - this.uploadedCount - this.pending.length;
    if (remain <= 0) {
      this.errorText = '每篇帖子最多 9 张图片';
      return;
    }
    this.picking = true;
    this.errorText = '';
    try {
      const result: PickImagesResult = await PhotoPicker.pickDetailed(remain);
      if (this.disposed) return;
      if (result.images.length === 0) {
        if (result.selectedCount > 0) this.errorText = '未读取到可用图片，请检查文件格式并重新选择';
        return;
      }
      const additions: PendingForumImage[] = [];
      for (const item of result.images) {
        additions.push({ fileName: item.fileName, mimeType: item.mimeType, data: item.data, uploadKey: ForumService.newUploadKey() });
      }
      this.pending = this.pending.concat(additions);
      if (result.images.length < result.selectedCount) this.errorText = '部分图片未能读取，请重新选择';
    } catch (error) {
      if (!this.disposed) this.errorText = '本地图片读取失败，请重新选择';
    } finally {
      if (!this.disposed) this.picking = false;
    }
  }

  removePending(index: number): void {
    if (this.submitting || index < 0 || index >= this.pending.length) return;
    this.pending = this.pending.filter((_item: PendingForumImage, itemIndex: number) => itemIndex !== index);
    this.previewIndex = -1;
  }

  private validate(): boolean {
    const title: string = this.title.trim();
    const body: string = this.body.trim();
    if (title === '' || title.length > 120) {
      this.errorText = '标题需为 1–120 字';
      return false;
    }
    if (body === '' || body.length > 10000) {
      this.errorText = '正文需为 1–10000 字';
      return false;
    }
    if (this.uploadedCount + this.pending.length > 9) {
      this.errorText = '每篇帖子最多 9 张图片';
      return false;
    }
    return true;
  }

  async submit(): Promise<void> {
    if (this.submitting || this.disposed || !this.validate()) return;
    const sessionStamp: string = SessionService.sessionStamp();
    this.submitting = true;
    this.errorText = '';
    try {
      let id: string = this.savedId;
      if (id === '') {
        if (this.createRequestKey === '') this.createRequestKey = ForumService.newCreateRequestKey();
        const draft: ForumPostDraft = {
          category: this.category,
          title: this.title.trim(),
          body: this.body.trim(),
          createRequestKey: this.createRequestKey
        };
        const created: ForumPostView = await ForumService.createPost(draft);
        if (this.disposed || SessionService.sessionStamp() !== sessionStamp) return;
        id = created.id;
        this.savedId = id;
      }
      const images: PendingForumImage[] = this.pending.slice();
      for (let index = 0; index < images.length; index += 1) {
        if (this.disposed || SessionService.sessionStamp() !== sessionStamp) return;
        this.uploadMessage = `正在上传图片 ${index + 1}/${images.length}`;
        const item: PendingForumImage = images[index];
        await ForumService.uploadImages(id, [item], [item.uploadKey]);
        if (this.disposed || SessionService.sessionStamp() !== sessionStamp) return;
        this.pending = this.pending.filter((candidate: PendingForumImage) => candidate.uploadKey !== item.uploadKey);
        this.uploadedCount += 1;
      }
      if (this.disposed || SessionService.sessionStamp() !== sessionStamp) return;
      this.savedPostId = id;
      this.uploadMessage = '';
      this.title = '';
      this.body = '';
      this.pending = [];
      this.onSaved(id);
    } catch (error) {
      if (this.disposed || SessionService.sessionStamp() !== sessionStamp) return;
      const apiError = error as ApiRequestError;
      // 只有明确的客户端拒绝才允许修改并新建请求；网络异常、服务端错误及超时保留原幂等键。
      if (this.savedId === '' && apiError.status >= 400 && apiError.status < 500 && apiError.status !== 408 &&
        apiError.status !== 429) {
        this.createRequestKey = '';
      }
      this.uploadMessage = this.savedId === '' ? '' : '帖子已创建；重试只会续传剩余图片，不会重复发帖';
      this.fail(error as Object);
    } finally {
      if (!this.disposed && SessionService.sessionStamp() === sessionStamp) this.submitting = false;
    }
  }

  @Builder
  previewSheet() {
    Column() {
      Column().width('100%').layoutWeight(1).backgroundColor('#66000000').onClick(() => {
        this.previewIndex = -1;
      })
      Column({ space: 12 }) {
        Text(this.pending[this.previewIndex].fileName).fontSize(14).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        PendingForumImageView({ fileName: this.pending[this.previewIndex].fileName,
          bytes: this.pending[this.previewIndex].data, imageFit: ImageFit.Contain })
          .width('100%').height(360)
        Button('关闭预览').width('100%').backgroundColor('#EEF2F5').fontColor('#35424B').onClick(() => {
          this.previewIndex = -1;
        })
      }.width('100%').padding(20).backgroundColor(Color.White).borderRadius({ topLeft: 24, topRight: 24 })
    }.width('100%').height('100%').justifyContent(FlexAlign.End)
  }

  @Builder
  leaveSheet() {
    Column() {
      Column().width('100%').layoutWeight(1).backgroundColor('#66000000')
        .onClick(() => { this.leaveConfirmOpen = false; })
      Column({ space: 14 }) {
        Text(this.savedId !== '' ? '退出并保留已发布的帖子？' : '放弃本次编辑？')
          .fontSize(19).fontWeight(FontWeight.Bold).fontColor(FORUM_INK).width('100%')
        Text(this.savedId !== '' ? '帖子已发布，剩余图片不会上传。退出后将查看已发布的帖子。' :
          (this.createRequestKey !== '' ? '发布结果尚未确认，继续留在这里可以安全重试；退出后无法恢复本次编辑。' :
          '离开后当前内容与已选图片将丢失。'))
          .fontSize(14).fontColor(FORUM_SECONDARY).lineHeight(22).width('100%')
        Button('继续编辑').width('100%').height(46).backgroundColor(FORUM_ACCENT).fontColor(FORUM_INK)
          .onClick(() => { this.leaveConfirmOpen = false; })
        Button(this.savedId !== '' ? '退出并查看帖子' : '放弃并退出')
          .width('100%').height(42).backgroundColor('#F2F3F5').fontColor('#B04438')
          .onClick(() => { this.leaveEditor(); })
      }.width('100%').padding({ left: 20, right: 20, top: 22, bottom: 24 })
        .backgroundColor(FORUM_SURFACE).borderRadius({ topLeft: 20, topRight: 20 })
    }.width('100%').height('100%').justifyContent(FlexAlign.End)
  }

  @Builder
  editorHeader() {
    Row() {
      Button('关闭').fontSize(14).fontColor(FORUM_INK).backgroundColor(Color.Transparent)
        .padding({ left: 0, right: 12 }).height(48).onClick(() => {
          if (!this.requestBack()) this.onBack();
        })
      Text('发布帖子').fontSize(18).fontWeight(FontWeight.Bold).fontColor(FORUM_INK).layoutWeight(1)
      Button(this.submitting ? '发布中…' : (this.savedId !== '' ? '继续上传' :
        (this.createRequestKey !== '' ? '重试发布' : '发布')))
        .fontSize(14).height(38).backgroundColor(FORUM_ACCENT).fontColor(FORUM_INK)
        .enabled(!this.submitting && !this.picking).onClick(() => { this.submit(); })
    }.width('100%').height(56).padding({ left: 16, right: 16 }).backgroundColor(FORUM_SURFACE)
  }

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      Column() {
        this.editorHeader()
        if (this.errorText !== '') {
          Text(this.errorText).fontSize(13).fontColor($r('app.color.danger')).width('100%')
            .padding({ left: 16, right: 16, top: 8, bottom: 8 }).backgroundColor('#FFF4F1')
        }
        if (this.uploadMessage !== '') {
          Text(this.uploadMessage).fontSize(13).fontColor(FORUM_SECONDARY).width('100%')
            .padding({ left: 16, right: 16, top: 8, bottom: 8 }).backgroundColor('#FFF8E0')
        }
        Scroll() {
          Column({ space: 16 }) {
            Column({ space: 14 }) {
              Text('选择分类').fontSize(13).fontColor(FORUM_SECONDARY).width('100%')
              Row({ space: 8 }) {
                ForEach([FORUM_CATEGORY_GENERAL, FORUM_CATEGORY_EXPERIENCE, FORUM_CATEGORY_QUESTION], (name: string) => {
                  Button(forumCategoryLabel(name)).fontSize(13).height(36)
                    .backgroundColor(this.category === name ? FORUM_ACCENT : '#F2F3F5')
                    .fontColor(this.category === name ? FORUM_INK : FORUM_SECONDARY)
                    .enabled(!this.submitting && this.savedId === '' && this.createRequestKey === '')
                    .onClick(() => { this.category = name; })
                })
              }.width('100%')
              TextInput({ text: $$this.title, placeholder: '写一个清楚的标题' })
                .height(52).fontSize(19).fontWeight(FontWeight.Medium).backgroundColor(Color.Transparent)
                .borderRadius(0).padding(0).maxLength(120)
                .enabled(!this.submitting && this.savedId === '' && this.createRequestKey === '')
                .onFocus(() => { this.resizeForKeyboard(); }).onBlur(() => { this.restoreKeyboardMode(); })
              Divider().color('#E9EAED')
              TextArea({ text: $$this.body, placeholder: '分享经验，或描述遇到的问题…' })
                .height(180).fontSize(16).lineHeight(25).backgroundColor(Color.Transparent).borderRadius(0).padding(0)
                .maxLength(10000).enabled(!this.submitting && this.savedId === '' && this.createRequestKey === '')
                .onFocus(() => { this.resizeForKeyboard(); }).onBlur(() => { this.restoreKeyboardMode(); })
              if (this.title.length >= 100 || this.body.length >= 9000) {
                Text(`标题 ${this.title.length}/120 · 正文 ${this.body.length}/10000`)
                  .fontSize(11).fontColor(FORUM_MUTED).width('100%').textAlign(TextAlign.End)
              }
              Flex({ wrap: FlexWrap.Wrap }) {
                ForEach(this.pending, (item: PendingForumImage, index: number) => {
                  Stack({ alignContent: Alignment.TopEnd }) {
                    PendingForumImageView({ fileName: item.fileName, bytes: item.data })
                      .width('100%').height('100%').onClick(() => { this.previewIndex = index; })
                    Button('×').fontSize(20).fontColor(Color.White).backgroundColor('#99000000').borderRadius(14)
                      .width(28).height(28).padding(0).accessibilityText('移除图片').enabled(!this.submitting)
                      .onClick(() => { this.removePending(index); })
                  }.width('31%').height(112).margin({ right: 8, bottom: 8 })
                }, (item: PendingForumImage) => item.uploadKey)
                if (this.uploadedCount + this.pending.length < 9) {
                  Button({ type: ButtonType.Normal }) {
                    Column({ space: 6 }) {
                      Text('+').fontSize(30).fontColor(FORUM_SECONDARY)
                      Text(this.picking ? '读取中…' : '添加图片').fontSize(12).fontColor(FORUM_SECONDARY)
                    }.justifyContent(FlexAlign.Center)
                  }.width('31%').height(112).margin({ right: 8, bottom: 8 }).borderRadius(8)
                    .backgroundColor('#F2F3F5').enabled(!this.submitting && !this.picking)
                    .accessibilityText('添加图片').onClick(() => { this.pickImages(); })
                }
              }.width('100%')
              if (this.pending.length > 0 || this.uploadedCount > 0) {
                Text(this.uploadedCount > 0 ? `已上传 ${this.uploadedCount}，待上传 ${this.pending.length} / 9 张` :
                  `已选 ${this.pending.length}/9 张图片`).fontSize(12).fontColor(FORUM_MUTED).width('100%')
              }
            }.width('100%').padding({ left: 16, right: 16, top: 16, bottom: 20 })
              .backgroundColor(FORUM_SURFACE).alignItems(HorizontalAlign.Start)

            if (this.savedId !== '' || this.createRequestKey !== '') {
              Text(this.savedId !== '' ? '帖子已发布，请完成剩余图片上传。' : '发布结果尚未确认，请重试本次发布。')
                .fontSize(13).fontColor('#765B00').padding(12).backgroundColor('#FFF8E0').borderRadius(8).width('100%')
            }
          }.width('100%').padding({ bottom: 24 })
        }.width('100%').layoutWeight(1).scrollBar(BarState.Off).align(Alignment.Top)
      }.width('100%').height('100%').backgroundColor(FORUM_BACKGROUND)
      if (this.previewIndex >= 0 && this.previewIndex < this.pending.length) {
        this.previewSheet();
      } else if (this.leaveConfirmOpen) {
        this.leaveSheet();
      }
    }.width('100%').height('100%')
  }
}
