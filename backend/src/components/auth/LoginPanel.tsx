import Link from "next/link";

import { InviteRegistrationForm } from "@/components/auth/InviteRegistrationForm";
import { LoginForm } from "@/components/auth/LoginForm";
import { loginCopy, registerCopy } from "@/config/auth";
import { cn } from "@/lib/utils";

export type AuthPanelMode = "login" | "register";

type LoginPanelProps = {
  mode?: AuthPanelMode;
};

/**
 * 同一 Auth 壳：登录 ↔ 邀请码注册仅换标题与表单，不跳公开营销布局。
 * `mode` 由 `/login?mode=register` 驱动；切换用 Link.replace，保证返回键合理。
 */
export function LoginPanel({ mode = "login" }: LoginPanelProps) {
  const isRegister = mode === "register";
  const shell = isRegister ? registerCopy : loginCopy;

  return (
    <div className={cn("auth-login__panel", isRegister && "auth-login__panel--register")}>
      <Link className="auth-login__brand" href="/" aria-label={`${shell.brandName} · 返回首页`}>
        <b>{shell.brandMark}</b>
        <span>{shell.brandName}</span>
      </Link>

      <header className="auth-login__header">
        <p className="eyebrow">{shell.eyebrow}</p>
        <h1 id="login-title">{shell.title}</h1>
        <p>{shell.lead}</p>
      </header>

      {isRegister ? <InviteRegistrationForm /> : <LoginForm />}

      <div className="auth-login__links">
        {isRegister ? (
          <>
            <p>
              <Link href="/login" replace scroll={false}>
                {registerCopy.loginAction}
              </Link>
            </p>
            <p>
              {registerCopy.joinPrompt}{" "}
              <Link href="/join">{registerCopy.joinAction}</Link>
            </p>
          </>
        ) : (
          <>
            <p>
              {loginCopy.registerPrompt}{" "}
              <Link href="/login?mode=register" replace scroll={false}>
                {loginCopy.registerAction}
              </Link>
            </p>
            <p>
              {loginCopy.joinPrompt}{" "}
              <Link href="/join">{loginCopy.joinAction}</Link>
            </p>
          </>
        )}
        <Link className="auth-login__home" href="/">
          {shell.backHome}
        </Link>
      </div>
    </div>
  );
}
