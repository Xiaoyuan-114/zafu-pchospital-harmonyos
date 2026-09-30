/** /join 表单与同源报名 API 之间的唯一客户端接口层。 */

/** 提交给后端的登记数据。字段名即接口字段名，不要在页面里另起别名。 */
export type MemberSignupInput = {
  qq: string;
  realName: string;
  phone: string;
};

export type MemberSignupReceipt = {
  ok: true;
  /** 服务端生成的公开报名回执编号。 */
  ticket: string;
  /** ISO 时间字符串 */
  submittedAt: string;
  duplicate: boolean;
};

export type MemberSignupFailure = {
  ok: false;
  /** 失败分类，供页面决定提示方式；不要用文案做判断 */
  reason: "offline" | "rate-limited" | "invalid" | "unknown";
  /** 可直接展示给填写者的中文说明 */
  message: string;
};

export type MemberSignupResult = MemberSignupReceipt | MemberSignupFailure;

/**
 * 从表单取出登记数据并规范化。
 *
 * 必填与格式约束由原生约束校验（required / pattern / maxLength）负责，
 * 这里是「用户已经填对」之后的清理：去掉首尾空白、去掉 QQ 与手机号里的
 * 分隔符（138 0000 0000 这类写法很常见），并统一姓名中的空白。
 */
export function normalizeMemberSignup(data: FormData): MemberSignupInput {
  const text = (key: string) => String(data.get(key) ?? "").trim();

  return {
    qq: text("qq").replace(/\D/g, ""),
    realName: text("realName").replace(/\s+/g, ""),
    phone: text("phone").replace(/\D/g, ""),
  };
}

/** 提交登记信息并解析统一 API 信封。 */
export async function submitMemberSignup(input: MemberSignupInput): Promise<MemberSignupResult> {
  try {
    const response = await fetch("/api/v1/join-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, privacyConsent: true }),
    });
    const payload = (await response.json()) as {
      success?: boolean;
      data?: { ticketNo?: string; submittedAt?: string; duplicate?: boolean };
      error?: { message?: string };
    };
    if (!response.ok || !payload.success || !payload.data?.ticketNo) {
      const reason =
        response.status === 429 ? "rate-limited" : response.status === 400 ? "invalid" : "unknown";
      return {
        ok: false,
        reason,
        message:
          payload.error?.message ??
          (reason === "rate-limited" ? "提交过于频繁，请稍后重试。" : "提交失败，请稍后重试。"),
      };
    }
    return {
      ok: true,
      ticket: payload.data.ticketNo,
      submittedAt: payload.data.submittedAt ?? new Date().toISOString(),
      duplicate: payload.data.duplicate === true,
    };
  } catch {
    return { ok: false, reason: "offline", message: "网络异常，没能提交报名，请稍后重试。" };
  }
}
