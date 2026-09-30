import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { PageHead } from "@/components/layout/PageHead";
import { Section } from "@/components/ui/Section";
export const metadata: Metadata = { title: "修改密码" };
export default function ChangePasswordPage() {
  return (
    <>
      <PageHead
        id="change-password-title"
        index="10"
        label="Account"
        title="修改密码"
        lead="首次登录必须先更换初始密码。"
      />
      <Section labelledBy="change-password-form-title">
        <h2 className="sr-only" id="change-password-form-title">
          修改密码表单
        </h2>
        <ChangePasswordForm />
      </Section>
    </>
  );
}
