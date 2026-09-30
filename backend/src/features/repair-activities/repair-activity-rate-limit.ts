/** Public repair-activity limiter key constructors. Keep IP and phone scopes distinct. */
export function repairActivityIpRateLimitKey(ip: string): string {
  return `activity-signup:${ip}`;
}

export function repairActivityPhoneRateLimitKey(phone: string): string {
  return `activity-signup-phone:${phone}`;
}
