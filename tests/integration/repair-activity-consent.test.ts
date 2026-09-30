import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { POST } from "../../src/app/api/v1/repair-activities/[id]/registrations/route";
import { repairActivityConsentVersion } from "../../src/config/repair-activities";
import { resetRateLimitsForTests } from "../../src/lib/api/rate-limit";
import { disconnectDb, getDb } from "../../src/lib/db/client";
import { integrationTestsEnabled } from "./db-guard";
import { callRoute } from "./http-harness";

/* 集成测试的统一闸门：指向非测试库时**在加载阶段就抛错**（`db-guard.ts` 里写了两次
   实际事故）。未开启时返回 false，各文件照常走 test.skip。 */
const enabled = integrationTestsEnabled();
const dbTest = enabled ? test : test.skip;

/**
 * 活动报名免责声明的集成测试（真实 GreatSQL，issue #62 前端3）。
 *
 * 为什么必须打到**路由**而不是直接调 service：弹层只是把「同意」问清楚，报名接口是
 * 公开的，真正拦住绕过弹层直接发请求的是路由 + service 里那道 `consentAccepted !== true`。
 * 只有走 `callRoute()` 才能覆盖「请求体里根本没这个字段」这种真实攻击形态。
 *
 * 独立的 UUID 段 `e6200000-…` 与标题前缀 "REG62 " —— 清理一律按这两者限定，
 * 绝不触碰库里已有的活动与报名（那是开发者/生产同源的开发数据）。
 */
const ACTIVITY_ID = "e6200000-0000-4000-8000-000000000001";
const ACTIVITY_TITLE = "REG62 免责声明集成测试活动";
const REGISTRATION_PATH = `http://localhost/api/v1/repair-activities/${ACTIVITY_ID}/registrations`;

/** 失败信封里的错误码（`apiFailure` 的 `error.code`）。 */
function errorCodeOf(json: Record<string, unknown>): string | undefined {
  return (json.error as { code?: string } | undefined)?.code;
}

/**
 * 活动建在「报名窗口内、名额未满」——只有 OPEN 才可能报上名，否则测到的是
 * `ACTIVITY_NOT_OPEN` 而不是同意校验。
 */
async function prepareFixtures(): Promise<void> {
  const db = getDb();
  const registrations = await db.repairActivityRegistration.findMany({
    where: { activityId: ACTIVITY_ID },
    select: { id: true },
  });
  // 报名的审计日志以报名 ID 为 targetId（对 User 是 Restrict，对 target 无外键，
  // 但先删日志能让重复跑用例不留下垃圾）。
  await db.auditLog.deleteMany({
    where: {
      targetType: "RepairActivityRegistration",
      targetId: { in: registrations.map((row) => row.id) },
    },
  });
  await db.repairActivityRegistration.deleteMany({ where: { activityId: ACTIVITY_ID } });
  await db.repairActivityAttendance.deleteMany({ where: { activityId: ACTIVITY_ID } });
  await db.repairActivity.deleteMany({ where: { id: ACTIVITY_ID } });

  const now = new Date();
  const hour = 60 * 60 * 1000;
  await db.repairActivity.create({
    data: {
      id: ACTIVITY_ID,
      title: ACTIVITY_TITLE,
      activityAt: new Date(now.getTime() + 7 * 24 * hour),
      capacity: 5,
      signupOpensAt: new Date(now.getTime() - hour),
      signupClosesAt: new Date(now.getTime() + 24 * hour),
      createdAt: now,
      updatedAt: now,
    },
  });
}

async function cleanupFixtures(): Promise<void> {
  const db = getDb();
  const registrations = await db.repairActivityRegistration.findMany({
    where: { activityId: ACTIVITY_ID },
    select: { id: true },
  });
  await db.auditLog.deleteMany({
    where: {
      targetType: "RepairActivityRegistration",
      targetId: { in: registrations.map((row) => row.id) },
    },
  });
  await db.repairActivityRegistration.deleteMany({ where: { activityId: ACTIVITY_ID } });
  await db.repairActivity.deleteMany({ where: { id: ACTIVITY_ID } });
}

function signup(body: Record<string, unknown>) {
  return callRoute(POST, REGISTRATION_PATH, { method: "POST", body, params: { id: ACTIVITY_ID } });
}

async function effectiveRegistrationCount(): Promise<number> {
  return getDb().repairActivityRegistration.count({ where: { activityId: ACTIVITY_ID } });
}

before(async () => {
  if (!enabled) return;
  // 同一个 IP 桶在文件内多次调用会累计（10 次/分钟）；清掉以免与其它用例相互挤占。
  resetRateLimitsForTests();
  await prepareFixtures();
});

after(async () => {
  if (!enabled) return;
  await cleanupFixtures();
  await disconnectDb();
});

dbTest("请求体里没有 consentAccepted：400 且不落库", async () => {
  const created = await signup({ name: "REG62 甲", phone: "13900000001", issueType: "CLEAN_ONLY" });
  assert.equal(created.status, 400);
  assert.equal(errorCodeOf(created.json), "ACTIVITY_CONSENT_REQUIRED");
  assert.equal(await effectiveRegistrationCount(), 0, "被拦下的报名不该留下任何记录");
});

dbTest("consentAccepted 不是布尔 true：同样 400（字符串 'true' 也不算同意）", async () => {
  for (const value of [false, "true", 1]) {
    const created = await signup({
      name: "REG62 乙",
      phone: "13900000002",
      issueType: "CLEAN_ONLY",
      consentAccepted: value,
    });
    assert.equal(created.status, 400, `consentAccepted=${JSON.stringify(value)} 应当被拒绝`);
    assert.equal(errorCodeOf(created.json), "ACTIVITY_CONSENT_REQUIRED");
  }
  assert.equal(await effectiveRegistrationCount(), 0);
});

dbTest("字段错误优先于同意校验：手机号非法时报 VALIDATION_FAILED", async () => {
  const created = await signup({ name: "REG62 丙", phone: "12345", issueType: "CLEAN_ONLY" });
  assert.equal(created.status, 400);
  assert.equal(
    errorCodeOf(created.json),
    "VALIDATION_FAILED",
    "应先报「手机号格式不正确」，否则填错号的人会先看到「请先同意免责声明」",
  );
});

dbTest("同意后报名成功：落库同意版本与时间，并能选到新增的软件 / 系统问题", async () => {
  const created = await signup({
    name: "REG62 丁",
    phone: "139-0000-0004",
    issueType: "SOFTWARE_SYSTEM",
    consentAccepted: true,
  });
  assert.equal(created.status, 201);
  const data = created.json.data as { id: string; issueType: string; phoneMasked: string };
  assert.equal(data.issueType, "SOFTWARE_SYSTEM");

  const row = await getDb().repairActivityRegistration.findUniqueOrThrow({
    where: { id: data.id },
  });
  assert.equal(row.phone, "13900000004", "手机号按规范化后的 11 位存储");
  assert.equal(row.consentVersion, repairActivityConsentVersion);
  assert.ok(row.consentAcceptedAt, "同意时间必须落库");

  const audit = await getDb().auditLog.findFirst({
    where: { targetType: "RepairActivityRegistration", targetId: data.id },
  });
  assert.ok(audit, "报名必须留痕");
  assert.equal(
    (audit.afterSummary as { consentVersion?: string } | null)?.consentVersion,
    repairActivityConsentVersion,
  );
});
