"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { registerCopy } from "@/config/auth";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/security/password-policy";

type FieldSpec = {
  name: string;
  label: string;
  placeholder: string;
  type: "text" | "tel" | "password";
  autoComplete: string;
  required: boolean;
};

const inviteFields: readonly FieldSpec[] = [
  {
    name: "code",
    label: registerCopy.codeLabel,
    placeholder: registerCopy.codePlaceholder,
    type: "text",
    autoComplete: "off",
    required: true,
  },
];

const identityFields: readonly FieldSpec[] = [
  {
    name: "realName",
    label: registerCopy.realNameLabel,
    placeholder: registerCopy.realNamePlaceholder,
    type: "text",
    autoComplete: "name",
    required: true,
  },
  {
    name: "qq",
    label: registerCopy.qqLabel,
    placeholder: registerCopy.qqPlaceholder,
    type: "text",
    autoComplete: "username",
    required: true,
  },
  {
    name: "phone",
    label: registerCopy.phoneLabel,
    placeholder: registerCopy.phonePlaceholder,
    type: "tel",
    autoComplete: "tel",
    required: true,
  },
  {
    name: "studentId",
    label: registerCopy.studentIdLabel,
    placeholder: registerCopy.studentIdPlaceholder,
    type: "text",
    autoComplete: "off",
    required: false,
  },
  {
    name: "className",
    label: registerCopy.classNameLabel,
    placeholder: registerCopy.classNamePlaceholder,
    type: "text",
    autoComplete: "off",
    required: false,
  },
];

const passwordFields: readonly FieldSpec[] = [
  {
    name: "password",
    label: registerCopy.passwordLabel,
    placeholder: registerCopy.passwordPlaceholder,
    type: "password",
    autoComplete: "new-password",
    required: true,
  },
  {
    name: "passwordConfirmation",
    label: registerCopy.passwordConfirmLabel,
    placeholder: registerCopy.passwordConfirmPlaceholder,
    type: "password",
    autoComplete: "new-password",
    required: true,
  },
];

const groups = [
  { title: registerCopy.groupInvite, fields: inviteFields },
  { title: registerCopy.groupIdentity, fields: identityFields },
  { title: registerCopy.groupPassword, fields: passwordFields },
] as const;

export function InviteRegistrationForm() {
  const router = useRouter();
  const key = useRef(crypto.randomUUID());
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setProblem("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (data.password !== data.passwordConfirmation) {
      setProblem(registerCopy.passwordMismatch);
      setBusy(false);
      return;
    }
    const response = await fetch("/api/v1/member-registrations/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, idempotencyKey: key.current }),
    });
    const payload = (await response.json()) as { success: boolean; error?: { message?: string } };
    if (!response.ok || !payload.success) {
      setProblem(payload.error?.message ?? registerCopy.failed);
      setBusy(false);
      return;
    }
    // MemberRegistrationResult（userId / memberProfileId / redemptionId / provisionId）
    // 不含 mustChangePassword；邀请码注册者自设密码，服务端为 false。不发明契约字段，
    // 成功后落到 /member（受保护页仍会按 Session 强制改密）。
    router.replace("/member");
    router.refresh();
  }

  return (
    <form method="post" className="auth-login__form auth-login__form--register" onSubmit={submit}>
      {groups.map((group) => (
        <fieldset key={group.title} className="auth-login__group">
          <legend className="auth-login__group-title">{group.title}</legend>
          {group.fields.map((field) => (
            <RegisterField key={field.name} field={field} />
          ))}
        </fieldset>
      ))}
      <Button className="auth-login__submit" type="submit" variant="solid" disabled={busy}>
        {busy ? registerCopy.submitting : registerCopy.submit}
      </Button>
      {problem ? (
        <p className="auth-login__problem" role="alert">
          {problem}
        </p>
      ) : null}
    </form>
  );
}

function RegisterField({ field }: { field: FieldSpec }) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = field.type === "password";
  const inputId = `register-${field.name}`;

  return (
    <div className="field">
      <label className="field__label" htmlFor={inputId}>
        {field.label}
        {field.required ? <span className="field__req">{registerCopy.requiredMark}</span> : null}
      </label>
      <div className={isPassword ? "auth-login__password" : undefined}>
        <input
          className="field__input"
          id={inputId}
          name={field.name}
          type={isPassword && revealed ? "text" : field.type}
          inputMode={field.name === "qq" ? "numeric" : undefined}
          placeholder={field.placeholder}
          autoComplete={field.autoComplete}
          minLength={isPassword ? PASSWORD_MIN_LENGTH : undefined}
          maxLength={isPassword ? PASSWORD_MAX_LENGTH : 80}
          required={field.required}
        />
        {isPassword ? (
          <button
            className="auth-login__password-toggle"
            type="button"
            aria-label={revealed ? registerCopy.hidePassword : registerCopy.showPassword}
            aria-pressed={revealed}
            onClick={() => setRevealed((visible) => !visible)}
          >
            <Icon name={revealed ? "eyeOff" : "eye"} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
