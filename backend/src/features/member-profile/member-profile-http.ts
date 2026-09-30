import { AppError } from "@/lib/api/errors";
import type { UpdateMemberProfileInput, UpdateMemberSkillsInput } from "@/types/contracts";

/**
 * 成员资料接口的请求解析（M3 任务书 §10.2、§10.3）。
 *
 * 严格白名单：未知字段一律拒绝，不做静默写入 —— 防止普通成员借 PATCH/PUT
 * 越权修改 `realName` / `qq` / `studentId` / `className` / `status` / `joinedAt` /
 * `role` / `userId` 等受控字段。
 */

function rejectUnknownFields(body: Record<string, unknown>, allowed: readonly string[]): void {
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new AppError("VALIDATION_FAILED", "请求包含不允许的字段", {
      fieldErrors: Object.fromEntries(unknown.map((key) => [key, ["不允许修改该字段"]])),
    });
  }
}

export function updateProfileInput(body: Record<string, unknown>): UpdateMemberProfileInput {
  rejectUnknownFields(body, ["nickname", "version"]);
  const version = body.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new AppError("VALIDATION_FAILED", "version 必须是正整数", {
      fieldErrors: { version: ["version 必须是正整数"] },
    });
  }
  const input: UpdateMemberProfileInput = { version };
  // 显式区分「字段缺席」与「显式 null 清空」：只有出现该键时才透传。
  if (Object.prototype.hasOwnProperty.call(body, "nickname")) {
    const nickname = body.nickname;
    if (nickname !== null && typeof nickname !== "string") {
      throw new AppError("MEMBER_PROFILE_INVALID_NICKNAME", "昵称必须是字符串或 null", {
        fieldErrors: { nickname: ["昵称必须是字符串或 null"] },
      });
    }
    input.nickname = nickname;
  }
  return input;
}

export function updateSkillsInput(body: Record<string, unknown>): UpdateMemberSkillsInput {
  rejectUnknownFields(body, ["skillIds", "profileVersion"]);
  const skillIds = body.skillIds;
  if (!Array.isArray(skillIds)) {
    throw new AppError("SKILL_SELECTION_INVALID", "skillIds 必须是数组", {
      fieldErrors: { skillIds: ["skillIds 必须是数组"] },
    });
  }
  const profileVersion = body.profileVersion;
  if (typeof profileVersion !== "number" || !Number.isInteger(profileVersion) || profileVersion < 1) {
    throw new AppError("VALIDATION_FAILED", "profileVersion 必须是正整数", {
      fieldErrors: { profileVersion: ["profileVersion 必须是正整数"] },
    });
  }
  return { skillIds: skillIds as string[], profileVersion };
}
