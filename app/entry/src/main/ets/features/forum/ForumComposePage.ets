import { image } from '@kit.ImageKit';
import { ApiRequestError, isSessionExpiredCode } from '../../core/network/ApiClient';
import { SessionService } from '../../core/auth/SessionService';
import { DetailHeader } from '../../core/ui/ReferenceDetail';
import { PickedImage, PhotoPicker } from '../repair/PhotoPicker';
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

interface PendingForumImage extends PickedImage {
  uploadKey: string;
}

/** 已选图片的本地预览，不上传第二份、不使用网络占位图。 */
@Component
struct PendingForumImageView {
  @Prop fileName: string = '';
  @Prop bytes: ArrayBuffer = new ArrayBuffer(0);
  @State pixelMap: image.PixelMap | undefined = undefined;
  @State failed: boolean = false;

  aboutToAppear(): void {
    this.decode();
  }

  aboutToDisappear(): void {
    if (this.pixelMap !== undefined) {
      this.pixelMap.release().catch(() => {
      });
      this.pixelMap = undefined;
    }
  }

  private async decode(): Promise<void> {
    try {
      const source: image.ImageSource = image.createImageSource(this.bytes);
      this.pixelMap = await source.createPixelMap();
      source.release();
    } catch (error) {
      this.failed = true;
    }
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      if (this.pixelMap !== undefined) {
        Image(this.pixelMap).width('100%').height('100%').objectFit(ImageFit.Cover)
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
  @State savedId: string = '';
  @State savedPostId: string = '';
  @State category: string = FORUM_CATEGORY_GENERAL;
  @State title: string = '';
  @State body: string = '';
  @State pending: PendingForumImage[] = [];
  @State createRequestKey: string = '';
  @State submitting: boolean = false;
  @State picking: boolean = false;
  @State uploadMessage: string = '';
  @State errorText: string = '';
  @State previewIndex: number = -1;
  private disposed: boolean = false;

  aboutToDisappear(): void {
    this.disposed = true;
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
    const remain: number = 9 - this.pending.length;
    if (remain <= 0) {
      this.errorText = '每篇帖子最多 9 张图片';
      return;
    }
    this.picking = true;
    this.errorText = '';
    try {
      const picked: PickedImage[] = await PhotoPicker.pick(remain);
      if (this.disposed) return;
      if (picked.length === 0) {
        this.errorText = '未读取到可用图片；请检查相册权限、文件格式或是否已取消选择';
        return;
      }
      const additions: PendingForumImage[] = [];
      for (const item of picked) {
        additions.push({ fileName: item.fileName, mimeType: item.mimeType, data: item.data, uploadKey: ForumService.newUploadKey() });
      }
      this.pending = this.pending.concat(additions);
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
    if (this.pending.length > 9) {
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
        PendingForumImageView({ fileName: this.pending[this.previewIndex].fileName, bytes: this.pending[this.previewIndex].data })
          .width('100%').height(360)
        Button('关闭预览').width('100%').backgroundColor('#EEF2F5').fontColor('#35424B').onClick(() => {
          this.previewIndex = -1;
        })
      }.width('100%').padding(20).backgroundColor(Color.White).borderRadius({ topLeft: 24, topRight: 24 })
    }.width('100%').height('100%').justifyContent(FlexAlign.End)
  }

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      Column() {
        DetailHeader({ title: '发布帖子', onBack: () => {}, refresh: false })
        Scroll() {
          Column({ space: 16 }) {
            Column({ space: 12 }) {
              Text('选择分类').fontSize(15).fontWeight(FontWeight.Medium).width('100%')
              Row({ space: 8 }) {
                ForEach([FORUM_CATEGORY_GENERAL, FORUM_CATEGORY_EXPERIENCE, FORUM_CATEGORY_QUESTION], (name: string) => {
                  Button(forumCategoryLabel(name)).fontSize(13).height(38)
                    .backgroundColor(this.category === name ? '#2474D4' : '#E9EFF4')
                    .fontColor(this.category === name ? Color.White : '#46545E')
                    .enabled(!this.submitting && this.savedId === '')
                    .onClick(() => {
                      this.category = name;
                    })
                })
              }.width('100%')
              TextInput({ text: $$this.title, placeholder: '标题（最多 120 字）' })
                .height(48).fontSize(16).backgroundColor('#F1F4F6').borderRadius(12).maxLength(120)
                .enabled(!this.submitting && this.savedId === '')
              TextArea({ text: $$this.body, placeholder: '分享真实维修经验或提出具体问题（最多 10000 字）' })
                .height(190).fontSize(16).backgroundColor('#F1F4F6').borderRadius(12).maxLength(10000)
                .enabled(!this.submitting && this.savedId === '')
            }.width('100%').padding(16).backgroundColor(Color.White).borderRadius(20).alignItems(HorizontalAlign.Start)

            Column({ space: 12 }) {
              Row() {
                Text(`图片 ${this.pending.length}/9`).fontSize(16).fontWeight(FontWeight.Medium).layoutWeight(1)
                Button(this.picking ? '读取中…' : '选择图片').fontSize(13).height(36).enabled(!this.submitting && !this.picking)
                  .onClick(() => {
                    this.pickImages();
                  })
              }.width('100%')
              if (this.pending.length > 0) {
                Flex({ wrap: FlexWrap.Wrap }) {
                  ForEach(this.pending, (item: PendingForumImage, index: number) => {
                    Stack({ alignContent: Alignment.TopEnd }) {
                      PendingForumImageView({ fileName: item.fileName, bytes: item.data })
                        .width('100%').height('100%').onClick(() => {
                          this.previewIndex = index;
                        })
                      Text('×').fontSize(20).fontColor(Color.White).backgroundColor('#99000000').borderRadius(14)
                        .width(28).height(28).textAlign(TextAlign.Center).onClick(() => {
                          this.removePending(index);
                        })
                    }.width('31%').height(112).margin({ right: 8, bottom: 8 })
                  }, (item: PendingForumImage) => item.uploadKey)
                }.width('100%')
              } else {
                Text('可添加真实 JPEG / PNG / WebP 图片；读取失败会明确提示。').fontSize(13).fontColor('#78848C')
              }
            }.width('100%').padding(16).backgroundColor(Color.White).borderRadius(20).alignItems(HorizontalAlign.Start)

            if (this.savedId !== '') {
              Text('帖子已创建，当前只需完成剩余图片上传。').fontSize(13).fontColor('#8A5A00')
                .padding(12).backgroundColor('#FFF8E8').borderRadius(12).width('100%')
            }
            if (this.uploadMessage !== '') {
              Text(this.uploadMessage).fontSize(13).fontColor('#526572').width('100%')
            }
            if (this.errorText !== '') {
              Text(this.errorText).fontSize(13).fontColor($r('app.color.danger')).width('100%')
            }
            Button(this.submitting ? '提交中…' : (this.savedId === '' ? '发布帖子' : '续传剩余图片'))
              .width('100%').height(48).fontSize(16).backgroundColor('#2474D4').fontColor(Color.White)
              .enabled(!this.submitting && !this.picking)
              .onClick(() => {
                this.submit();
              })
          }.width('100%').padding({ left: 16, right: 16, bottom: 24 })
        }.width('100%').layoutWeight(1).scrollBar(BarState.Off).align(Alignment.Top)
      }.width('100%').height('100%').backgroundColor('#F1F6F9')
      if (this.previewIndex >= 0 && this.previewIndex < this.pending.length) {
        this.previewSheet();
      }
    }.width('100%').height('100%')
  }
}
