import { formatDurationMinutes, memberCopy } from "@/config/member";
import type { MonthlyTrendPoint } from "@/types/contracts";

/**
 * 最近 12 个月维修趋势（纯展示）。
 *
 * 设计取舍：**不引入图表库**（任务书 §10.3 明确要求先说明 bundle 与可访问性影响）。
 * 这里用「表格 + 装饰性比例条」：
 * - 表格承载**全部语义**：月份、数量、时长都是真实文本；
 * - 比例条只是视觉辅助，`aria-hidden` 且宽度按最大值归一 ——
 *   既不成为唯一线索，也不会让读屏念出一串无意义的数字。
 *
 * 这样同时满足「不得仅依赖图形/颜色」与「无数据时显示真实空态」。
 */
export function MemberMonthlyTrend({ points }: { points: readonly MonthlyTrendPoint[] }) {
  const copy = memberCopy.profile;

  if (points.length === 0) {
    return <p className="member-section__note">{copy.trendEmpty}</p>;
  }

  const maxCount = Math.max(1, ...points.map((p) => p.approvedCount));
  const totalCount = points.reduce((sum, p) => sum + p.approvedCount, 0);
  const totalDuration = points.reduce((sum, p) => sum + p.durationMinutes, 0);

  return (
    <div className="analytics-block">
      <table className="analytics-table analytics-table--trend">
        <caption className="sr-only">{copy.trendTableCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{copy.columnMonth}</th>
            <th scope="col">{copy.columnCount}</th>
            <th scope="col">{copy.columnDuration}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.month}>
              <th scope="row">{point.month}</th>
              <td>
                <span
                  className="analytics-table__bar"
                  aria-hidden="true"
                  style={{ inlineSize: `${Math.round((point.approvedCount / maxCount) * 100)}%` }}
                />
                <span className="analytics-table__num">{point.approvedCount}</span>{" "}
                {copy.distributionUnitCount}
              </td>
              <td>{formatDurationMinutes(point.durationMinutes)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{copy.columnTotal}</th>
            <td>
              <span className="analytics-table__num">{totalCount}</span> {copy.distributionUnitCount}
            </td>
            <td>{formatDurationMinutes(totalDuration)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
