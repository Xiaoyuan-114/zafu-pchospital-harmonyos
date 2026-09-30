import { redirect } from "next/navigation";

/** 旧邀请码注册页：替换到同壳 `/login?mode=register`，不再单独营销布局。 */
export default function MemberRegistrationPage() {
  redirect("/login?mode=register");
}
