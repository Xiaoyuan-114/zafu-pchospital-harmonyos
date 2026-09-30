import { formatDurationMinutes, memberCopy } from "@/config/member";
import type { CategoryDistributionItem } from "@/types/contracts";

/**
 * 故障分类分布（纯展示）。
 *
 * 用**表格**呈现，而不是饼图：任务书 §10.3 要求「图表必须同时提供文字摘要、
 * 标签或可访问表格，不能仅依赖图形/颜色」。表格本身就满足该要求 ——
 * 每行都带分类名、数量与时长，读屏可以逐格朗读，也不存在「颜色是唯一线索」的问题。
 *
 * 无分类的历史记录由服务端归入「未分类」桶（`categoryId === null`），
 * 这里只负责原样展示，不做二次归类。
 */
export function MemberCategoryDistribution({ items }: { items: readonly CategoryDistributionItem[] }) {
  const copy = memberCopy.profile;

  if (items.length === 0) {
    return <p className="member-section__note">{copy.distributionEmpty}</p>;
  }

  return (
    <div className="analytics-block">
      <table className="analytics-table">
        <caption className="sr-only">{copy.distributionTableCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{copy.columnCategory}</th>
            <th scope="col">{copy.columnCount}</th>
            <th scope="col">{copy.columnDuration}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.categoryId ?? "uncategorized"}>
              <th scope="row">{item.categoryName}</th>
              <td>
                <span className="analytics-table__num">{item.approvedCount}</span> {copy.distributionUnitCount}
              </td>
              <td>{formatDurationMinutes(item.durationMinutes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
