import { assertExperimentDatabase } from "../../tools/db-target.mjs";

/** Integration tests write data and some clear whole tables: permit only this project's test DB. */
export function integrationTestsEnabled(): boolean {
  const enabled = process.env.RUN_DB_TESTS === "1" || process.env.npm_lifecycle_event === "test:db";
  if (!enabled) return false;
  assertTestDatabase();
  return true;
}

export function assertTestDatabase(): void {
  assertExperimentDatabase("test");
}

export function assertDestructiveDbAllowed(): void {
  assertExperimentDatabase("reset-test");
}
