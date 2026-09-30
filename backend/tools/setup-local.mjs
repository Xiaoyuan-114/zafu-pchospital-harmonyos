import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { parseEnv } from "node:util";
import { pathToFileURL } from "node:url";
import mariadb from "mariadb";
import { assertExperimentDatabase } from "./db-target.mjs";

const localHosts = ["localhost", "127.0.0.1", "::1", "[::1]"];

async function ask(label, secret = false) {
  if (!process.stdin.isTTY)
    throw new Error("首次配置需要交互终端，请在自己的终端运行 setup:local。");
  const output = secret
    ? new Writable({
        write(_chunk, _encoding, done) {
          done();
        },
      })
    : process.stdout;
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  try {
    if (secret) process.stdout.write(label);
    return await rl.question(secret ? "" : label);
  } finally {
    rl.close();
    if (secret) process.stdout.write("\n");
  }
}

export function validateLocalConfiguration(env) {
  assertExperimentDatabase("migrate", env);
  assertExperimentDatabase("test", { ...env, DATABASE_URL: env.TEST_DATABASE_URL });
  for (const key of ["DATABASE_URL", "TEST_DATABASE_URL"]) {
    const url = new URL(env[key]);
    if (!localHosts.includes(url.hostname)) throw new Error(`${key} 必须连接本机 MySQL。`);
    const expectedDatabase =
      key === "DATABASE_URL" ? env.EXPERIMENT_DEV_DB : env.EXPERIMENT_TEST_DB;
    if (decodeURIComponent(url.pathname.slice(1)) !== expectedDatabase) {
      throw new Error(`${key} 与配置的开发/测试库名不一致。`);
    }
  }
  for (const key of ["AUTH_SECRET", "INVITE_CODE_PEPPER", "PII_AUDIT_PEPPER"]) {
    if (!env[key] || env[key].length < 32 || env[key].includes("replace-")) {
      throw new Error(`${key} 缺失或仍为示例值，请填写随机密钥。`);
    }
  }
}

export async function setupLocal({ cwd = process.cwd(), prompt = ask } = {}) {
  const envPath = path.join(cwd, ".env");
  let env;
  if (existsSync(envPath)) {
    env = parseEnv(readFileSync(envPath, "utf8"));
    validateLocalConfiguration(env);
    console.log("保留已有 .env、账号和数据，仅应用已提交迁移与基础字典 seed。");
  } else {
    const host = (await prompt("本机 MySQL host [127.0.0.1]: ")).trim() || "127.0.0.1";
    if (!localHosts.includes(host))
      throw new Error("只支持本机 MySQL；请输入 localhost 或回环地址。");
    const port = Number((await prompt("MySQL port [3306]: ")).trim() || 3306);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("MySQL 端口无效。");
    const adminUser = (await prompt("本机管理员账号 [root]: ")).trim() || "root";
    const adminPassword = await prompt("管理员密码（不回显）: ", true);
    const suffix = (await prompt("课设库标识 [local]（小写字母/数字/下划线）: ")).trim() || "local";
    if (!/^[a-z0-9_]{1,22}$/.test(suffix) || suffix.endsWith("_test"))
      throw new Error("库标识需为 1–22 位小写字母/数字/下划线，不能以 _test 结尾。");
    const dev = `pchospital_exp_${suffix}`;
    const test = `${dev}_test`;
    const devUser = `pch_${suffix}`;
    const testUser = `${devUser}_test`;
    const connection = await mariadb.createConnection({
      host: host === "localhost" ? "127.0.0.1" : host.replace(/[\[\]]/g, ""),
      port,
      user: adminUser,
      password: adminPassword,
      allowPublicKeyRetrieval: true,
    });
    try {
      // Check every target before creating anything. No IF NOT EXISTS or account overwrite.
      const databases = await connection.query(
        "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME IN (?, ?)",
        [dev, test],
      );
      const users = await connection.query("SELECT User FROM mysql.user WHERE User IN (?, ?)", [
        devUser,
        testUser,
      ]);
      if (databases.length || users.length)
        throw new Error("同名课设库或账号已经存在：不会修改。请选择新的库标识，或使用原 .env。");
      const devPassword = randomBytes(24).toString("hex");
      const testPassword = randomBytes(24).toString("hex");
      const userHost = "localhost";
      for (const [database, username, password] of [
        [dev, devUser, devPassword],
        [test, testUser, testPassword],
      ]) {
        await connection.query(
          `CREATE DATABASE ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
        );
        await connection.query(
          `CREATE USER '${username}'@'${userHost}' IDENTIFIED BY '${password}'`,
        );
        await connection.query(
          `GRANT ALL PRIVILEGES ON ${database}.* TO '${username}'@'${userHost}'`,
        );
      }
      const urlHost = host === "::1" ? "[::1]" : host;
      env = {
        EXPERIMENT_DEV_DB: dev,
        EXPERIMENT_TEST_DB: test,
        DATABASE_URL: `mysql://${devUser}:${devPassword}@${urlHost}:${port}/${dev}`,
        TEST_DATABASE_URL: `mysql://${testUser}:${testPassword}@${urlHost}:${port}/${test}`,
        AUTH_SECRET: randomBytes(32).toString("hex"),
        INVITE_CODE_PEPPER: randomBytes(32).toString("hex"),
        PII_AUDIT_PEPPER: randomBytes(32).toString("hex"),
        APP_BASE_URL: "http://localhost:13080",
        RECRUITMENT_CYCLE: "course-local",
        ACADEMIC_TERM_START: "",
        ACADEMIC_TERM_END: "",
      };
      // Exclusive creation: a parallel setup cannot replace an existing configuration.
      writeFileSync(
        envPath,
        Object.entries(env)
          .map(([key, value]) => `${key}=${value}`)
          .join("\n") + "\n",
        { flag: "wx", mode: 0o600 },
      );
      console.log(`已建立 ${dev} / ${test}；新连接与密钥保存在本机 .env。管理员密码未保存。`);
    } finally {
      await connection.end();
    }
  }
  const require = createRequire(path.join(cwd, "package.json"));
  const run = (args) => {
    const result = spawnSync(process.execPath, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: "inherit",
      shell: false,
    });
    if (result.error || result.status !== 0)
      throw new Error("初始化步骤失败；已保留 .env 和数据库，解决错误后重新运行 setup:local。");
  };
  for (const mode of ["migrate", "seed", "migrate-test", "seed-test"])
    run(["tools/db-task.mjs", mode]);
  run([require.resolve("tsx/cli"), "tools/db-health.ts"]);
  console.log("本地后端准备完成。运行 corepack pnpm dev --port 13080。");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  setupLocal().catch((error) => {
    // Database driver errors can include SQL (and generated passwords); do not print them.
    console.error(
      error.sql || error.sqlMessage
        ? `MySQL 操作失败（${error.code ?? "连接/权限错误"}），请检查本机账号和建库权限。`
        : error.message,
    );
    process.exitCode = 1;
  });
}
