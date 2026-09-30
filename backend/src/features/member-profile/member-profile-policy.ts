import type {
  MemberInternalProfile,
  MemberProfileSummary,
  MemberSelfProfile,
  RoleCode,
  SkillView,
} from "@/types/contracts";

/**
 * 成员资料可见性裁剪（M3 任务书 §8、§9）。
 *
 * 三种视角：
 * - `self`      本人查看自己：可见 QQ、学号、班级（QQ 在页面标注「内部可见」）；
 * - `internal`  有效成员查看他人：可见 QQ（属内部字段），**不含**学号、班级、
 *               userId、账号状态细节与管理字段；
 * - `summary`   工作台欢迎区等聚合位置使用的最小身份信息：不含任何联系方式。
 *
 * 三条视角都不含 `userId` —— 对外一律使用 `memberProfileId` 作为成员标识，
 * 避免把账号主键暴露成可枚举的成员 id。
 */

/** Repository 返回的原始行形状（只列 Policy 关心的字段）。 */
export type ProfileSourceRow = {
  id: string;
  userId: string;
  realName: string;
  studentId: string | null;
  className: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  status: string;
  version: number;
  joinedAt: Date;
  user: {
    displayName: string | null;
    status: string;
    identities: readonly { type: string; identifierNormalized: string }[];
    roles: readonly { role: { code: string } }[];
  };
};

/** 展示名回退链与 M2 维修视图一致：昵称 → 实名 → 账号展示名 → 「成员」。 */
export function resolveDisplayName(row: ProfileSourceRow): string {
  return row.nickname?.trim() || row.realName?.trim() || row.user.displayName?.trim() || "成员";
}

function roleCodes(row: ProfileSourceRow): RoleCode[] {
  return row.user.roles
    .map((entry) => entry.role.code as RoleCode)
    .filter((code): code is RoleCode => code === "MEMBER" || code === "ADMIN");
}

/** 从身份表取 QQ。QQ 属于内部字段，只在 self / internal 视角出现。 */
function qqFromIdentities(row: ProfileSourceRow): string | null {
  const identity = row.user.identities.find((entry) => entry.type === "QQ");
  const value = identity?.identifierNormalized?.trim();
  return value ? value : null;
}

function toSummary(
  row: ProfileSourceRow,
  skills: readonly SkillView[],
): MemberProfileSummary {
  return {
    memberProfileId: row.id,
    displayName: resolveDisplayName(row),
    nickname: row.nickname,
    realName: row.realName,
    avatarUrl: row.avatarUrl,
    status: row.status,
    joinedAt: row.joinedAt.toISOString(),
    roles: roleCodes(row),
    skills: [...skills],
    version: row.version,
  };
}

export const memberProfilePolicy = {
  /** 聚合摘要：无联系方式，可安全用于工作台/列表。 */
  toSummary(row: ProfileSourceRow, skills: readonly SkillView[]): MemberProfileSummary {
    return toSummary(row, skills);
  },

  /** 本人视角：含 QQ / 学号 / 班级，并显式声明可自助编辑的字段白名单。 */
  toSelf(row: ProfileSourceRow, skills: readonly SkillView[]): MemberSelfProfile {
    return {
      ...toSummary(row, skills),
      qq: qqFromIdentities(row),
      studentId: row.studentId,
      className: row.className,
      editableFields: ["nickname", "skills"],
    };
  },

  /** 他人内部视角：可见 QQ，但不含学号、班级与账号状态细节。 */
  toInternal(row: ProfileSourceRow, skills: readonly SkillView[]): MemberInternalProfile {
    return {
      ...toSummary(row, skills),
      qq: qqFromIdentities(row),
    };
  },
};
