import assert from "node:assert/strict";
import test from "node:test";

import { AppError } from "../../src/lib/api/errors";
import { permissionsForRoles, requirePermission } from "../../src/lib/auth/permissions";

test("管理员与成员权限边界固定", () => {
  assert.equal(permissionsForRoles(["MEMBER"]).includes("join:read"), false);
  assert.equal(permissionsForRoles(["ADMIN"]).includes("join:review"), true);
  assert.equal(permissionsForRoles(["MEMBER"]).includes("member:manage"), false);
  assert.equal(permissionsForRoles(["ADMIN"]).includes("member:manage"), true);
});

test("M4 交流权限：成员可评论/收藏/读通知，不能删他人评论", () => {
  const member = permissionsForRoles(["MEMBER"]);
  const admin = permissionsForRoles(["ADMIN"]);
  for (const permission of ["comment:create", "comment:read", "favorite:manage", "notification:read"] as const) {
    assert.equal(member.includes(permission), true, `成员缺少 ${permission}`);
    assert.equal(admin.includes(permission), true, `管理员缺少 ${permission}`);
  }
  assert.equal(member.includes("comment:delete"), false);
  assert.equal(admin.includes("comment:delete"), true);
});

test("未登录、禁用账号与普通成员均不能读取报名", () => {
  assert.throws(
    () => requirePermission(null, "join:read"),
    (error) => hasCode(error, "UNAUTHENTICATED"),
  );
  assert.throws(
    () =>
      requirePermission(
        {
          actorType: "USER",
          userId: "user",
          userStatus: "DISABLED",
          permissions: ["join:read"],
          requestId: "req",
        },
        "join:read",
      ),
    (error) => hasCode(error, "FORBIDDEN"),
  );
  assert.throws(
    () =>
      requirePermission(
        {
          actorType: "USER",
          userId: "user",
          userStatus: "ACTIVE",
          permissions: permissionsForRoles(["MEMBER"]),
          requestId: "req",
        },
        "join:read",
      ),
    (error) => hasCode(error, "FORBIDDEN"),
  );
});

function hasCode(error: unknown, code: string): boolean {
  return error instanceof AppError && error.code === code;
}


test("维修活动权限：管理员可管，成员仅 staff", () => {
  const member = permissionsForRoles(["MEMBER"]);
  const admin = permissionsForRoles(["ADMIN"]);
  assert.equal(member.includes("activity:admin"), false);
  assert.equal(member.includes("activity:staff"), true);
  assert.equal(admin.includes("activity:admin"), true);
  assert.equal(admin.includes("activity:staff"), true);
});
