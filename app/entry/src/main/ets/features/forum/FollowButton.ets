import { ApiRequestError } from '../../core/network/ApiClient';
import { SessionService } from '../../core/auth/SessionService';
import { CommunityService } from './CommunityService';
import { ForumAuthorView } from './ForumContract';
import { FORUM_ACCENT, FORUM_INK } from './ForumTheme';

@Component
export struct FollowButton {
  @Prop @Watch('syncAuthor') author: ForumAuthorView;
  @Prop @Watch('resumeFollow') authenticated: boolean = false;
  onLogin: () => void = () => {};
  onChanged: () => void = () => {};
  @State following: boolean = false;
  @State busy: boolean = false;
  @State error: string = '';
  private pending: boolean = false;
  private disposed: boolean = false;
  aboutToAppear(): void { this.disposed = false; this.syncAuthor(); }
  aboutToDisappear(): void { this.disposed = true; this.pending = false; }
  private syncAuthor(): void { this.following = this.author.following === true; }
  private resumeFollow(): void { if (this.authenticated && this.pending) { this.pending = false; this.toggle(); } }
  private async toggle(): Promise<void> {
    if (this.busy) return;
    if (!this.authenticated) { this.pending = true; this.onLogin(); return; }
    const stamp: string = SessionService.sessionStamp();
    const id: string = this.author.id;
    this.busy = true; this.error = '';
    try {
      const result = await CommunityService.follow(id, !this.following);
      if (this.disposed || stamp !== SessionService.sessionStamp() || id !== this.author.id) return;
      this.following = result.following; this.onChanged();
    } catch (error) {
      if (this.disposed || stamp !== SessionService.sessionStamp()) return;
      const api = error as ApiRequestError;
      this.error = api.message;
      if (api.code === 'UNAUTHENTICATED' || api.code === 'AUTH_SESSION_EXPIRED') this.onLogin();
    } finally { if (!this.disposed && stamp === SessionService.sessionStamp()) this.busy = false; }
  }
  build() {
    if (this.author.canFollow !== false) {
      Column({ space: 2 }) {
        Button(this.busy ? '处理中' : (this.following ? '已关注' : '关注')).height(32).fontSize(13)
          .fontColor(this.following ? FORUM_INK : FORUM_ACCENT).backgroundColor('#F3F5F7').borderRadius(20)
          .enabled(!this.busy).onClick(() => { this.toggle(); })
        if (this.error !== '') { Text(this.error).fontSize(10).fontColor('#B04438').constraintSize({ maxWidth: 120 }) }
      }
    }
  }
}
