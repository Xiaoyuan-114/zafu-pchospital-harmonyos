import assert from "node:assert/strict";
import test from "node:test";

import { ApiErrorCode, AppError } from "../../src/lib/api/errors";
import { createCommentInput, createFavoriteInput, notificationStatusFilter } from "../../src/features/community/community-http";
import { excerptText, memberRef } from "../../src/features/community/community-view";
import { normalizeCommentBody } from "../../src/features/community/comment-service";
import {
  settleCommunity,
  toFavoriteSummary,
  toNotificationSummary,
} from "../../src/features/member-dashboard/community-summary";
import {
  collectMemberNames,
  extractAtTokens,
  resolveMentionedMemberIds,
} from "../../src/features/community/mention";
import {
  COMMENT_BODY_MAX_LENGTH,
  COMMENT_MENTION_LIMIT,
  MEMBER_DASHBOARD_FAVORITE_LIMIT,
  MEMBER_DASHBOARD_NOTIFICATION_LIMIT,
  NotificationStatus,
  NotificationType,
  Permission,
} from "../../src/types/contracts";
import { communityCopy } from "../../src/config/community";
import { memberCopy } from "../../src/config/member";

/**
 * M4 契约与纯逻辑测试（不依赖数据库 / HTTP）。
 *
 * 提及合并、正文校验、错误码、限额与文案边界在这里锁死；
 * 回复拍平、通知已读、收藏恢复与越权在 `tests/integration/m4-community.test.ts`。
 */

test("M4 稳定错误码已进入公共契约且状态码正确", () => {
  for (const code of [
    "COMMENT_NOT_FOUND",
    "COMMENT_FORBIDDEN",
    "COMMENT_PARENT_INVALID",
    "COMMENT_BODY_INVALID",
    "MENTION_LIMIT_EXCEEDED",
    "FAVORITE_NOT_FOUND",
    "NOTIFICATION_NOT_FOUND",
  ] as const) {
    assert.equal(ApiErrorCode.includes(code), true, `错误码 ${code} 未包含在 ApiErrorCode 中`);
  }
  const statusOf = (code: (typeof ApiErrorCode)[number]) => new AppError(code, "test").status;
  assert.equal(statusOf("COMMENT_NOT_FOUND"), 404);
  assert.equal(statusOf("COMMENT_FORBIDDEN"), 403);
  assert.equal(statusOf("COMMENT_PARENT_INVALID"), 400);
  assert.equal(statusOf("COMMENT_BODY_INVALID"), 400);
  assert.equal(statusOf("MENTION_LIMIT_EXCEEDED"), 400);
  assert.equal(statusOf("FAVORITE_NOT_FOUND"), 404);
  assert.equal(statusOf("NOTIFICATION_NOT_FOUND"), 404);
});

test("M4 权限与限额常量已冻结", () => {
  for (const permission of ["comment:create", "comment:read", "comment:delete", "favorite:manage", "notification:read"] as const) {
    assert.equal(Permission.includes(permission), true, `权限 ${permission} 未定义`);
  }
  assert.equal(COMMENT_BODY_MAX_LENGTH, 2000);
  assert.equal(COMMENT_MENTION_LIMIT, 10);
  assert.equal(MEMBER_DASHBOARD_NOTIFICATION_LIMIT, 5);
  assert.equal(MEMBER_DASHBOARD_FAVORITE_LIMIT, 5);
  assert.deepEqual(NotificationType, ["MENTIONED", "REPAIR_COMMENTED", "REPAIR_APPROVED", "REPAIR_REJECTED"]);
  assert.deepEqual(NotificationStatus, ["UNREAD", "READ"]);
});

