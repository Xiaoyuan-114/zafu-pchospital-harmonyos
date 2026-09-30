import { memberCopy } from "@/config/member";

/**
 * MemberSkeleton —— 工作台加载骨架（T-P2-5）
 *
 * 结构与 ready 态一致：`member-workspace__content` → `__main`（队列 + 最近）
 * + `__aside`（指标 / 技能 / 排行 / Upcoming），使 ≥1100px 时
 * `:has(> .member-workspace__main)` 双列在加载期也生效，降低 CLS。
 *
 * 欢迎区（hero）由 MemberDashboard 始终渲染，不套骨架。
 *
 * `role="status"` + `aria-live="polite"` 告知辅助技术正在加载；
 * 骨架条 `aria-hidden`，避免读出无意义空元素。
 */

function SectionTitleSkeleton() {
  return <span className="member-skeleton__bar member-skeleton__bar--sm" />;
}

function QueueSkeleton() {
  return (
    <div className="member-section">
      <SectionTitleSkeleton />
      <div className="member-queue">
        {[0, 1, 2].map((index) => (
          <div className="member-queue__item" key={index}>
            <span className="member-skeleton__bar member-skeleton__bar--sm" />
            <span className="member-skeleton__bar member-skeleton__bar--lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentSkeleton() {
  return (
    <div className="member-section">
      <SectionTitleSkeleton />
      <div className="member-skeleton__stack">
        {[0, 1, 2].map((index) => (
          <span className="member-skeleton__bar member-skeleton__bar--block" key={index} />
        ))}
      </div>
    </div>
  );
}

function MetricsSkeleton() {
  return (
    <div className="member-section">
      <SectionTitleSkeleton />
      <div className="member-metrics">
        {[0, 1, 2, 3].map((index) => (
          <div className="member-metric" key={index}>
            <span className="member-skeleton__bar member-skeleton__bar--sm" />
            <span className="member-skeleton__bar member-skeleton__bar--lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AsideBlockSkeleton() {
  return (
    <div className="member-section">
      <SectionTitleSkeleton />
      <span className="member-skeleton__bar member-skeleton__bar--block" />
    </div>
  );
}

export function MemberSkeleton() {
  return (
    <div
      className="member-workspace__content member-skeleton"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">{memberCopy.common.loading}</span>
      <div className="member-workspace__main" aria-hidden="true">
        <QueueSkeleton />
        <RecentSkeleton />
      </div>
      <aside className="member-workspace__aside" aria-hidden="true">
        <MetricsSkeleton />
        {/* 技能区 ready 态为可折叠 details，骨架仅占标题行高度 */}
        <div className="member-skills-fold">
          <SectionTitleSkeleton />
        </div>
        <AsideBlockSkeleton />
        <AsideBlockSkeleton />
      </aside>
    </div>
  );
}
