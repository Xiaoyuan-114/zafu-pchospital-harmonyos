import { inviteCodeService } from "@/features/invitations/invite-code-service";
import { joinApplicationService } from "@/features/recruitment/join-application-service";
import { memberService } from "@/features/members/member-service";
import { repairQueryService } from "@/features/repairs/repair-query-service";
import type { AuthorizedActor } from "@/types/contracts";

/**
 * 管理后台首页的待办聚合计数。
 *
 * 不新建查询：直接复用四个领域各自的列表服务（`pageSize: 1`，只取 `pagination.total`），
 * 因此计数口径与管理员点进列表页看到的「共 N 条」永远一致，也不会引入第二套权限规则 ——
 * 每个服务内部有自己的 `requirePermission`，某一域没权限 / 查询失败时那一项返回 `null`，
 * 前端显示「—」，**绝不**把失败画成 0（0 是「没有待办」，与「查不出来」语义相反）。
 */
export type AdminDashboardSummary = {
  /** 待审核维修记录数（`status=PENDING`） */
  repairsPending: number | null;
  /** 待跟进报名数（已提交 + 待面试）；两路任一失败则为 null */
  recruitmentFollowup: number | null;
  /** 账号发放失败数（`provisionStatus=FAILED`） */
  provisionFailed: number | null;
  /** 当前可用邀请码数（生效状态 = ACTIVE） */
  inviteActive: number | null;
  /** 成员档案总数（不分状态） */
  memberTotal: number | null;
  generatedAt: string;
};

type ListResult = { pagination: { total: number } };

async function totalOf(query: () => Promise<ListResult>): Promise<number | null> {
  try {
    return (await query()).pagination.total;
  } catch {
    return null;
  }
}

export async function getAdminDashboardSummary(
  actor: AuthorizedActor,
): Promise<AdminDashboardSummary> {
  const page = { page: 1, pageSize: 1 } as const;
  const [repairsPending, joinSubmitted, joinInterviewPending, provisionFailed, inviteActive, memberTotal] =
    await Promise.all([
      totalOf(() => repairQueryService.list({ ...page, status: "PENDING" }, actor)),
      totalOf(() => joinApplicationService.list({ ...page, status: "SUBMITTED" }, actor)),
      totalOf(() => joinApplicationService.list({ ...page, status: "INTERVIEW_PENDING" }, actor)),
      totalOf(() => joinApplicationService.list({ ...page, provisionStatus: "FAILED" }, actor)),
      totalOf(() => inviteCodeService.list({ ...page, status: "ACTIVE" }, actor)),
      totalOf(() => memberService.list({ ...page }, actor)),
    ]);

  return {
    repairsPending,
    recruitmentFollowup:
      joinSubmitted === null || joinInterviewPending === null
        ? null
        : joinSubmitted + joinInterviewPending,
    provisionFailed,
    inviteActive,
    memberTotal,
    generatedAt: new Date().toISOString(),
  };
}
