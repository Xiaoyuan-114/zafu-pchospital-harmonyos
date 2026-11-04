import { SessionIdentity } from '../../core/auth/AuthContract';
import { SessionService } from '../../core/auth/SessionService';
import { ApiRequestError, isSessionExpiredCode } from '../../core/network/ApiClient';
import { LoadingPanel, ErrorPanel } from '../../core/ui/StatePanel';
import { ROUTE_STAFF_RECORD } from '../../core/ui/Routes';
import { StaffRecordParam, repairRecordStatusLabel } from '../repair/StaffRepairContract';
import { ActivityParam, ActivityBoard, StaffRegistration, ServedRegistration, CheckInInput, activityIssueLabel, activityTime } from './ActivityContract';
import { ActivityIssueSelector } from './ActivityWidgets';
import { ActivityService } from './ActivityService';
import { ActivityRequestGuard } from './ActivityRequestGuard';
@Component
export struct ActivityBoardPage {
  param: ActivityParam = { activityId: '' };
  @Prop @Watch('refresh') refreshVersion: number = 0;
  onOpen: (route: string, param: Object | null) => void = () => {};
  onSessionExpired: () => void = () => {};
  @State board: ActivityBoard | null = null;
  @State tab: string = '待签到';
  @State query: string = '';
  @State selectedId: string = '';
  @State selectedIssueType: string = 'OTHER';
  @State phoneText: string = '';
  @State phoneId: string = '';
  @State loading: boolean = false;
  @State busy: boolean = false;
  @State errorText: string = '';
  private loadedIdentity: SessionIdentity | null = SessionService.current();
  private retryCancellation: boolean = false;
  private guard: ActivityRequestGuard = new ActivityRequestGuard();
  aboutToAppear(): void { this.load(); }
  aboutToDisappear(): void { this.guard.invalidate(); this.loading = false; this.busy = false; this.phoneText = ''; this.phoneId = ''; this.retryCancellation = false; }
  private refresh(): void { this.guard.invalidate(); this.loading = false; this.busy = false; this.load(); }
  private fail(error: Object): void {
    if (error instanceof ApiRequestError && isSessionExpiredCode(error.code)) { this.onSessionExpired(); return; }
    this.errorText = error instanceof ApiRequestError ? error.message : '现场操作失败，请重试';
  }
  private async load(): Promise<void> {
    if (this.loading || this.busy) return;
    if (this.loadedIdentity !== SessionService.current()) {
      this.loadedIdentity = SessionService.current(); this.board = null; this.query = '';
    }
    const ticket = this.guard.begin(); this.loading = true; this.errorText = ''; this.retryCancellation = false;
    this.phoneId = ''; this.phoneText = ''; this.selectedId = '';
    try { const board = await ActivityService.board(this.param.activityId); if (this.guard.current(ticket)) this.board = board; }
    catch (error) {
      if (this.guard.current(ticket)) { this.board = null; this.fail(error); }
    }
    finally { if (this.guard.current(ticket)) this.loading = false; }
  }
  private openRecord(id: string): void {
    if (id === '') return;
    const param: StaffRecordParam = { recordId: id, faultDescription: '' }; this.onOpen(ROUTE_STAFF_RECORD, param);
  }
  private async action(kind: string, id: string = ''): Promise<void> {
    if (this.busy || this.loading) return;
    if (this.loadedIdentity !== SessionService.current()) { await this.load(); return; }
    const ticket = this.guard.begin(); this.busy = true; this.errorText = ''; this.retryCancellation = false;
    try {
      if (kind === 'attendance') await ActivityService.attend(this.param.activityId);
      else if (kind === 'cancel-attendance') {
        const answer = await this.getUIContext().getPromptAction().showDialog({ title: '取消本场出勤？',
          message: '只取消你本人的出勤，不影响客户报名、排队或已有备案。未进行现场处理时才能取消。',
          buttons: [{ text: '返回', color: '#69747C' }, { text: '确认取消出勤', color: '#D23F3F' }] });
        if (!this.guard.current(ticket)) return;
        if (answer.index !== 1) return;
        await ActivityService.cancelAttendance(this.param.activityId);
      } else if (kind === 'check-in') {
        const input: CheckInInput = { registrationIds: [id], issueTypeUpdates: [{ registrationId: id, issueType: this.selectedIssueType }] };
        await ActivityService.checkIn(this.param.activityId, input);
      } else if (kind === 'withdraw') {
        const answer = await this.getUIContext().getPromptAction().showDialog({ title: '撤回客户排队？', message: '客户将返回待签到列表，报名和占用名额保留。',
          buttons: [{ text: '返回', color: '#69747C' }, { text: '撤回排队', color: '#D23F3F' }] });
        if (!this.guard.current(ticket)) return;
        if (answer.index !== 1) { this.busy = false; return; }
        await ActivityService.withdraw(this.param.activityId, id);
      } else if (kind === 'serve') {
        const result = await ActivityService.serve(this.param.activityId, id);
        if (!this.guard.current(ticket)) return;
        this.busy = false; this.board = null;
        this.openRecord(result.repairRecordId); return;
      } else if (kind === 'phone') {
        const result = await ActivityService.phone(this.param.activityId, id);
        if (!this.guard.current(ticket)) return;
        this.phoneId = id; this.phoneText = result.phone; return;
      }
      if (!this.guard.current(ticket)) return; this.busy = false; await this.load();
    } catch (error) {
      if (!this.guard.current(ticket)) return;
      this.retryCancellation = kind === 'cancel-attendance';
      this.fail(error);
      if (error instanceof ApiRequestError && error.code === 'ACTIVITY_SERVE_DRAFT_PENDING') {
        this.busy = false; await this.load(); this.errorText = error.message;
      }
    } finally { if (this.guard.current(ticket)) this.busy = false; }
  }
  private matches(item: StaffRegistration): boolean {
    const query = this.query.trim(); return item.name.includes(query) || item.phoneMasked.includes(query) || activityIssueLabel(item.issueType).includes(query);
  }
  private rows(): StaffRegistration[] {
    if (this.board === null) return [];
    return (this.tab === '待签到' ? this.board.eligible : this.board.queue).filter((item: StaffRegistration) => this.matches(item));
  }
  private served(): ServedRegistration[] {
    return this.board === null ? [] : this.board.served.filter((item: ServedRegistration) => this.matches(item));
  }
  @Builder
  row(item: StaffRegistration) {
    Column({ space: 10 }) {
      Row() {
        Text(item.name).fontSize(17).fontWeight(FontWeight.Bold).fontColor('#1B2732').layoutWeight(1)
        Text(item.phoneMasked).fontSize(13).fontColor('#697786')
      }.width('100%')
      Text(`${activityIssueLabel(item.issueType)} · ${item.deviceModel === null ? '机型未填写' : item.deviceModel}`)
        .width('100%').fontSize(13).fontColor('#697786')
      if (item.status === 'CHECKED_IN') { Text(`签到：${activityTime(item.checkedInAt)}`).fontSize(12).fontColor('#697786').width('100%') }
      if (this.phoneId === item.id && this.phoneText !== '') {
        Row() {
          Text(this.phoneText).layoutWeight(1)
          Button('隐藏').height(36).fontSize(13).fontColor('#315F93').backgroundColor('#EAF3FB')
            .onClick(() => { this.phoneText = ''; this.phoneId = ''; })
        }.width('100%')
      } else {
        Button('查看完整电话').height(36).fontSize(13).fontColor('#315F93').backgroundColor('#EAF3FB')
          .enabled(!this.busy && !this.loading).onClick(() => { this.action('phone', item.id); })
      }
      if (this.board !== null && this.board.attended && item.status === 'REGISTERED') {
        if (this.selectedId === item.id) {
          ActivityIssueSelector({ value: this.selectedIssueType, disabled: this.busy, onChange: (value: string): void => { this.selectedIssueType = value; } })
          Button('确认类型并签到入队').height(42).fontSize(14).backgroundColor('#2465AD')
            .enabled(!this.busy && this.board.activity.canOperateStaff).onClick(() => { this.action('check-in', item.id); })
        } else {
          Button('签到 / 调整故障类型').height(42).fontSize(14).backgroundColor('#2465AD').enabled(!this.busy && this.board.activity.canOperateStaff)
            .onClick(() => { this.selectedId = item.id; this.selectedIssueType = item.issueType; })
        }
      }
      if (this.board !== null && this.board.attended && item.status === 'CHECKED_IN') {
        Row({ space: 10 }) {
          Button('接待并填写备案').height(42).fontSize(14).backgroundColor('#2465AD').enabled(!this.busy && this.board.activity.canOperateStaff && this.board.pendingServeDraft === null)
            .onClick(() => { this.action('serve', item.id); })
          Button('撤回排队').height(42).fontSize(14).fontColor('#536D86').backgroundColor('#EAF1F7').enabled(!this.busy).onClick(() => { this.action('withdraw', item.id); })
        }.width('100%')
      }
    }.width('100%').padding(16).backgroundColor(Color.White).borderRadius(16).alignItems(HorizontalAlign.Start)
  }
  build() {
    Column({ space: 12 }) {
      Row() {
        Text('现场进度').fontSize(14).fontColor('#697786').layoutWeight(1)
        Button('刷新').height(36).fontSize(13).fontColor('#315F93').backgroundColor('#E3EDF7')
          .enabled(!this.loading && !this.busy).onClick(() => { this.load(); })
      }.width('100%')
      if (this.loading) { LoadingPanel({ text: '正在读取现场看板…' }) }
      if (this.busy) { LoadingPanel({ text: '正在处理…' }) }
      if (this.errorText !== '') { ErrorPanel({ message: this.errorText, onRetry: (): void => { if (this.retryCancellation) this.action('cancel-attendance'); else this.load(); } }) }
      if (this.board !== null) {
        Column({ space: 10 }) {
          Text(this.board.activity.title).fontSize(18).lineHeight(27).fontWeight(FontWeight.Bold).fontColor('#1B2732').width('100%')
          if (!this.board.activity.canOperateStaff) { Text('报名截止后开放出勤、签到和接待').fontSize(13).fontColor('#697786').width('100%') }
          if (!this.board.attended) {
            Row() {
              Text('本场未出勤').fontSize(13).fontColor('#697786').layoutWeight(1)
              Button('标记出勤').height(40).fontSize(14).backgroundColor('#2465AD')
                .enabled(!this.busy && this.board.activity.canOperateStaff).onClick(() => { this.action('attendance'); })
            }.width('100%')
          } else {
            Row() {
              Text(`已出勤 · ${activityTime(this.board.attendanceCheckedInAt)}`).fontSize(13).fontColor('#315F93').layoutWeight(1)
              if (this.board.canCancelAttendance) {
                Button('取消出勤').height(40).fontSize(13).fontColor('#536D86').backgroundColor('#EAF1F7')
                  .enabled(!this.busy).onClick(() => { this.action('cancel-attendance'); })
              }
            }.width('100%')
            if (!this.board.canCancelAttendance && this.board.attendanceCancelBlockedReason !== null) {
              Text(this.board.attendanceCancelBlockedReason).fontSize(12).fontColor('#697786').width('100%')
            }
          }
        }.width('100%').padding(16).backgroundColor(Color.White).borderRadius(16).alignItems(HorizontalAlign.Start)
        if (this.board.pendingServeDraft !== null) {
          Column({ space: 8 }) {
            Text(`待填写备案 · ${this.board.pendingServeDraft.ownerName}`).fontSize(14).fontWeight(FontWeight.Medium).fontColor('#1B2732').width('100%')
            Text(this.board.pendingServeDraft.activityTitle).fontSize(12).fontColor('#697786').maxLines(2)
              .textOverflow({ overflow: TextOverflow.Ellipsis }).width('100%')
            Button('继续填写备案').height(40).fontSize(14).backgroundColor('#2465AD').enabled(!this.busy)
              .onClick(() => { if (this.board !== null && this.board.pendingServeDraft !== null) this.openRecord(this.board.pendingServeDraft.repairRecordId); })
          }.width('100%').padding(14).backgroundColor('#EAF3FB').borderRadius(16).alignItems(HorizontalAlign.Start)
        }
        Row({ space: 8 }) {
          ForEach(['待签到', '排队中', '已接待'], (label: string) => {
            Button(label).fontSize(13).height(38).backgroundColor(this.tab === label ? '#2465AD' : '#E3EDF5')
              .fontColor(this.tab === label ? Color.White : '#324353').enabled(!this.busy)
              .onClick(() => { this.tab = label; this.selectedId = ''; this.phoneText = ''; this.phoneId = ''; })
          })
        }.width('100%')
        TextInput({ text: this.query, placeholder: '姓名、电话尾号或故障类型' }).onChange((value: string) => { this.query = value; this.phoneText = ''; })
        Text(`待签到 ${this.board.eligible.length} · 排队 ${this.board.queue.length} · 已接待 ${this.board.served.length}`)
          .fontSize(12).fontColor('#697786').width('100%')
        List({ space: 12 }) {
          if (this.tab === '已接待') {
            ForEach(this.served(), (item: ServedRegistration) => {
              ListItem() {
                Column() {
                  this.row(item)
                  Row({ space: 8 }) {
                    Text(`备案：${item.recordStatus === null ? '不可用' : repairRecordStatusLabel(item.recordStatus)}`)
                      .fontSize(13).fontColor('#697786').layoutWeight(1)
                    if (item.repairRecordId !== null && item.recordStatus !== null && item.canOpenRecord) {
                      Button('查看备案').height(36).fontSize(13).fontColor('#315F93').backgroundColor('#EAF3FB')
                        .enabled(!this.busy).onClick(() => { if (item.repairRecordId !== null) this.openRecord(item.repairRecordId); })
                    }
                  }.width('100%').padding({ left: 16, right: 16, bottom: 16 })
                }.width('100%').backgroundColor(Color.White).borderRadius(16)
              }
            }, (item: ServedRegistration) => JSON.stringify(item))
          } else {
            ForEach(this.rows(), (item: StaffRegistration) => { ListItem() { this.row(item) } }, (item: StaffRegistration) => JSON.stringify(item))
          }
          if ((this.tab === '已接待' ? this.served().length : this.rows().length) === 0) {
            ListItem() {
              Column() {
                Text(this.query.trim() === '' ? `${this.tab}暂无报名` : '没有匹配的报名').fontSize(14).fontColor('#697786')
              }.width('100%').padding(24).backgroundColor(Color.White).borderRadius(16)
            }
          }
        }.width('100%').layoutWeight(1)
      }
    }.width('100%').height('100%').padding(16).backgroundColor('#F0F5F8')
  }
}
