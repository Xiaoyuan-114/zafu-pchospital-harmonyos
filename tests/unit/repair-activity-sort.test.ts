import assert from "node:assert/strict";
import test from "node:test";

import {
  pickNonEndedRepairActivitiesForHomePreview,
  sortRepairActivitiesForPublicList,
  type PublicListSortable,
} from "../../src/features/repair-activities/repair-activity-sort";
import type { RepairActivityStatus } from "../../src/features/repair-activities/repair-activity-validation";

function item(
  partial: Partial<PublicListSortable> & {
    id: string;
    status: RepairActivityStatus;
    activityAt: string;
  },
): PublicListSortable {
  return partial;
}

function ids(items: PublicListSortable[]): string[] {
  return items.map((x) => x.id);
}

test("仅未结束：按 activityAt 升序", () => {
  const sorted = sortRepairActivitiesForPublicList([
    item({ id: "c", status: "OPEN", activityAt: "2026-10-03T00:00:00.000Z" }),
    item({ id: "a", status: "UPCOMING", activityAt: "2026-10-01T00:00:00.000Z" }),
    item({ id: "b", status: "FULL", activityAt: "2026-10-02T00:00:00.000Z" }),
    item({ id: "d", status: "CLOSED", activityAt: "2026-10-04T00:00:00.000Z" }),
  ]);
  assert.deepEqual(ids(sorted), ["a", "b", "c", "d"]);
});

test("仅已结束：按 activityAt 降序", () => {
  const sorted = sortRepairActivitiesForPublicList([
    item({ id: "old", status: "ENDED", activityAt: "2026-09-01T00:00:00.000Z" }),
    item({ id: "new", status: "ENDED", activityAt: "2026-09-10T00:00:00.000Z" }),
    item({ id: "mid", status: "ENDED", activityAt: "2026-09-05T00:00:00.000Z" }),
  ]);
  assert.deepEqual(ids(sorted), ["new", "mid", "old"]);
});

test("混合：所有非 ENDED 在任意 ENDED 之前", () => {
  const sorted = sortRepairActivitiesForPublicList([
    item({ id: "ended-late", status: "ENDED", activityAt: "2026-12-01T00:00:00.000Z" }),
    item({ id: "open", status: "OPEN", activityAt: "2026-11-01T00:00:00.000Z" }),
    item({ id: "ended-early", status: "ENDED", activityAt: "2026-08-01T00:00:00.000Z" }),
    item({ id: "upcoming", status: "UPCOMING", activityAt: "2026-10-01T00:00:00.000Z" }),
  ]);
  assert.deepEqual(ids(sorted), ["upcoming", "open", "ended-late", "ended-early"]);
  const firstEnded = sorted.findIndex((x) => x.status === "ENDED");
  assert.ok(firstEnded > 0);
  assert.ok(sorted.slice(0, firstEnded).every((x) => x.status !== "ENDED"));
  assert.ok(sorted.slice(firstEnded).every((x) => x.status === "ENDED"));
});

test("同 activityAt：次键 createdAt asc，再 id", () => {
  const same = "2026-10-01T00:00:00.000Z";
  const sorted = sortRepairActivitiesForPublicList([
    item({
      id: "b",
      status: "OPEN",
      activityAt: same,
      createdAt: "2026-09-02T00:00:00.000Z",
    }),
    item({
      id: "a",
      status: "OPEN",
      activityAt: same,
      createdAt: "2026-09-01T00:00:00.000Z",
    }),
    item({
      id: "c",
      status: "OPEN",
      activityAt: same,
      createdAt: "2026-09-02T00:00:00.000Z",
    }),
  ]);
  assert.deepEqual(ids(sorted), ["a", "b", "c"]);

  const endedSorted = sortRepairActivitiesForPublicList([
    item({
      id: "y",
      status: "ENDED",
      activityAt: same,
      createdAt: "2026-09-02T00:00:00.000Z",
    }),
    item({
      id: "x",
      status: "ENDED",
      activityAt: same,
      createdAt: "2026-09-01T00:00:00.000Z",
    }),
  ]);
  assert.deepEqual(ids(endedSorted), ["x", "y"]);
});

test("空数组 / 单元素", () => {
  assert.deepEqual(sortRepairActivitiesForPublicList([]), []);
  const one = [item({ id: "only", status: "OPEN", activityAt: "2026-10-01T00:00:00.000Z" })];
  assert.deepEqual(ids(sortRepairActivitiesForPublicList(one)), ["only"]);
  const oneEnded = [item({ id: "done", status: "ENDED", activityAt: "2026-09-01T00:00:00.000Z" })];
  assert.deepEqual(ids(sortRepairActivitiesForPublicList(oneEnded)), ["done"]);
});

