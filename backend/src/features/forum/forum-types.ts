export const ForumCategory = ["GENERAL", "EXPERIENCE", "QUESTION"] as const;
export type ForumCategory = (typeof ForumCategory)[number];

export const forumCategoryLabels: Readonly<Record<ForumCategory, string>> = {
  GENERAL: "综合交流",
  EXPERIENCE: "经验分享",
  QUESTION: "问题求助",
};

export function isForumCategory(value: string): value is ForumCategory {
  return (ForumCategory as readonly string[]).includes(value);
}
