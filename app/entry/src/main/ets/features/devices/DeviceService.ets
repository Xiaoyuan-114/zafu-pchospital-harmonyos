import { ApiClient, ApiRequestError } from '../../core/network/ApiClient';
import { ApiConfig } from '../../core/network/ApiConfig';
import { SessionStore } from '../../core/auth/SessionStore';
import {
  BenefitView,
  DeviceCreateRequest,
  DeviceDetailView,
  DeviceView,
} from './DeviceContract';

const LIST_PATH: string = '/api/v1/customer/devices';
const DETAIL_PATH_PREFIX: string = '/api/v1/customer/devices/';
/** 设备数量本就有限，一次取满一页（后端上限 100）避免"我的设备"出现加载更多。 */
const PAGE_SIZE: number = 50;

/**
 * 客户设备与权益服务（Issue #102）。
 *
 * 与 RepairOrderService 同一套路：地址取自 ApiConfig，令牌取自 SessionStore，
 * 归属一律由服务端按令牌判定 —— 客户端不传 ownerUserId，也传了不算。
 *
 * ⚠️ 这里**没有**登记/修改权益的方法：权益只能由工作人员登记，
 * 客户侧是只读的。别为了"演示方便"在客户端补一个写接口。
 *
 * ⚠️ PATCH 用 POST + `X-HTTP-Method-Override`：鸿蒙 API 24 的
 * `http.RequestMethod` 枚举里没有 PATCH，服务端为此开了兼容入口
 * （见 backend/docs/devices-benefits-api.md）。
 */
export class DeviceService {
  /** 读当前令牌；空串表示未登录，调用方应回登录页。 */
  private static async token(): Promise<string> {
    return await SessionStore.readToken();
  }

  private static baseUrl(): string {
    return ApiConfig.getBaseUrl();
  }

  private static ensureReady(): void {
    if (DeviceService.baseUrl() === '') {
      throw new ApiRequestError('NETWORK_ERROR', '服务器地址未配置，请回到登录页填写', 0, '');
    }
  }

  private static async requireToken(): Promise<string> {
    const token: string = await DeviceService.token();
    if (token === '') {
      throw new ApiRequestError('UNAUTHENTICATED', '登录状态已失效，请重新登录', 0, '');
    }
    return token;
  }

  /**
   * 本人设备列表。
   *
   * 后端把分页放信封 meta，ApiClient 只拆 `data`，故这里只拿 items。
   * 默认只返回 `ACTIVE`；要看已解绑记录显式传 status='RETIRED'。
   */
  static async listMine(status: string = '', page: number = 1): Promise<DeviceView[]> {
    DeviceService.ensureReady();
    const token: string = await DeviceService.requireToken();
    const params: string[] = [];
    params.push(`page=${page}`);
    params.push(`pageSize=${PAGE_SIZE}`);
    if (status !== '') {
      params.push(`status=${status}`);
    }
    const path: string = `${LIST_PATH}?${params.join('&')}`;
    const items = await ApiClient.get<DeviceView[]>(DeviceService.baseUrl(), path, token);
    // 服务端历史数据若把 items 返回成 null，界面按空列表处理而不是崩溃。
    return items === undefined || items === null ? [] : items;
  }

  /** 设备详情（含权益与最近报修）。非本人的设备后端返回 404 DEVICE_NOT_FOUND。 */
  static async detail(id: string): Promise<DeviceDetailView> {
    DeviceService.ensureReady();
    const token: string = await DeviceService.requireToken();
    return await ApiClient.get<DeviceDetailView>(
      DeviceService.baseUrl(),
      `${DETAIL_PATH_PREFIX}${id}`,
      token
    );
  }

  /**
   * 绑定一台设备。
   *
   * 不提交 `source`：由服务端判定为 `SELF`。序列号撞上自己已解绑的同一台机器时，
   * 服务端会复活原记录并返回它，客户端表现与新增一致，无需特殊处理。
   */
  static async create(request: DeviceCreateRequest): Promise<DeviceView> {
    DeviceService.ensureReady();
    const token: string = await DeviceService.requireToken();
    return await ApiClient.post<DeviceView>(
      DeviceService.baseUrl(),
      LIST_PATH,
      JSON.stringify(request),
      token
    );
  }

  /** 编辑设备：走 POST + X-HTTP-Method-Override，语义等同 PATCH。 */
  static async update(id: string, request: DeviceCreateRequest): Promise<DeviceView> {
    DeviceService.ensureReady();
    const token: string = await DeviceService.requireToken();
    const headers: Record<string, string> = {};
    headers['X-HTTP-Method-Override'] = 'PATCH';
    return await ApiClient.postWithHeaders<DeviceView>(
      DeviceService.baseUrl(),
      `${DETAIL_PATH_PREFIX}${id}`,
      JSON.stringify(request),
      token,
      headers
    );
  }

  /**
   * 解绑设备（软删）。
   * 该设备还有未完成的报修单时后端返回 409 DEVICE_IN_USE，此处原样抛出，
   * 由页面翻译成「还有维修中的单，暂不能解绑」。
   */
  static async remove(id: string): Promise<void> {
    DeviceService.ensureReady();
    const token: string = await DeviceService.requireToken();
    await ApiClient.del<Object>(DeviceService.baseUrl(), `${DETAIL_PATH_PREFIX}${id}`, token);
  }

  /** 单台设备的权益列表：只刷权益时用，不必重拉设备与报修记录。 */
  static async listBenefits(deviceId: string): Promise<BenefitView[]> {
    DeviceService.ensureReady();
    const token: string = await DeviceService.requireToken();
    const items = await ApiClient.get<BenefitView[]>(
      DeviceService.baseUrl(),
      `${DETAIL_PATH_PREFIX}${deviceId}/benefits`,
      token
    );
    return items === undefined || items === null ? [] : items;
  }
}
