import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvFile } from "node:process";
import { disconnectDb, getDb } from "@/lib/db/client";
import { bearerFor } from "../tests/integration/staff-repair-harness";
import { sessionCookie } from "../tests/integration/http-harness";
import { assertExperimentDatabase } from "./db-target.mjs";

loadEnvFile(".env");
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
assertExperimentDatabase("test");
const base = new URL(process.env.COMMUNITY_HTTP_BASE_URL ?? "http://localhost:13082");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname))
  throw new Error("Local API required");
const db = getDb();
const ids = [randomUUID(), randomUUID()];
let requests = 0;

async function request(
  path: string,
  method = "GET",
  headers: Record<string, string> = {},
  body?: unknown,
  status = 200,
) {
  const response = await fetch(new URL("/api/v1/forum" + path, base), {
    method,
    headers: { ...headers, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  assert.equal(response.status, status, JSON.stringify(result));
  if (path !== "/posts" || method !== "POST") {
    assert.match(response.headers.get("cache-control") ?? "", /private/);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  }
  requests++;
  console.log(`${method} ${path.split("?")[0]} -> ${status}`);
  return result;
}

async function main() {
  try {
    const now = new Date();
    for (const id of ids)
      await db.user.create({
        data: {
          id,
          displayName: "PR109 合成用户",
          status: "ACTIVE",
          createdAt: now,
          updatedAt: now,
        },
      });
    await sessionCookie(ids[0]);
    const admin = await bearerFor(ids[0]);
    const customer = await bearerFor(ids[1]);
    await request("/circles");
    const input = {
      name: "PR109 HTTP 合成圈子",
      description: "接口回归样本",
      category: "电脑",
      createRequestKey: randomUUID(),
    };
    const created = await request("/circles", "POST", admin, input, 201);
    const circleId = created.data.id as string;
    const repeated = await Promise.all([
      request("/circles", "POST", admin, input, 201),
      request("/circles", "POST", admin, input, 201),
    ]);
    assert.ok(repeated.every((row) => row.data.id === circleId));
    const conflict = await request("/circles", "POST", admin, { ...input, name: "冲突样本" }, 409);
    assert.equal(conflict.error.code, "IDEMPOTENCY_CONFLICT");
    await request("/circles", "POST", customer, { ...input, createRequestKey: randomUUID() }, 403);
    const followed = await request(`/users/${ids[0]}/follow`, "POST", customer);
    assert.deepEqual(followed.data, { id: ids[0], displayName: "PR109 合成用户", following: true });
    const joined = await request(`/circles/${circleId}/membership`, "POST", customer);
    assert.equal(joined.data.joined, true);
    assert.equal(joined.data.canPost, true);
    const circles = await request("/circles?joined=true", "GET", customer);
    assert.ok(circles.data.some((row: { id: string }) => row.id === circleId));
    const post = await request(
      "/posts",
      "POST",
      customer,
      {
        category: "GENERAL",
        title: "HTTP 合成帖子",
        body: "合成正文",
        circleId,
        createRequestKey: randomUUID(),
      },
      201,
    );
    const hot = await request(`/posts?sort=hot&circleId=${circleId}`);
    assert.equal(hot.data[0].id, post.data.id);
    const checkIn = await request("/me/check-in", "POST", customer);
    const retry = await request("/me/check-in", "POST", customer);
    assert.equal(checkIn.data.points, 1);
    assert.equal(retry.data.points, 1);
    const entries = await request("/me/points", "GET", customer);
    assert.equal(entries.data.length, 1);
    const unfollowed = await request(`/users/${ids[0]}/follow`, "DELETE", customer);
    assert.deepEqual(unfollowed.data, {
      id: ids[0],
      displayName: "PR109 合成用户",
      following: false,
    });
  } finally {
    const users = { in: ids };
    await db.communityPointEntry.deleteMany({ where: { userId: users } });
    await db.communityDailyCheckIn.deleteMany({ where: { userId: users } });
    await db.forumPost.deleteMany({ where: { authorId: users } });
    await db.forumCircleMembership.deleteMany({ where: { userId: users } });
    await db.forumFollow.deleteMany({ where: { userId: users } });
    await db.forumCircle.deleteMany({ where: { createdBy: users } });
    await db.authSession.deleteMany({ where: { userId: users } });
    await db.passwordCredential.deleteMany({ where: { userId: users } });
    await db.userRole.deleteMany({ where: { userId: users } });
    await db.user.deleteMany({ where: { id: users } });
    await disconnectDb();
  }
  console.log(`Passed ${requests} real HTTP requests; synthetic fixtures cleaned.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
