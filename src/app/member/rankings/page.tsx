import type { Metadata } from "next";

import { RankingsPageBody } from "@/components/rankings/RankingsPageBody";
import { Section } from "@/components/ui/Section";
import { rankingsPage } from "@/config/rankings";
import { requireActiveMemberPage } from "@/lib/auth/member-page";

export const metadata: Metadata = { title: rankingsPage.title };

/**
 * `/member/rankings` —— 内部排行榜。
 *
 * 页面本身不做任何统计：默认筛选条件交给客户端的 `RankingsPageBody`，
 * 由它请求 `/api/v1/member/rankings`（服务端白名单解析参数、数据库内聚合与排名）。
 * 守卫用 `requireActiveMemberPage()`：排行榜要求**有效成员身份**，
 * 与 `/member/profile`、`/member/repairs/**` 保持同一档。
 */
export default async function MemberRankingsPage() {
  await requireActiveMemberPage();

  return (
    <Section variant="page-head" className="member-workspace" labelledBy="member-rankings-title">
      <RankingsPageBody scope="TERM" metric="REPAIR_COUNT" />
    </Section>
  );
}
