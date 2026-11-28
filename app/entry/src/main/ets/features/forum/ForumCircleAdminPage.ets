import { ApiRequestError } from '../../core/network/ApiClient';
import { SessionService } from '../../core/auth/SessionService';
import { CircleDraft, CircleParam, CircleView, CommunityService } from './CommunityService';
import { ForumService } from './ForumService';
import { FORUM_ACCENT, FORUM_BACKGROUND, FORUM_INK } from './ForumTheme';

@Component
export struct ForumCircleAdminPage {
  param: CircleParam = { circleId: '' };
  onChanged: () => void = () => {};
  onOpen: (route: string, param: Object | null) => void = () => {};
  @State name: string = '';
  @State description: string = '';
  @State category: string = '';
  @State coverUrl: string = '';
  @State archived: boolean = false;
  @State busy: boolean = false;
  @State error: string = '';
  @State success: string = '';
  private requestKey: string = ForumService.newCreateRequestKey();
  private disposed: boolean = false;
  aboutToAppear(): void { this.disposed = false; if (this.param.circleId !== '') this.load(); }
  aboutToDisappear(): void { this.disposed = true; }
  private apply(circle: CircleView): void {
    this.name = circle.name; this.description = circle.description; this.category = circle.category;
    this.coverUrl = circle.coverUrl ?? ''; this.archived = circle.archived;
  }
  private async load(): Promise<void> {
    const stamp: string = SessionService.sessionStamp(); this.busy = true;
    try { const circle = await CommunityService.circle(this.param.circleId);
      if (!this.disposed && stamp === SessionService.sessionStamp()) this.apply(circle);
    } catch (error) { if (!this.disposed) this.error = (error as ApiRequestError).message; }
    finally { if (!this.disposed) this.busy = false; }
  }
  private async save(): Promise<void> {
    if (this.busy) return;
    const stamp: string = SessionService.sessionStamp();
    const draft: CircleDraft = { name: this.name, description: this.description, category: this.category,
      coverUrl: this.coverUrl, archived: this.archived, createRequestKey: this.requestKey };
    this.busy = true; this.error = ''; this.success = '';
    try {
      const circle = await CommunityService.saveCircle(this.param.circleId, draft);
      if (this.disposed || stamp !== SessionService.sessionStamp()) return;
      this.param = { circleId: circle.id }; this.apply(circle); this.success = '圈子已保存'; this.onChanged();
    } catch (error) { if (!this.disposed && stamp === SessionService.sessionStamp()) this.error = (error as ApiRequestError).message; }
    finally { if (!this.disposed && stamp === SessionService.sessionStamp()) this.busy = false; }
  }
  build() {
    Scroll() {
      Column({ space: 16 }) {
        Text(this.param.circleId === '' ? '创建校园圈子' : '管理圈子').fontSize(24).fontWeight(FontWeight.Bold).fontColor(FORUM_INK).width('100%')
        TextInput({ text: $$this.name, placeholder: '圈子名称，最多60字' }).maxLength(60).enabled(!this.busy)
        TextInput({ text: $$this.category, placeholder: '分类，例如电脑技术' }).maxLength(40).enabled(!this.busy)
        TextArea({ text: $$this.description, placeholder: '简介，最多1000字' }).maxLength(1000).height(150).enabled(!this.busy)
        TextInput({ text: $$this.coverUrl, placeholder: '封面 HTTPS 图片地址（选填）' }).maxLength(1000).enabled(!this.busy)
        Row() {
          Text('归档后停止加入与新发帖').fontSize(14).layoutWeight(1)
          Toggle({ type: ToggleType.Switch, isOn: this.archived }).enabled(!this.busy).onChange((value: boolean) => { this.archived = value; })
        }.width('100%')
        if (this.error !== '') { Text(this.error).fontColor('#B04438').fontSize(14).width('100%') }
        if (this.success !== '') { Text(this.success).fontColor('#267541').fontSize(14).width('100%') }
        Button(this.busy ? '保存中…' : '保存圈子').width('100%').fontColor(Color.White).backgroundColor(FORUM_ACCENT).enabled(!this.busy).onClick(() => { this.save(); })
        if (this.param.circleId !== '') {
          Button('查看圈子').width('100%').onClick(() => { this.onOpen('forum-circle', this.param); })
        }
      }.padding(20).width('100%')
    }.width('100%').height('100%').align(Alignment.Top).backgroundColor(FORUM_BACKGROUND)
  }
}
