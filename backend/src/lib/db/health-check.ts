export const REQUIRED_TIME_ZONE = "+00:00";
export const REQUIRED_CHARACTER_SET = "utf8mb4";
export const REQUIRED_COLLATION = "utf8mb4_unicode_ci";

export type DatabaseSessionInfo = {
  databaseName: string | null;
  timeZone: string;
  characterSet: string;
  collation: string;
  version: string;
  versionComment: string;
};
export type HealthCheckResult =
  { ok: true; info: DatabaseSessionInfo } | { ok: false; reason: string };

/** Report the actual server product, without claiming a particular distribution was tested. */
export function databaseProduct(version: string, comment: string): string {
  if (/GreatSQL/i.test(comment)) return "GreatSQL";
  if (/MariaDB/i.test(version + comment)) return "MariaDB";
  if (/MySQL/i.test(comment)) return "MySQL";
  return "Unknown MySQL-compatible server";
}

export function checkDatabaseBaseline(info: DatabaseSessionInfo): HealthCheckResult {
  if (info.timeZone !== REQUIRED_TIME_ZONE) {
    return { ok: false, reason: `会话时区必须为 ${REQUIRED_TIME_ZONE}，实际为 ${info.timeZone}` };
  }
  if (info.characterSet !== REQUIRED_CHARACTER_SET || info.collation !== REQUIRED_COLLATION) {
    return {
      ok: false,
      reason: `字符集/排序规则必须为 ${REQUIRED_CHARACTER_SET} / ${REQUIRED_COLLATION}，实际为 ${info.characterSet} / ${info.collation}`,
    };
  }
  return { ok: true, info };
}
