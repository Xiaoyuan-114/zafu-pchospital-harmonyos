import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "mysql://x:x@127.0.0.1:3306/x";
process.env.AUTH_SECRET ??= "test-auth-secret-for-activity-edit-token";
process.env.INVITE_CODE_PEPPER ??= "pepper";
process.env.PII_AUDIT_PEPPER ??= "pii";

import {
  issueRegistrationEditToken,
  verifyRegistrationEditToken,
} from "../../src/features/repair-activities/edit-token";
import { AppError } from "../../src/lib/api/errors";
import { resetServerEnvForTests } from "../../src/lib/env";

resetServerEnvForTests();

test("editToken 签发后可校验，过期或篡改拒绝", () => {
  resetServerEnvForTests();
  const now = new Date("2026-09-25T12:00:00.000Z");
  const { editToken } = issueRegistrationEditToken("reg-1", "act-1", now);
  assert.doesNotThrow(() =>
    verifyRegistrationEditToken(editToken, { registrationId: "reg-1", activityId: "act-1" }, now),
  );
  assert.throws(
    () =>
      verifyRegistrationEditToken(editToken, { registrationId: "reg-2", activityId: "act-1" }, now),
    (error) => error instanceof AppError && error.code === "ACTIVITY_EDIT_TOKEN_INVALID",
  );
  const expired = new Date(now.getTime() + 11 * 60 * 1000);
  assert.throws(
    () =>
      verifyRegistrationEditToken(
        editToken,
        { registrationId: "reg-1", activityId: "act-1" },
        expired,
      ),
    (error) => error instanceof AppError && error.code === "ACTIVITY_EDIT_TOKEN_INVALID",
  );
  assert.throws(
    () =>
      verifyRegistrationEditToken(
        "not.a.token",
        { registrationId: "reg-1", activityId: "act-1" },
        now,
      ),
    (error) => error instanceof AppError && error.code === "ACTIVITY_EDIT_TOKEN_INVALID",
  );
});
