"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MEMBER_NOTIFICATIONS_CHANGED_EVENT } from "@/config/member";
import { communityCopy } from "@/config/community";
import type { NotificationStatus, NotificationView, PaginationMeta } from "@/types/contracts";

export function NotificationInbox() {
  const copy = communityCopy.notifications;
  const [items, setItems] = useState<NotificationView[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination, setPagination] = useState<PaginationMeta>();
  const [filter, setFilter] = useState<"" | NotificationStatus>("");
  const [page, setPage] = useState(1);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (filter) params.set("status", filter);
      const response = await fetch(`/api/v1/member/notifications?${params}`, { cache: "no-store" });
      const json = await response.json();
      if (!json.success) throw new Error();
      const data = json.data as { items: NotificationView[]; unreadCount: number };
      setItems(data.items);
      setUnreadCount(data.unreadCount);
      setPagination(json.meta.pagination as PaginationMeta);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [filter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  function notifyNavUnreadChanged() {
    window.dispatchEvent(new CustomEvent(MEMBER_NOTIFICATIONS_CHANGED_EVENT));
  }

  async function markRead(id: string) {
    const response = await fetch(`/api/v1/member/notifications/${id}/read`, { method: "POST" });
    const json = await response.json();
    if (json.success) {
      await load();
      notifyNavUnreadChanged();
    }
  }

  async function markAll() {
    const response = await fetch("/api/v1/member/notifications/read-all", { method: "POST" });
    const json = await response.json();
    if (json.success) {
      await load();
      notifyNavUnreadChanged();
    }
  }

  async function remove(id: string) {
    const response = await fetch(`/api/v1/member/notifications/${id}`, { method: "DELETE" });
    const json = await response.json();
    if (json.success) {
      await load();
      notifyNavUnreadChanged();
    }
  }

  if (state === "error") {
    return (
      <Card variant="notice">
        <p>{copy.loadError}</p>
        <Button onClick={() => void load()}>{copy.reload}</Button>
      </Card>
    );
  }

  return (
    <div className="community-page">
      <div className="community-toolbar">
        <div className="community-toolbar__filters">
          {(
            [
              ["", copy.filterAll],
              ["UNREAD", copy.filterUnread],
              ["READ", copy.filterRead],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value || "all"}
              type="button"
              variant={filter === value ? "solid" : "outline"}
              onClick={() => {
                setFilter(value);
                setPage(1);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
        <Button type="button" onClick={() => void markAll()} disabled={unreadCount === 0}>
          {copy.markAllRead}
        </Button>
      </div>
      <p className="community-block__meta">{copy.unreadCount.replace("{count}", String(unreadCount))}</p>
      {state === "loading" ? <p role="status">{copy.loading}</p> : null}
      {state === "ready" && items.length === 0 ? (
        <p className="member-section__note">{filter === "UNREAD" ? copy.unreadEmpty : copy.empty}</p>
      ) : null}
      <ul className="community-list">
        {items.map((item) => (
          <li className={`community-list__item${item.status === "UNREAD" ? " is-unread" : ""}`} key={item.id}>
            <NotificationRow item={item} />
            <div className="community-list__actions">
              {item.status === "UNREAD" ? (
                <Button type="button" variant="ghost" onClick={() => void markRead(item.id)}>
                  {copy.markRead}
                </Button>
              ) : null}
              <Button type="button" variant="ghost" onClick={() => void remove(item.id)}>
                {copy.delete}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {pagination && pagination.totalPages > 1 ? (
        <nav className="repair-pagination">
          <Button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
            {communityCopy.pagination.previous}
          </Button>
          <span>
            {page} / {pagination.totalPages}
          </span>
          <Button
            type="button"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            {communityCopy.pagination.next}
          </Button>
        </nav>
      ) : null}
    </div>
  );
}

export function NotificationRow({ item }: { item: NotificationView }) {
  const copy = communityCopy.notifications;
  const href = item.repairRecordId ? `/member/repairs/${item.repairRecordId}` : undefined;
  return (
    <div className="community-list__body">
      <p className="community-list__title">
        {item.actor ? `${item.actor.name} ` : ""}
        {copy.types[item.type] ?? item.type}
      </p>
      {item.repairExcerpt ? <p className="community-list__excerpt">{item.repairExcerpt}</p> : null}
      <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("zh-CN")}</time>
      {href ? (
        <p>
          <Link href={href}>{communityCopy.favorites.open}</Link>
        </p>
      ) : null}
    </div>
  );
}
