import { ApiClient, ApiRequestError } from '../../core/network/ApiClient';
import { ApiConfig } from '../../core/network/ApiConfig';
import { ErrorPanel, LoadingPanel } from '../../core/ui/StatePanel';
import { ReferenceBanner, ReferenceSearch, REFERENCE_BACKGROUND } from '../../core/ui/ReferencePage';
import { ROUTE_ACTIVITY_DETAIL } from '../../core/ui/Routes';
import { ForumFeed } from '../forum/ForumFeed';
import { ActivityParam } from './ActivityContract';

interface RepairActivity {
  id: string;
  title: string;
  activityAt: string;
  capacity: number;
  signupOpensAt: string;
  signupClosesAt: string;
  status: string;
  registeredCount: number;
  remaining: number;
}

/** 公开活动列表；报名与现场流程通过原生子页接入。 */
@Component
export struct ActivityPage {
  onOpen: (route: string, param: Object | null) => void = () => {};
  onLogin: () => void = () => {};
  onSessionExpired: () => void = () => {};
  @Prop channel: string = '活动';
  @State query: string = '';
  @Prop forumRefreshVersion: number = 0;
  @State activities: RepairActivity[] = [];
  @State loading: boolean = false;
  @State errorText: string = '';
  private generation: number = 0;

  aboutToAppear(): void { this.load(); }
  aboutToDisappear(): void { this.generation += 1; }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    this.loading = true;
    this.errorText = '';
    try {
      const items = await ApiClient.get<RepairActivity[]>(ApiConfig.getBaseUrl(), '/api/v1/repair-activities', '');
      if (generation !== this.generation) return;
      this.activities = items;
    } catch (error) {
      if (generation !== this.generation) return;
      this.errorText = error instanceof ApiRequestError ? error.message : '活动加载失败，请重试';
    } finally {
      if (generation === this.generation) this.loading = false;
    }
  }

  private statusLabel(status: string): string {
    if (status === 'OPEN') return '报名中';
    if (status === 'FULL') return '已报满';
    if (status === 'CLOSED') return '报名截止';
    if (status === 'ENDED') return '已结束';
    return '未开始';
  }

  private dateText(value: string): string {
    // 公开接口返回 ISO，统一呈现北京时间。
    const time = new Date(new Date(value).getTime() + 8 * 3600000);
    return `${time.getUTCFullYear()}年${time.getUTCMonth() + 1}月${time.getUTCDate()}日 ${time.getUTCHours().toString().padStart(2, '0')}:${time.getUTCMinutes().toString().padStart(2, '0')}`;
  }

  private visibleActivities(): RepairActivity[] {
    return this.activities.filter((item: RepairActivity) => item.title.toLowerCase().includes(this.query.trim().toLowerCase()));
  }

  @Builder
  activityCard(item: RepairActivity) {
    Column({ space: 14 }) {
      Row({ space: 10 }) {
        Image($r('app.media.ref_activity')).width(36).height(36)
        Column({ space: 4 }) {
          Text('电脑医院 · 维修活动').fontSize(15).fontWeight(FontWeight.Bold)
          Text(this.dateText(item.activityAt)).fontSize(11).fontColor('#777E84')
        }.layoutWeight(1).alignItems(HorizontalAlign.Start)
        Text(this.statusLabel(item.status)).fontSize(12).fontColor('#137AE7')
          .padding({ left: 10, right: 10, top: 6, bottom: 6 }).backgroundColor('#F3F7FC').borderRadius(18)
      }.width('100%')
      Text(item.title).fontSize(17).fontWeight(FontWeight.Medium).width('100%')
      Image($r('app.media.ref_activity_hero')).width('100%').height(160).objectFit(ImageFit.Contain)
        .backgroundColor('#F1EBFF').borderRadius(12).accessibilityText('项目主题插画，非活动现场照片')
      Row() {
        Text(`已报名 ${item.registeredCount} · 剩余名额 ${item.remaining}`).fontSize(12).fontColor('#747A7F').layoutWeight(1)
        Text('活动详情 ›').fontSize(12).fontColor('#2474D4')
      }.width('100%')
    }.width('100%').padding(14).backgroundColor(Color.White).borderRadius(20)
      .alignItems(HorizontalAlign.Start)
      .onClick(() => {
        const param: ActivityParam = { activityId: item.id };
        this.onOpen(ROUTE_ACTIVITY_DETAIL, param);
      })
  }

  build() {
    Scroll() {
      Column({ space: 16 }) {
        Row({ space: 24 }) {
          ForEach(['活动', '论坛'], (name: string) => {
            Text(name).fontSize(this.channel === name ? 26 : 18)
              .fontWeight(this.channel === name ? FontWeight.Bold : FontWeight.Medium)
              .fontColor(this.channel === name ? '#111416' : '#6E7376')
              .padding({ top: 10, bottom: 10 })
              .onClick(() => { this.channel = name; })
          })
        }.height(50)
        if (this.channel === '活动') {
          ReferenceSearch({ text: $query, placeholder: '搜索社团维修活动' })
          ReferenceBanner({
            title: '电脑医院  校园同行', subtitle: '真实维修活动 · 报名与现场服务', image: $r('app.media.ref_activity_hero'),
            violet: true
          })
          if (this.loading) {
            LoadingPanel({ text: '正在加载活动…' })
          } else if (this.errorText !== '') {
            ErrorPanel({ message: this.errorText, onRetry: (): void => { this.load(); } })
          } else if (this.visibleActivities().length === 0) {
            Column({ space: 10 }) {
              Image($r('app.media.ref_activity')).width(44).height(44)
              Text(this.query.trim() === '' ? '暂未发布维修活动' : '没有匹配的活动').fontSize(16)
              Button('刷新活动').fontSize(13).backgroundColor('#F1F6FD').fontColor('#2677DB').onClick(() => { this.load(); })
            }.width('100%').padding(24).backgroundColor(Color.White).borderRadius(20)
          } else {
            ForEach(this.visibleActivities(), (item: RepairActivity) => { this.activityCard(item); }, (item: RepairActivity) => item.id)
            Button('刷新活动').fontSize(13).onClick(() => { this.load(); })
          }
        } else {
          ForumFeed({
            refreshVersion: this.forumRefreshVersion,
            onOpen: this.onOpen,
            onLogin: this.onLogin,
            onSessionExpired: this.onSessionExpired
          })
        }
      }.width('100%').padding({ left: 16, right: 16, bottom: 90 }).alignItems(HorizontalAlign.Start)
    }.width('100%').height('100%').scrollBar(BarState.Off).align(Alignment.Top).backgroundColor(REFERENCE_BACKGROUND)
  }
}
