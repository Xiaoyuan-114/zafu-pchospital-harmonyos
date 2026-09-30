import type { Metadata } from "next";

import { LoginPanel, type AuthPanelMode } from "@/components/auth/LoginPanel";
import { Section } from "@/components/ui/Section";

export const metadata: Metadata = { title: "成员登录" };

type LoginPageProps = {
  searchParams: Promise<{ mode?: string | string[] }>;
};

function resolveMode(raw: string | string[] | undefined): AuthPanelMode {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "register" ? "register" : "login";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const mode = resolveMode(params.mode);

  return (
    <Section variant="page-head" className="auth-login" labelledBy="login-title">
      <LoginPanel mode={mode} />
    </Section>
  );
}