test("评论正文拒绝空内容、超长与非法控制字符", () => {
  assert.throws(() => normalizeCommentBody("   "), (error) => error instanceof AppError && error.code === "COMMENT_BODY_INVALID");
  assert.throws(
    () => normalizeCommentBody("a".repeat(COMMENT_BODY_MAX_LENGTH + 1)),
    (error) => error instanceof AppError && error.code === "COMMENT_BODY_INVALID",
  );
  assert.throws(
    () => normalizeCommentBody(`含有${String.fromCharCode(0)}控制字符`),
    (error) => error instanceof AppError && error.code === "COMMENT_BODY_INVALID",
  );
  assert.throws(
    () => normalizeCommentBody(`含有${String.fromCharCode(7)}响铃`),
    (error) => error instanceof AppError && error.code === "COMMENT_BODY_INVALID",
  );
  assert.equal(normalizeCommentBody("  正常评论\r\n第二行  "), "正常评论\n第二行");
  assert.equal(normalizeCommentBody("允许\t制表与\n换行"), "允许\t制表与\n换行");
});

test("@ 解析按最长姓名匹配，未知 token 静默跳过", () => {
  const members = [
    { id: "a", names: ["小林", "林晓"] },
    { id: "b", names: ["小林同学"] },
    { id: "c", names: ["张三"] },
  ];
  assert.deepEqual(extractAtTokens("@小林同学，看一下 @张三。 @ghost"), ["小林同学", "张三", "ghost"]);
  assert.deepEqual(
    resolveMentionedMemberIds({
      body: "请 @小林同学 和 @张三 看一下，@ghost 不存在",
      members,
      selfMemberProfileId: "self",
    }).sort(),
    ["b", "c"],
  );
  assert.deepEqual(
    collectMemberNames({ nickname: "  小林  ", realName: "林晓", displayName: "小林" }),
    ["小林", "林晓"],
  );
});

test("提及合并请求 ID 与正文，未知显式 ID 失败，超限拒绝不截断", () => {
  const members = Array.from({ length: 12 }, (_, index) => ({
    id: `m${index}`,
    names: [`成员${index}`],
  }));

  assert.deepEqual(
    resolveMentionedMemberIds({
      body: "你好 @成员1",
      mentionedMemberProfileIds: ["m2", "m1"],
      members,
      selfMemberProfileId: "self",
    }).sort(),
    ["m1", "m2"],
  );

  assert.throws(
    () =>
      resolveMentionedMemberIds({
        body: "无",
        mentionedMemberProfileIds: ["missing"],
        members,
        selfMemberProfileId: "self",
      }),
    (error) => error instanceof AppError && error.code === "VALIDATION_FAILED",
  );

  assert.throws(
    () =>
      resolveMentionedMemberIds({
        body: members.map((member) => `@${member.names[0]}`).join(" "),
        members,
        selfMemberProfileId: "self",
        limit: COMMENT_MENTION_LIMIT,
      }),
    (error) => error instanceof AppError && error.code === "MENTION_LIMIT_EXCEEDED",
  );

  assert.deepEqual(
    resolveMentionedMemberIds({
      body: "自己 @成员0 不应被写入",
      members,
      selfMemberProfileId: "m0",
    }),
    [],
  );
});

test("评论与收藏请求拒绝未知字段", () => {
  assert.throws(
    () => createCommentInput({ body: "合法评论", authorId: "x" }),
    (error) => error instanceof AppError && error.code === "VALIDATION_FAILED",
  );
  assert.throws(
    () => createCommentInput({ body: 12 as unknown as string }),
    (error) => error instanceof AppError && error.code === "COMMENT_BODY_INVALID",
  );
  const created = createCommentInput({
    body: "合法评论",
    parentCommentId: null,
    mentionedMemberProfileIds: ["m1"],
  });
  assert.equal(created.body, "合法评论");
  assert.equal(created.parentCommentId, null);
  assert.deepEqual(created.mentionedMemberProfileIds, ["m1"]);

  assert.throws(
    () => createFavoriteInput({ repairRecordId: "r1", extra: true }),
    (error) => error instanceof AppError && error.code === "VALIDATION_FAILED",
  );
  assert.deepEqual(createFavoriteInput({ repairRecordId: " r1 " }), { repairRecordId: "r1" });
  assert.equal(notificationStatusFilter(new URLSearchParams("status=UNREAD")), "UNREAD");
  assert.throws(
    () => notificationStatusFilter(new URLSearchParams("status=DONE")),
    (error) => error instanceof AppError && error.code === "VALIDATION_FAILED",
  );
});

