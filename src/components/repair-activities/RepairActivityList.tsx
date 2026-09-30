"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { formatShanghaiDateTime } from "@/components/repair-activities/activity-format";
import { repairActivityStatusBadgeClass } from "@/components/repair-activities/activity-status-badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { repairActivitiesPage } from "@/config/repair-activities";
import {
  repairActivityStatusLabels,
  type RepairActivityStatus,
} from "@/features/repair-activities/repair-activity-validation";
import type { RepairActivityPublicView } from "@/features/repair-activities/repair-activity-service";

const PAGE_SIZE = 4;

export function RepairActivityList() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [items, setItems] = useState<RepairActivityPublicView[]>([]);
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/v1/repair-activities");
        const json = (await response.json()) as {
          success: boolean;
          data?: RepairActivityPublicView[];
          error?: { message?: string };
        };
        if (cancelled) return;
        if (!json.success || !json.data) {
          setState("error");
          setMessage(json.error?.message ?? repairActivitiesPage.loadFailed);
          return;
        }
        setItems(json.data);
        setPage(1);
        setState("ready");
      } catch {
        if (!cancelled) {
          setState("error");
          setMessage(repairActivitiesPage.loadFailed);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageItems = useMemo(
    () => items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [items, safePage],
  );

  if (state === "loading") {
    return <p className="muted">正在加载活动…</p>;
  }
  if (state === "error") {
    return (
      <p className="admin-status admin-status--error" role="alert">
        {message}
      </p>
    );
  }
  if (items.length === 0) {
    return <p className="muted">{repairActivitiesPage.empty}</p>;
  }

  return (
    <div className="activity-list-block">
      <ul className="activity-list activity-list--paged">
        {pageItems.map((item) => {
          const ended = item.status === "ENDED";
          const body = (
            <Card className={`activity-card${ended ? " activity-card--ended" : ""}`}>
              <div className="activity-card__head">
                <h2 className="activity-card__title">{item.title}</h2>
                <span className={repairActivityStatusBadgeClass(item.status)}>
                  {repairActivityStatusLabels[item.status as RepairActivityStatus]}
                </span>
              </div>
              <dl className="activity-card__meta">
                <div>
                  <dt>{repairActivitiesPage.activityAt}</dt>
                  <dd>{formatShanghaiDateTime(item.activityAt)}</dd>
                </div>
                <div>
                  <dt>名额</dt>
                  <dd>{formatCapacityLine(item, ended)}</dd>
                </div>
              </dl>
              <div className="activity-card__footer">
                <p
                  className={`muted${ended ? "" : " activity-card__footer-slot"}`}
                  aria-hidden={ended ? undefined : true}
                >
                  {repairActivitiesPage.endedHint}
                </p>
              </div>
            </Card>
          );

          if (ended) {
            return (
              <li key={item.id}>
                <div aria-disabled="true" className="activity-card__ended-wrap">
                  {body}
                </div>
              </li>
            );
          }

          return (
            <li key={item.id}>
              <Link href={`/repair-activities/${item.id}`} className="activity-card__link">
                {body}
              </Link>
            </li>
          );
        })}
      </ul>
      {totalPages > 1 ? (
        <nav className="repair-pagination" aria-label={repairActivitiesPage.paginationLabel}>
          <Button
            type="button"
            icon="chevronLeft"
            disabled={safePage <= 1}
            onClick={() => setPage(safePage - 1)}
          >
            {repairActivitiesPage.previousPage}
          </Button>
          <span>
            {safePage} / {totalPages}
          </span>
          <Button
            type="button"
            trailingIcon="chevronRight"
            disabled={safePage >= totalPages}
            onClick={() => setPage(safePage + 1)}
          >
            {repairActivitiesPage.nextPage}
          </Button>
        </nav>
      ) : null}
    </div>
  );
}

/** 未结束优先「剩余 N」，可与已报/上限同行压缩；已结束仅已报/上限。 */
function formatCapacityLine(item: RepairActivityPublicView, ended: boolean): string {
  const capacity = repairActivitiesPage.capacity
    .replace("{registered}", String(item.registeredCount))
    .replace("{capacity}", String(item.capacity));
  if (ended) return capacity;
  const remaining = repairActivitiesPage.remainingShort.replace(
    "{count}",
    String(item.remaining),
  );
  return `${remaining} · ${capacity}`;
}