test("首页预览：OPEN 优先，其次 UPCOMING，再次 FULL / CLOSED，各档内按 activityAt 升序", () => {
  const picked = pickNonEndedRepairActivitiesForHomePreview(
    [
      item({ id: "ended", status: "ENDED", activityAt: "2026-12-01T00:00:00.000Z" }),
      item({ id: "open-late", status: "OPEN", activityAt: "2026-11-02T00:00:00.000Z" }),
      item({ id: "upcoming", status: "UPCOMING", activityAt: "2026-10-01T00:00:00.000Z" }),
      item({ id: "full", status: "FULL", activityAt: "2026-11-01T00:00:00.000Z" }),
      item({ id: "closed", status: "CLOSED", activityAt: "2026-11-03T00:00:00.000Z" }),
    ],
    3,
  );
  // OPEN 排在更早的 UPCOMING / FULL / CLOSED 之前；取前 3 条。
  assert.deepEqual(ids(picked), ["open-late", "upcoming", "full"]);
  assert.ok(picked.every((x) => x.status !== "ENDED"));
});

test("首页预览：同为 OPEN 时按 activityAt 升序，同刻再按 createdAt asc → id", () => {
  const same = "2026-10-01T00:00:00.000Z";
  const picked = pickNonEndedRepairActivitiesForHomePreview(
    [
      item({ id: "open-late", status: "OPEN", activityAt: "2026-10-03T00:00:00.000Z" }),
      item({ id: "closed-earliest", status: "CLOSED", activityAt: "2026-09-01T00:00:00.000Z" }),
      item({ id: "open-early", status: "OPEN", activityAt: "2026-10-02T00:00:00.000Z" }),
      item({
        id: "b",
        status: "OPEN",
        activityAt: same,
        createdAt: "2026-09-02T00:00:00.000Z",
      }),
      item({
        id: "a",
        status: "OPEN",
        activityAt: same,
        createdAt: "2026-09-01T00:00:00.000Z",
      }),
    ],
    3,
  );
  assert.deepEqual(ids(picked), ["a", "b", "open-early"]);
});

test("首页预览：CLOSED / FULL 也排在 UPCOMING 之后", () => {
  const picked = pickNonEndedRepairActivitiesForHomePreview(
    [
      item({ id: "full", status: "FULL", activityAt: "2026-10-01T00:00:00.000Z" }),
      item({ id: "upcoming", status: "UPCOMING", activityAt: "2026-11-01T00:00:00.000Z" }),
      item({ id: "closed", status: "CLOSED", activityAt: "2026-10-02T00:00:00.000Z" }),
    ],
    3,
  );
  assert.deepEqual(ids(picked), ["upcoming", "full", "closed"]);
});

test("首页预览：无 OPEN 时按 UPCOMING → FULL / CLOSED 分档", () => {
  const picked = pickNonEndedRepairActivitiesForHomePreview(
    [
      item({ id: "closed", status: "CLOSED", activityAt: "2026-09-01T00:00:00.000Z" }),
      item({ id: "upcoming-late", status: "UPCOMING", activityAt: "2026-10-05T00:00:00.000Z" }),
      item({ id: "full", status: "FULL", activityAt: "2026-09-02T00:00:00.000Z" }),
      item({ id: "upcoming-early", status: "UPCOMING", activityAt: "2026-10-01T00:00:00.000Z" }),
    ],
    3,
  );
  assert.deepEqual(ids(picked), ["upcoming-early", "upcoming-late", "full"]);
});

test("首页预览：无未结束时返回空数组", () => {
  const picked = pickNonEndedRepairActivitiesForHomePreview(
    [
      item({ id: "a", status: "ENDED", activityAt: "2026-09-01T00:00:00.000Z" }),
      item({ id: "b", status: "ENDED", activityAt: "2026-09-10T00:00:00.000Z" }),
    ],
    3,
  );
  assert.deepEqual(picked, []);
});

test("首页预览：未结束不足 N 时全取", () => {
  const picked = pickNonEndedRepairActivitiesForHomePreview(
    [
      item({ id: "only", status: "OPEN", activityAt: "2026-10-01T00:00:00.000Z" }),
      item({ id: "ended", status: "ENDED", activityAt: "2026-09-01T00:00:00.000Z" }),
    ],
    3,
  );
  assert.deepEqual(ids(picked), ["only"]);
});
