import { ApiClient, ApiRequestError } from '../../core/network/ApiClient';
import { ApiConfig } from '../../core/network/ApiConfig';
import { ApiPage } from '../../core/network/ApiContract';
import { SessionStore } from '../../core/auth/SessionStore';
import { SessionService } from '../../core/auth/SessionService';

export interface FollowResult { id: string; following: boolean; }
export interface FollowView extends FollowResult { displayName: string; }
export interface CircleView {
  id: string; name: string; description: string; category: string; coverUrl: string | null;
  archived: boolean; joined: boolean; memberCount: number; postCount: number; canManage: boolean; canPost: boolean;
}
export interface CircleDraft {
  name: string; description: string; category: string; coverUrl: string; archived: boolean; createRequestKey: string;
}
export interface CircleParam { circleId: string; }
export interface CheckInView {
  day: string; checkedIn: boolean; streak: number; points: number; rewards: number[]; nextReward: number; nextDayAt: string;
}
export interface PointEntry { id: string; source: string; amount: number; description: string; createdAt: string; }
const ROOT: string = '/api/v1/forum';

async function token(required: boolean = true): Promise<string> {
  const stamp: string = SessionService.sessionStamp();
  const value: string = await SessionStore.readToken();
  if ((required && value === '') || stamp !== SessionService.sessionStamp()) {
    throw new ApiRequestError('UNAUTHENTICATED', '请先登录', 401, '');
  }
  return value;
}

export class CommunityService {
  static async following(page: number): Promise<ApiPage<FollowView>> {
    return ApiClient.getPage<FollowView>(ApiConfig.getBaseUrl(), `${ROOT}/me/following?page=${page}`, await token());
  }
  static async follow(id: string, following: boolean): Promise<FollowResult> {
    const path: string = `${ROOT}/users/${encodeURIComponent(id)}/follow`;
    if (following) return ApiClient.post<FollowResult>(ApiConfig.getBaseUrl(), path, '{}', await token());
    return ApiClient.del<FollowResult>(ApiConfig.getBaseUrl(), path, await token());
  }
  static async circles(page: number, joined: boolean = false, category: string = ''): Promise<ApiPage<CircleView>> {
    const filter: string = category === '' ? '' : `&category=${encodeURIComponent(category)}`;
    return ApiClient.getPage<CircleView>(ApiConfig.getBaseUrl(), `${ROOT}/circles?page=${page}&joined=${joined}${filter}`, await token(joined));
  }
  static async circleCategories(): Promise<string[]> {
    return ApiClient.get<string[]>(ApiConfig.getBaseUrl(), `${ROOT}/circles?view=categories`, '');
  }
  static async circle(id: string): Promise<CircleView> {
    return ApiClient.get<CircleView>(ApiConfig.getBaseUrl(), `${ROOT}/circles/${encodeURIComponent(id)}`, await token(false));
  }
  static async join(id: string, joined: boolean): Promise<CircleView> {
    const path: string = `${ROOT}/circles/${encodeURIComponent(id)}/membership`;
    if (joined) return ApiClient.post<CircleView>(ApiConfig.getBaseUrl(), path, '{}', await token());
    return ApiClient.del<CircleView>(ApiConfig.getBaseUrl(), path, await token());
  }
  static async saveCircle(id: string, draft: CircleDraft): Promise<CircleView> {
    return ApiClient.post<CircleView>(ApiConfig.getBaseUrl(), `${ROOT}/circles${id === '' ? '' : '/' + encodeURIComponent(id)}`,
      JSON.stringify(draft), await token());
  }
  static async checkInStatus(): Promise<CheckInView> {
    return ApiClient.get<CheckInView>(ApiConfig.getBaseUrl(), `${ROOT}/me/check-in`, await token());
  }
  static async checkIn(): Promise<CheckInView> {
    return ApiClient.post<CheckInView>(ApiConfig.getBaseUrl(), `${ROOT}/me/check-in`, '{}', await token());
  }
  static async points(page: number): Promise<ApiPage<PointEntry>> {
    return ApiClient.getPage<PointEntry>(ApiConfig.getBaseUrl(), `${ROOT}/me/points?page=${page}`, await token());
  }
}
