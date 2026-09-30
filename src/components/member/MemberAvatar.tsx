import { cn } from "@/lib/utils";

import { memberCopy } from "@/config/member";

/**
 * MemberAvatar —— 成员头像
 *
 * M3 尚未接入头像上传（`avatarUrl` 由管理员维护，可能为空）。
 * 这里**不生成随机图形、也不请求外链占位图**：
 * - 有 `avatarUrl` 时用原生 `<img>` 渲染；
 * - 否则用展示名首字作为占位，纯 CSS 绘制，不依赖网络。
 *
 * 头像对 AT 无信息量（展示名紧随其后），因此 `alt=""` 并以 `aria-hidden` 隐藏，
 * 避免屏幕阅读器把昵称读两遍。
 */

export type MemberAvatarProps = {
  displayName: string;
  avatarUrl?: string | null;
  /** 尺寸：`md`（默认，工作台/他人主页）/ `lg`（个人资料页） */
  size?: "md" | "lg";
  className?: string;
};

/** 取展示名的首个「字」：优先取首个字母/汉字，跳过空白与标点。 */
function initialOf(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) return memberCopy.common.fallbackName.slice(0, 1);
  const first = Array.from(trimmed)[0] ?? "";
  return first || memberCopy.common.fallbackName.slice(0, 1);
}

export function MemberAvatar({ displayName, avatarUrl, size = "md", className }: MemberAvatarProps) {
  const classes = cn("member-avatar", size === "lg" && "member-avatar--lg", className);

  if (avatarUrl) {
    // 头像来自管理员配置的地址，可能是任意外部域名。
    // 用原生 img + referrerPolicy 而不是 next/image，避免为 M3 新增远程域名白名单。
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className={classes} src={avatarUrl} alt="" aria-hidden="true" referrerPolicy="no-referrer" />
    );
  }

  return (
    <span className={classes} aria-hidden="true">
      {initialOf(displayName)}
    </span>
  );
}
