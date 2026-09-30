/** 公开/成员端电话脱敏：中间四位 ****（与站内 `maskPhone` 同形）。 */
export function maskActivityPhone(phone: string): string {
  if (phone.length < 7) return "****";
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}
