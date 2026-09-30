import { AppError } from "@/lib/api/errors";
import { parseAcademicTermConfig } from "@/lib/academic-term";

const REQUIRED_SERVER_ENV = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "INVITE_CODE_PEPPER",
  "PII_AUDIT_PEPPER",
] as const;

export type ServerEnv = Record<(typeof REQUIRED_SERVER_ENV)[number], string> & {
  APP_BASE_URL: string;
  /** 学期口径原始值。空串表示未配置；非法配置在下方校验阶段直接抛错。 */
  ACADEMIC_TERM_START: string;
  ACADEMIC_TERM_END: string;
};

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const missing = REQUIRED_SERVER_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new AppError("INTERNAL_ERROR", `缺少服务端环境变量：${missing.join(", ")}`, {
      status: 500,
    });
  }

  // 学期口径启动校验：两项皆空合法；只配一项 / 格式非法 / 区间倒置直接失败。
  const academicTermStart = process.env.ACADEMIC_TERM_START ?? "";
  const academicTermEnd = process.env.ACADEMIC_TERM_END ?? "";
  const termParse = parseAcademicTermConfig(academicTermStart, academicTermEnd);
  if (!termParse.ok) {
    throw new AppError("ACADEMIC_TERM_CONFIG_INVALID", `学期配置无效：${termParse.message}`);
  }

  cached = {
    DATABASE_URL: process.env.DATABASE_URL!,
    AUTH_SECRET: process.env.AUTH_SECRET!,
    INVITE_CODE_PEPPER: process.env.INVITE_CODE_PEPPER!,
    PII_AUDIT_PEPPER: process.env.PII_AUDIT_PEPPER!,
    APP_BASE_URL: process.env.APP_BASE_URL ?? "http://localhost:3000",
    ACADEMIC_TERM_START: academicTermStart.trim(),
    ACADEMIC_TERM_END: academicTermEnd.trim(),
  };
  return cached;
}

export function resetServerEnvForTests(): void {
  cached = undefined;
}
