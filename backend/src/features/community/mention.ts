import { AppError } from "@/lib/api/errors";
import { COMMENT_MENTION_LIMIT } from "@/types/contracts";

/**
 * @ 解析与合并（M4）。
 *
 * 产品约定：请求里的 `mentionedMemberProfileIds` 与正文里的 `@姓名` **并集**。
 * 姓名回退链与展示名一致：昵称 / 实名 / 账号展示名。未知、停用、自己一律跳过。
 * 超限拒绝，不截断 —— 截断会让调用方以为提及已全部生效。
 */

export type MentionMember = {
  id: string;
  names: readonly string[];
};

const NAME_BOUNDARY = /[\s,.;:!?，。！？、；：）)\]】》"'”’]/u;

export function collectMemberNames(row: {
  nickname: string | null;
  realName: string;
  displayName: string | null;
}): string[] {
  const names = [row.nickname, row.realName, row.displayName]
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.length > 0);
  return [...new Set(names)];
}

/** 从正文提取可能的 @ 片段，供单测与调试；正式解析走最长名匹配。 */
export function extractAtTokens(body: string): string[] {
  const tokens: string[] = [];
  for (let index = 0; index < body.length; index += 1) {
    if (body[index] !== "@") continue;
    let end = index + 1;
    while (end < body.length && body[end] !== "@" && !NAME_BOUNDARY.test(body[end] ?? "")) {
      end += 1;
    }
    const token = body.slice(index + 1, end);
    if (token) tokens.push(token);
    index = Math.max(index, end - 1);
  }
  return tokens;
}

function matchMentionedIds(body: string, members: readonly MentionMember[]): string[] {
  const catalog = members
    .flatMap((member) => member.names.map((name) => ({ id: member.id, name })))
    .filter((entry) => entry.name.length > 0)
    .sort((a, b) => b.name.length - a.name.length || a.name.localeCompare(b.name, "zh-Hans-CN"));

  const found = new Set<string>();
  for (let index = 0; index < body.length; index += 1) {
    if (body[index] !== "@") continue;
    const rest = body.slice(index + 1);
    const hit = catalog.find((entry) => {
      if (!rest.startsWith(entry.name)) return false;
      const next = rest[entry.name.length];
      return next === undefined || NAME_BOUNDARY.test(next);
    });
    if (hit) {
      found.add(hit.id);
      index += hit.name.length;
    }
  }
  return [...found];
}

export function resolveMentionedMemberIds(input: {
  body: string;
  mentionedMemberProfileIds?: readonly string[];
  members: readonly MentionMember[];
  selfMemberProfileId: string;
  limit?: number;
}): string[] {
  const limit = input.limit ?? COMMENT_MENTION_LIMIT;
  const activeIds = new Set(input.members.map((member) => member.id));
  const fromBody = matchMentionedIds(input.body, input.members);
  const fromIds = (input.mentionedMemberProfileIds ?? []).filter(
    (id) => typeof id === "string" && id.trim() !== "",
  );
  const unknown = fromIds.filter((id) => !activeIds.has(id));
  if (unknown.length > 0) {
    throw new AppError("VALIDATION_FAILED", "存在无法识别的提及成员", {
      fieldErrors: { mentionedMemberProfileIds: unknown },
    });
  }
  const merged = [...new Set([...fromBody, ...fromIds])].filter(
    (id) => id !== input.selfMemberProfileId && activeIds.has(id),
  );
  if (merged.length > limit) {
    throw new AppError("MENTION_LIMIT_EXCEEDED", `单条评论最多提及 ${limit} 名成员`);
  }
  return merged;
}
