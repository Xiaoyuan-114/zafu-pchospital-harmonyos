"use client";

import { FavoriteRow } from "@/components/community/FavoriteList";
import { NotificationRow } from "@/components/community/NotificationInbox";
import { Button } from "@/components/ui/Button";
import { communityCopy } from "@/config/community";
import { memberCopy } from "@/config/member";
import type { MemberFavoriteSummary, MemberNotificationSummary } from "@/types/contracts";

/**
 * MemberUpcoming —— 工作台底部：M4 通知与收藏的真实摘要
 *
 * 通知与收藏来自 dashboard 聚合字段。**是否失败由摘要自己的 `available` 决定**：
 * 聚合查询挂掉时服务端返回 `available: false` + 计数 `null`（不是 0），
 * 于是「查不出来」与「真的没有未读」在渲染层也不会被混为一谈 ——
 * 这里据 `available` 渲染局部错误态，而不是把失败画成「暂无通知」。
 *
 * 本组件只负责通知与收藏。**排行不再在这里占位**：M5 已把「维修排行」做成真实数据，
 * 由 `MemberRankingPreviewView` 在独立区块渲染。因此「尚未接入的模块」这一概念
 * 在本站已不存在，原先的接入位清单与 `upcomingNote` 一并移除 ——
 * 既不留下一句「后续模块开放」的错误承诺，也不再把 `M4`/`M5` 这类内部编号渲染给用户
 * （`sr-only` 同样会交给读屏软件，不算「没渲染」）。
 *
 * `degraded` 也不传进来：通知/收藏的失败状态由摘要自身表达，
 * 留两处判断会变成双重事实来源。
 *
 * 两块的「查看全部…」链接已撤掉：通知页与收藏页收在侧栏足部的「设置」里。
 * 这里继续把最近的几条原样展示 —— 摘要是「瞥一眼」，不是入口。
 *
 * 失败语义的纯逻辑与单测见 `src/features/member-dashboard/community-summary.ts`。
 */

export type MemberUpcomingProps = {
  notifications: MemberNotificationSummary;
  favorites: MemberFavoriteSummary;
  onRetry: () => void;
};

export function MemberUpcoming({ notifications, favorites, onRetry }: MemberUpcomingProps) {
  const copy = memberCopy.dashboard;
  const notice = communityCopy.notifications;
  const fav = communityCopy.favorites;

  return (
    <div className="member-upcoming">
      <div className="community-summary">
        <section className="community-summary__panel" aria-labelledby="member-upcoming-notifications">
          <header className="community-summary__head">
            <h3 className="community-summary__title" id="member-upcoming-notifications">
              {copy.upcomingNotifications}
            </h3>
            {notifications.available ? (
              <span className="community-summary__count">
                {notice.unreadCount.replace("{count}", String(notifications.unreadCount))}
              </span>
            ) : null}
          </header>
          {notifications.available ? (
            notifications.latest.length === 0 ? (
              <p className="member-section__note">{notice.empty}</p>
            ) : (
              <ul className="community-list community-list--compact">
                {notifications.latest.map((item) => (
                  <li className={`community-list__item${item.status === "UNREAD" ? " is-unread" : ""}`} key={item.id}>
                    <NotificationRow item={item} />
                  </li>
                ))}
              </ul>
            )
          ) : (
            <SectionError onRetry={onRetry} />
          )}
        </section>

        <section className="community-summary__panel" aria-labelledby="member-upcoming-favorites">
          <header className="community-summary__head">
            <h3 className="community-summary__title" id="member-upcoming-favorites">
              {copy.upcomingFavorites}
            </h3>
            {favorites.available ? (
              <span className="community-summary__count">{fav.count.replace("{count}", String(favorites.count))}</span>
            ) : null}
          </header>
          {favorites.available ? (
            favorites.latest.length === 0 ? (
              <p className="member-section__note">{fav.empty}</p>
            ) : (
              <ul className="community-list community-list--compact">
                {favorites.latest.map((item) => (
                  <li className="community-list__item" key={item.id}>
                    <FavoriteRow item={item} />
                  </li>
                ))}
              </ul>
            )
          ) : (
            <SectionError onRetry={onRetry} />
          )}
        </section>
      </div>
    </div>
  );
}

function SectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="member-section__error" role="status">
      <p>{memberCopy.common.sectionLoadError}</p>
      <Button onClick={onRetry}>{memberCopy.common.reload}</Button>
    </div>
  );
}
