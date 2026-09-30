import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { disconnectDb, getDb } from "../src/lib/db/client";
import {
  checkDatabaseBaseline,
  databaseProduct,
  type DatabaseSessionInfo,
} from "../src/lib/db/health-check";

if (existsSync(".env")) loadEnvFile(".env");

/**
 * 数据库健康检查（`pnpm db:health`）。
 *
 * 报告实际产品和版本，校验 UTC、utf8mb4 / utf8mb4_unicode_ci 及 InnoDB。
 *
 * 判定逻辑在 `src/lib/db/health-check.ts`，那里有单测覆盖；本文件只负责取数与输出。
 */

async function main(): Promise<void> {
  try {
    const rows = await getDb().$queryRaw<Array<DatabaseSessionInfo>>`
      SELECT DATABASE() AS databaseName,
             @@session.time_zone AS timeZone,
             @@character_set_database AS characterSet,
             @@collation_database AS collation,
             @@version AS version,
             @@version_comment AS versionComment
    `;
    const info = rows[0];
    if (!info) throw new Error("无法读取数据库会话信息");

    const verdict = checkDatabaseBaseline(info);
    if (!verdict.ok) throw new Error(verdict.reason);

    // 业务表引擎必须全部 InnoDB（迁移脚本已固定，这里防回归）。
    const nonInnoDb = await getDb().$queryRaw<Array<{ tableName: string; engine: string }>>`
      SELECT table_name AS tableName, engine
      FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' AND engine <> 'InnoDB'
    `;
    if (nonInnoDb.length > 0) {
      throw new Error(`发现非 InnoDB 业务表：${JSON.stringify(nonInnoDb)}`);
    }

    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        product: databaseProduct(info.version, info.versionComment),
        version: info.version,
        versionComment: info.versionComment,
        databaseName: info.databaseName,
        timeZone: info.timeZone,
        characterSet: info.characterSet,
        collation: info.collation,
      })}\n`,
    );
  } finally {
    await disconnectDb();
  }
}

void main();
