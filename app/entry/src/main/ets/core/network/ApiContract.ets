// 仅描述原 Web API 已核实的信封；端点和 Bearer 通道仍待实验后端实现。
export interface ApiMeta {
  requestId: string;
}

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiFailure {
  success: false;
  error: ApiError;
  meta: ApiMeta;
}
