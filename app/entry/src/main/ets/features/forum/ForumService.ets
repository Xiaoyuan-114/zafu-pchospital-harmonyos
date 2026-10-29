import { util } from '@kit.ArkTS';
import { ApiClient, ApiRequestError, MultipartFilePart } from '../../core/network/ApiClient';
import { ApiConfig } from '../../core/network/ApiConfig';
import { ApiPage } from '../../core/network/ApiContract';
import { SessionStore } from '../../core/auth/SessionStore';
import { SessionService } from '../../core/auth/SessionService';
import { PickedImage } from '../repair/PhotoPicker';
import { ForumCommentView, ForumImageView, ForumPostDraft, ForumPostView } from './ForumContract';

const POSTS_PATH: string = '/api/v1/forum/posts';
const MY_POSTS_PATH: string = '/api/v1/forum/me/posts';
const COMMENTS_PATH: string = '/api/v1/forum/comments';
const PAGE_SIZE: number = 20;

async function optionalToken(): Promise<string> {
  return SessionStore.readToken();
}

/** 写请求只使用发起时仍属于当前会话的令牌；作者与权限由服务端认定。 */
async function requireToken(): Promise<string> {
  if (ApiConfig.getBaseUrl() === '') {
    throw new ApiRequestError('NETWORK_ERROR', '服务器地址未配置，请回到登录页填写', 0, '');
  }
  const sessionStamp: string = SessionService.sessionStamp();
  const token: string = await SessionStore.readToken();
  if (token === '') {
    throw new ApiRequestError('UNAUTHENTICATED', '请先登录', 0, '');
  }
  if (SessionService.sessionStamp() !== sessionStamp) {
    throw new ApiRequestError('UNAUTHENTICATED', '登录状态已变更，请重新登录', 0, '');
  }
  return token;
}

function encodeId(id: string): string {
  return encodeURIComponent(id);
}

function textData(value: string): ArrayBuffer {
  const bytes: Uint8Array = new util.TextEncoder().encodeInto(value);
  return bytes.buffer as ArrayBuffer;
}

export class ForumService {
  static async listPosts(category: string, query: string, page: number): Promise<ApiPage<ForumPostView>> {
    return ApiClient.getPage<ForumPostView>(
      ApiConfig.getBaseUrl(),
      `${POSTS_PATH}?category=${encodeURIComponent(category)}&q=${encodeURIComponent(query)}&page=${page}&pageSize=${PAGE_SIZE}`,
      await optionalToken()
    );
  }

  static async detail(id: string): Promise<ForumPostView> {
    return ApiClient.get<ForumPostView>(
      ApiConfig.getBaseUrl(),
      `${POSTS_PATH}/${encodeId(id)}`,
      await optionalToken()
    );
  }

  static async listComments(id: string, page: number): Promise<ApiPage<ForumCommentView>> {
    return ApiClient.getPage<ForumCommentView>(
      ApiConfig.getBaseUrl(),
      `${POSTS_PATH}/${encodeId(id)}/comments?page=${page}&pageSize=${PAGE_SIZE}`,
      await optionalToken()
    );
  }

  static async listMine(page: number): Promise<ApiPage<ForumPostView>> {
    return ApiClient.getPage<ForumPostView>(
      ApiConfig.getBaseUrl(),
      `${MY_POSTS_PATH}?page=${page}&pageSize=${PAGE_SIZE}`,
      await requireToken()
    );
  }

  static async createPost(draft: ForumPostDraft): Promise<ForumPostView> {
    return ApiClient.post<ForumPostView>(
      ApiConfig.getBaseUrl(),
      POSTS_PATH,
      JSON.stringify(draft),
      await requireToken()
    );
  }

  /** 每张图片后紧跟其 uploadKey，保持后端要求的逐图配对顺序。 */
  static async uploadImages(id: string, images: PickedImage[], keys: string[]): Promise<ForumImageView[]> {
    const parts: MultipartFilePart[] = [];
    for (let index: number = 0; index < images.length; index += 1) {
      const image: PickedImage = images[index];
      parts.push({
        name: 'photos',
        contentType: image.mimeType,
        fileName: image.fileName,
        data: image.data
      });
      parts.push({
        name: 'uploadKeys',
        contentType: 'text/plain; charset=utf-8',
        fileName: '',
        data: textData(keys[index])
      });
    }
    return ApiClient.postMultipart<ForumImageView[]>(
      ApiConfig.getBaseUrl(),
      `${POSTS_PATH}/${encodeId(id)}/images`,
      parts,
      await requireToken()
    );
  }

  static async createComment(id: string, body: string, key: string): Promise<ForumCommentView> {
    return ApiClient.post<ForumCommentView>(
      ApiConfig.getBaseUrl(),
      `${POSTS_PATH}/${encodeId(id)}/comments`,
      JSON.stringify({ body: body, createRequestKey: key }),
      await requireToken()
    );
  }

  static async deletePost(id: string): Promise<void> {
    await ApiClient.del<Object>(
      ApiConfig.getBaseUrl(),
      `${POSTS_PATH}/${encodeId(id)}`,
      await requireToken()
    );
  }

  static async deleteComment(id: string): Promise<void> {
    await ApiClient.del<Object>(
      ApiConfig.getBaseUrl(),
      `${COMMENTS_PATH}/${encodeId(id)}`,
      await requireToken()
    );
  }

  /** 图片内容为公开二进制响应，不按 JSON 信封解析。 */
  static async imageBytes(path: string): Promise<ArrayBuffer> {
    return ApiClient.getBytes(ApiConfig.getBaseUrl(), path, '');
  }

  /** 同一发布/评论意图在结果确认前复用此键。 */
  static newCreateRequestKey(): string {
    return `native-forum-create-${util.generateRandomUUID(true)}`;
  }

  /** 每张图片在一次上传意图内持有独立且稳定的键。 */
  static newUploadKey(): string {
    return `native-forum-upload-${util.generateRandomUUID(true)}`;
  }
}
