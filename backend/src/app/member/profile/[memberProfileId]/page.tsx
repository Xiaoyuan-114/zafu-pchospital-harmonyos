import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { MemberInternalProfile } from "@/components/member/MemberInternalProfile";
import { Section } from "@/components/ui/Section";
import { memberCopy } from "@/config/member";
import { requireActiveMemberPage } from "@/lib/auth/member-page";

export const metadata: Metadata = { title: memberCopy.internal.title };

/**
 * `/member/profile/[memberProfileId]` —— 他人内部主页
 *
 * 打开自己的 ID 时重定向到 `/member/profile`（任务书 §12.3）：
 * 自我视图与他人视图的字段集与操作能力不同，
 * 用一个视图渲染两种语义会让人分不清"我能不能改这个字段"。
 */
export default async function MemberInternalProfilePage({
  params,
}: {
  params: Promise<{ memberProfileId: string }>;
}) {
  const principal = await requireActiveMemberPage();
  const { memberProfileId } = await params;

  if (!memberProfileId) notFound();
  if (memberProfileId === principal.memberProfileId) redirect("/member/profile");

  return (
    <Section variant="page-head" className="member-workspace" labelledBy="member-internal-title">
      <MemberInternalProfile memberProfileId={memberProfileId} />
    </Section>
  );
}
