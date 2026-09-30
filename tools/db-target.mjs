/** Fail closed for all commands that can change an experiment database. */
export function assertExperimentDatabase(mode, env = process.env) {
  const dev = env.EXPERIMENT_DEV_DB;
  const test = env.EXPERIMENT_TEST_DB;
  if (!/^pchospital_exp_[a-z0-9_]+$/.test(dev ?? "") || dev.endsWith("_test")) {
    throw new Error("EXPERIMENT_DEV_DB must be an experiment development database");
  }
  if (!/^pchospital_exp_[a-z0-9_]+_test$/.test(test ?? "") || test === dev) {
    throw new Error("EXPERIMENT_TEST_DB must be a distinct _test experiment database");
  }
  let url;
  try { url = new URL(env.DATABASE_URL ?? ""); }
  catch { throw new Error("DATABASE_URL is missing or invalid"); }
  const db = decodeURIComponent(url.pathname.slice(1));
  if (url.protocol !== "mysql:" || !db || db.includes("/") || db.includes("\\")) {
    throw new Error("DATABASE_URL must name one MySQL database");
  }
  const allowed = mode === "test" || mode === "reset-test" ? db === test : db === dev || db === test;
  if (!allowed) throw new Error(`Refusing ${mode} against unknown or production database: ${db}`);
  return db;
}
