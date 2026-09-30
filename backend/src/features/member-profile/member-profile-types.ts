import { AppError } from "@/lib/api/errors";
import { MEMBER_NICKNAME_MAX_LENGTH } from "@/types/contracts";

/**
 * 昵称规范化与校验（M3 任务书 §10.2）。
 *
 * 规则：
 * - 去首尾空白后为 1–64 字符；
 * - 允许显式 `null`（或空串）清空；
 * - 不接受仅为空白的字符串（视为清空输入而非合法昵称）；
 * - 拒绝控制字符与零宽字符，避免存储层出现不可见内容。
 */

const CONTROL_OR_INVISIBLE = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\uFEFF]/;

export type NicknameNormalization =
  | { kind: "UNCHANGED" }
  | { kind: "CLEAR" }
  | { kind: "SET"; value: string };

/**
 * 把外部输入规范化为「不变 / 清空 / 赋值」三种意图。
 * 抛出 `MEMBER_PROFILE_INVALID_NICKNAME` 时带 `fieldErrors.nickname`，供统一信封使用。
 */
export function normalizeNickname(input: unknown): NicknameNormalization {
  if (input === undefined) return { kind: "UNCHANGED" };
  if (input === null) return { kind: "CLEAR" };
  if (typeof input !== "string") {
    throw invalidNickname("昵称必须是字符串或 null");
  }
  const trimmed = input.trim();
  if (trimmed === "") return { kind: "CLEAR" };
  if (CONTROL_OR_INVISIBLE.test(trimmed)) {
    throw invalidNickname("昵称不能包含控制字符或不可见字符");
  }
  // 按 Unicode 码点计数，避免 emoji / 汉字被按 UTF-16 单元误判超长。
  const length = [...trimmed].length;
  if (length > MEMBER_NICKNAME_MAX_LENGTH) {
    throw invalidNickname(`昵称长度不能超过 ${MEMBER_NICKNAME_MAX_LENGTH} 个字符`);
  }
  return { kind: "SET", value: trimmed };
}

function invalidNickname(message: string): AppError {
  return new AppError("MEMBER_PROFILE_INVALID_NICKNAME", message, {
    fieldErrors: { nickname: [message] },
  });
}
