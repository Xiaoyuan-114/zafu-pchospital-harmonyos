import assert from "node:assert/strict";
import { test } from "node:test";
import { assertDestructiveDbAllowed, assertTestDatabase, integrationTestsEnabled } from "../integration/db-guard";

function withTarget(database: string, run: () => void) {
  const saved = { ...process.env };
  try {
    process.env.EXPERIMENT_DEV_DB = "pchospital_exp_dev";
    process.env.EXPERIMENT_TEST_DB = "pchospital_exp_dev_test";
    process.env.DATABASE_URL = `mysql://user:placeholder@localhost/${database}`;
    run();
  } finally {
    process.env = saved;
  }
}

test("only the configured _test database permits database tests and reset", () => {
  withTarget("pchospital_exp_dev_test", () => {
    assert.doesNotThrow(assertTestDatabase);
    assert.doesNotThrow(assertDestructiveDbAllowed);
  });
});

test("development, production and unknown _test databases are rejected even with legacy overrides", () => {
  for (const database of ["pchospital_exp_dev", "zafu_pchospital", "unrelated_test"]) {
    withTarget(database, () => {
      process.env.ALLOW_NON_TEST_DB = "1";
      process.env.ALLOW_DESTRUCTIVE_DB_TESTS = "1";
      assert.throws(assertTestDatabase, /Refusing/);
      assert.throws(assertDestructiveDbAllowed, /Refusing/);
    });
  }
});

test("integration tests skip when disabled and reject the development database when enabled", () => {
  withTarget("pchospital_exp_dev", () => {
    delete process.env.RUN_DB_TESTS;
    delete process.env.npm_lifecycle_event;
    assert.equal(integrationTestsEnabled(), false);
    process.env.RUN_DB_TESTS = "1";
    assert.throws(integrationTestsEnabled, /Refusing/);
  });
});
