import { AppError } from "@/lib/api/errors";
import { getDb } from "@/lib/db/client";

/**
 * 成员资料数据访问（M3 任务书 §9）。
 *
 * 只负责查询与默认软删除过滤；权限、校验、事务、乐观锁由 Service 负责。
 * 页面与 Route 不得绕过本层直接访问 Prisma。
 */

/** 资料读取所需的最小字段集。QQ 只在 self/internal 详情使用，不进入列表。 */
const profileSelect = {
  id: true,
  userId: true,
  realName: true,
  studentId: true,
  className: true,
  nickname: true,
  avatarUrl: true,
  status: true,
  version: true,
  joinedAt: true,
  deletedAt: true,
  user: {
    select: {
      id: true,
      status: true,
      displayName: true,
      deletedAt: true,
      identities: { select: { type: true, identifierNormalized: true } },
      roles: { select: { role: { select: { code: true } } } },
    },
  },
} as const;

export type MemberProfileRow = NonNullable<
  Awaited<ReturnType<typeof memberProfileRepository.findByUserId>>
>;

export const memberProfileRepository = {
  /** 按账号读取本人档案（未软删除）。找不到返回 null，由 Service 决定错误语义。 */
  async findByUserId(userId: string) {
    return getDb().memberProfile.findFirst({
      where: { userId, deletedAt: null },
      select: profileSelect,
    });
  },

  /** 按档案 id 读取（未软删除）。不存在、软删除、已禁用统一返回 null → 调用方映射 404。 */
  async findById(memberProfileId: string) {
    return getDb().memberProfile.findFirst({
      where: { id: memberProfileId, deletedAt: null },
      select: profileSelect,
    });
  },

  /**
   * 当前成员的有效档案。要求档案 `status = ACTIVE` 且账号未删除。
   * 用于所有需要「自己」身份的自助操作。
   */
  async activeForUser(userId: string | undefined) {
    if (!userId) throw new AppError("MEMBER_REQUIRED", "需要有效成员身份");
    const row = await this.findByUserId(userId);
    if (!row || row.status !== "ACTIVE") {
      throw new AppError("MEMBER_REQUIRED", "需要有效成员身份");
    }
    return row;
  },
};
