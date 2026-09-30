import assert from "node:assert/strict";
import test from "node:test";
import {
  checkDatabaseBaseline,
  databaseProduct,
  type DatabaseSessionInfo,
} from "../../src/lib/db/health-check";

const info: DatabaseSessionInfo = {
  databaseName: "pchospital_exp_local",
  timeZone: "+00:00",
  characterSet: "utf8mb4",
  collation: "utf8mb4_unicode_ci",
  version: "9.6.0",
  versionComment: "MySQL Community Server - GPL",
};
test("health accepts local MySQL and reports the actual product/version", () => {
  const result = checkDatabaseBaseline(info);
  assert.equal(result.ok, true);
  assert.equal(databaseProduct(info.version, info.versionComment), "MySQL");
  if (result.ok) assert.equal(result.info.version, "9.6.0");
  assert.equal(databaseProduct("8.0.32-27", "GreatSQL (GPL)"), "GreatSQL");
  assert.equal(databaseProduct("10.11-MariaDB", "mariadb.org"), "MariaDB");
  assert.equal(databaseProduct("8.0", "unrecognized"), "Unknown MySQL-compatible server");
});
test("health still rejects non-UTC or wrong database encoding", () => {
  for (const change of [
    { timeZone: "+08:00" },
    { characterSet: "utf8" },
    { collation: "utf8mb4_general_ci" },
  ]) {
    assert.equal(checkDatabaseBaseline({ ...info, ...change }).ok, false);
  }
});
