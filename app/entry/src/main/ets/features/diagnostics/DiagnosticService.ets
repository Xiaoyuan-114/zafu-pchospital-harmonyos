import { ApiClient, ApiRequestError } from '../../core/network/ApiClient';
import { ApiConfig } from '../../core/network/ApiConfig';
import { SessionStore } from '../../core/auth/SessionStore';
import {
  DiagnosticCatalog,
  DiagnosticSessionView,
  DiagnosticSubmitRequest,
} from './DiagnosticContract';

const CATALOG_PATH: string = '/api/v1/diagnostics/catalog';
const SESSIONS_PATH: string = '/api/v1/customer/diagnostics/sessions';
/** 检测记录最多一次取 20 条：足够回看近期问诊，不做无限滚动。 */
const PAGE_SIZE: number = 20;

/**
 * 检测服务（Issue #102）。
 *
 * 与 RepairOrderService / DeviceService 同一套路：地址取自 ApiConfig、
 * 令牌取自 SessionStore。结论一律由服务端返回，本类不做任何判定。
 */
export class DiagnosticService {
  private static baseUrl(): string {
    return ApiConfig.getBaseUrl();
  }

  private static async token(): Promise<string> {
    return await SessionStore.readToken();
  }

  private static ensureReady(): void {
    if (DiagnosticService.baseUrl() === '') {
      throw new ApiRequestError('NETWORK_ERROR', '服务器地址未配置，请回到登录页填写', 0, '');
    }
  }

  private static async requireToken(): Promise<string> {
    const token: string = await DiagnosticService.token();
    if (token === '') {
      throw new ApiRequestError('UNAUTHENTICATED', '登录状态已失效，请重新登录', 0, '');
    }
    return token;
  }

  /** 故障分类目录（含问题与选项）。 */
  static async catalog(): Promise<DiagnosticCatalog> {
    DiagnosticService.ensureReady();
    const token: string = await DiagnosticService.requireToken();
    return await ApiClient.get<DiagnosticCatalog>(DiagnosticService.baseUrl(), CATALOG_PATH, token);
  }

  /** 提交一次问答，拿回服务端算好的结论。 */
  static async submit(request: DiagnosticSubmitRequest): Promise<DiagnosticSessionView> {
    DiagnosticService.ensureReady();
    const token: string = await DiagnosticService.requireToken();
    return await ApiClient.post<DiagnosticSessionView>(
      DiagnosticService.baseUrl(),
      SESSIONS_PATH,
      JSON.stringify(request),
      token
    );
  }

  /** 本人的检测记录，按时间倒序。 */
  static async listMine(page: number = 1): Promise<DiagnosticSessionView[]> {
    DiagnosticService.ensureReady();
    const token: string = await DiagnosticService.requireToken();
    const items = await ApiClient.get<DiagnosticSessionView[]>(
      DiagnosticService.baseUrl(),
      `${SESSIONS_PATH}?page=${page}&pageSize=${PAGE_SIZE}`,
      token
    );
    return items === undefined || items === null ? [] : items;
  }
}
