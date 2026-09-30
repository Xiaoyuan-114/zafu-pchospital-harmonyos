import {
  getAcademicTermConfig,
  shanghaiMonthRange,
  type UtcRange,
} from "@/lib/academic-term";
import {
  listMemberRecentActivity,
  listMemberRecentRepairs,
  listMemberWorkQueue,
} from "@/features/repairs/repair-query-service";
import { getMemberSummary } from "@/features/analytics/analytics-repository";
import type {
  MemberRecentActivity,
  MemberRecentRepair,
  MemberRepairSummary,
  MemberWorkQueue,
} from "@/types/contracts";

/**
 * 工作台维修数据 Provider（M3 任务书 §7、§9、§12.1）。
 *
 * 边界：**不新建 RepairRecord 查询**，只把 M3 的日期口径（本月 / 学期）
 * 交给 M2 已冻结的成员维修读取函数，由后者复用
 * `APPROVED AND deletedAt IS NULL` 的正式语义。
 *
 * 降级策略（**本文件的核心约束**）：任务书 §12.1 要求「指标加载用稳定骨架，
 * 失败时局部错误」。四路查询相互独立，任何一路失败**都不应**让另外三路一起变成
 * 错误 —— 所以这里**不用 `Promise.all`**（它会在首个 rejection 时丢弃全部结果），
 * 而用 `Promise.allSettled` 逐项收敛，把失败信息放进结果各个区块的 `status`。
 * 上层据此只渲染失败区块的错误态，其余区块照常展示真实数据。
 *
 * M5 接入后可把本 Provider 换成分析型实现，页面结构不受影响。
 */

export type MemberOverviewQuery = {
  memberProfileId: string;
  now: Date;
  recentLimit: number;
};

/**
 * 单个区块的加载结果。
 *
 * - `ready`：取到了真实数据；
 * - `failed`：该区块失败，**不携带任何数据**（不回退为空数组、不伪造 0），
 *   由页面渲染该区块自己的错误态；`code` 仅供日志/调试，不面向终端用户展示内部细节。
 *
 * 之所以不用 `null` 表示失败：`null` 会与「合法但为空」混淆
 * （例如某成员确实没有已通过记录，`recentRepairs` 就是空数组）。
 */
export type SectionResult<T> =
  | { status: "ready"; data: T }
  | { status: "failed"; code: string };

export type MemberOverviewResult = {
  repairSummary: SectionResult<MemberRepairSummary>;
  recentRepairs: SectionResult<MemberRecentRepair[]>;
  recentActivity: SectionResult<MemberRecentActivity[]>;
  workQueue: SectionResult<MemberWorkQueue>;
  /** 四路全部失败时为 true，页面可直接整块报错；部分失败为 false。 */
  allFailed: boolean;
};

/** `Promise.allSettled` 的四元组结果类型（顺序：摘要、最近已通过、最近操作、工作队列）。 */
export type MemberOverviewSettled = [
  PromiseSettledResult<MemberRepairSummary>,
  PromiseSettledResult<MemberRecentRepair[]>,
  PromiseSettledResult<MemberRecentActivity[]>,
  PromiseSettledResult<MemberWorkQueue>,
];

/** 解析当前应为哪个月与哪个学期区间；学期未配置时 `termRange` 为 undefined。 */
export function resolveMemberRanges(now: Date): { monthRange: UtcRange; termRange?: UtcRange } {
  const monthRange = shanghaiMonthRange(now);
  const term = getAcademicTermConfig();
  return {
    monthRange: { startInclusive: monthRange.startInclusive, endExclusive: monthRange.endExclusive },
    termRange: term.configured ? term.range : undefined,
  };
}

/** 把 settled 结果收敛为 `SectionResult`；把异常收敛为稳定错误码，不向上抛原始信息。 */
function settle<T>(result: PromiseSettledResult<T>): SectionResult<T> {
  if (result.status === "fulfilled") return { status: "ready", data: result.value };
  const reason: unknown = result.reason;
  const code =
    reason && typeof reason === "object" && "code" in reason && typeof reason.code === "string"
      ? reason.code
      : "OVERVIEW_SECTION_FAILED";
  return { status: "failed", code };
}

/**
 * 把四路 `allSettled` 结果收敛成区块化结果 + `allFailed` 汇总。
 *
 * 抽成独立纯函数有两个好处：一是降级语义可被单测直接覆盖（不必 mock ESM 模块），
 * 二是把「哪几路、什么顺序」这个易错点集中在一处。
 */
export function collectSections([
  repairSummary,
  recentRepairs,
  recentActivity,
  workQueue,
]: MemberOverviewSettled): MemberOverviewResult {
  const sections = {
    repairSummary: settle(repairSummary),
    recentRepairs: settle(recentRepairs),
    recentActivity: settle(recentActivity),
    workQueue: settle(workQueue),
  };
  return {
    ...sections,
    allFailed: Object.values(sections).every((section) => section.status === "failed"),
  };
}

export async function loadMemberOverview(query: MemberOverviewQuery): Promise<MemberOverviewResult> {
  const { monthRange, termRange } = resolveMemberRanges(query.now);

  // 并行读取，但**逐项收敛**：使用 allSettled 而非 all，任一失败不影响其它区块。
  // 注意四路查询之间不构成强事务快照，页面不得假设快照一致性；
  // 所有指标共用同一个 generatedAt（由 getMemberSummary 内部生成）。
  return collectSections(
    await Promise.allSettled([
      // M5 起正式摘要统一由 Analytics 入口产出（source = M5_ANALYTICS），
      // 内部仍复用 M2 的正式谓词与同一套聚合，不产生第二个统计口径。
      getMemberSummary(query.memberProfileId, { monthRange, termRange }),
      listMemberRecentRepairs(query.memberProfileId, query.recentLimit),
      listMemberRecentActivity(query.memberProfileId, query.recentLimit),
      listMemberWorkQueue(query.memberProfileId),
    ]),
  );
}
