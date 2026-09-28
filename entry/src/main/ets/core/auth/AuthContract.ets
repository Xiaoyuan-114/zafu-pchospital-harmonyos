// 待实验后端的原生客户端鉴权契约确认后再实现令牌获取与持久化。
export interface SessionIdentity {
  userId: string;
  displayName: string;
  roles: string[];
  permissions: string[];
  expiresAt: string;
}