test("成员展示名与摘要截断按昵称/实名/账号名回退", () => {
  assert.deepEqual(
    memberRef({ id: "m1", nickname: "小林", realName: "林晓", user: { displayName: "账号" } }),
    { id: "m1", name: "小林" },
  );
  assert.equal(memberRef({ id: "m2", nickname: null, realName: "林晓" }).name, "林晓");
  assert.equal(excerptText("短内容"), "短内容");
  assert.equal(excerptText("字".repeat(61)).endsWith("…"), true);
  assert.equal([...excerptText("字".repeat(61))].length, 61);
});

test("M5 接入后文案不再声称排行未接入，且不出现内部里程碑编号", () => {
  const text = JSON.stringify({ communityCopy, memberCopy });
  // M5 已把维修排行做成真实数据：「后续模块开放」「尚未接入」这类承诺必须消失，
  // 否则页面会对外宣称一个并不存在的限制。
  assert.doesNotMatch(text, /后续模块开放|尚未接入/);
  // 内部里程碑编号（M4/M5）不得出现在任何用户可见文案里。
  assert.doesNotMatch(text, /M\d/);
  assert.doesNotMatch(text, /红点|角标|模拟数据/);
  // 排行区块的标题与状态文案仍然存在，避免把区块删空
  assert.match(memberCopy.dashboard.rankingTitle, /排行/);
  assert.equal(memberCopy.dashboard.rankingUnconfigured.length > 0, true);
});

/**
 * 回归：通知/收藏摘要**失败时不得把计数降级成 0**。
 *
 * 早先的实现失败时返回 `{ available: true, unreadCount: 0 }`，
 * 于是接口层面分不出「查询失败」和「真的没有未读」——调用方会把一次数据库故障
 * 渲染成「你没有新消息」，静默丢消息。现在与 M3 的 `MetricValue` 口径对齐：
 * `available: false` + 计数 `null`。
 */
test("通知/收藏摘要失败时 available 为 false 且计数为 null，不给 0", async () => {
  const failure = () => Promise.reject(new AppError("INTERNAL_ERROR", "库挂了"));

  const notifications = toNotificationSummary(await settleCommunity(failure()));
  const favorites = toFavoriteSummary(await settleCommunity(failure()));

  assert.equal(notifications.available, false);
  assert.equal(notifications.unreadCount, null);
  assert.notEqual(notifications.unreadCount, 0);
  assert.deepEqual(notifications.latest, []);

  assert.equal(favorites.available, false);
  assert.equal(favorites.count, null);
  assert.notEqual(favorites.count, 0);
  assert.deepEqual(favorites.latest, []);
});

test("通知/收藏摘要成功时保留真实计数，0 只可能来自查询结果本身", async () => {
  const notifications = toNotificationSummary(
    await settleCommunity(Promise.resolve({ unreadCount: 0, latest: [] })),
  );
  const favorites = toFavoriteSummary(await settleCommunity(Promise.resolve({ count: 3, latest: [] })));

  // 「0 条未读」是真实结论 —— 与上面的 null 必须是两个不同的值
  assert.equal(notifications.available, true);
  assert.equal(notifications.unreadCount, 0);

  assert.equal(favorites.available, true);
  assert.equal(favorites.count, 3);
});

test("settleCommunity 保留错误码，取不到 code 时退回既定兜底码", async () => {
  const withCode = await settleCommunity(Promise.reject(new AppError("INTERNAL_ERROR", "库挂了")));
  const withoutCode = await settleCommunity(Promise.reject(new Error("普通异常")));

  assert.deepEqual(withCode, { status: "failed", code: "INTERNAL_ERROR" });
  assert.deepEqual(withoutCode, { status: "failed", code: "OVERVIEW_SECTION_FAILED" });
});
