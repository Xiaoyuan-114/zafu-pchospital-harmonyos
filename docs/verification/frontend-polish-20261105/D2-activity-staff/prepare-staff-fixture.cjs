// Create labelled samples through the isolated course API; credentials come from process environment.
const base = 'http://127.0.0.1:13080';
async function request(path, method = 'GET', body, token) {
  const headers = { 'X-Client-Type': 'native', 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(`${path}: ${response.status} ${result.error?.code}`);
  return result.data;
}
async function login(qq, password) {
  return (await request('/api/v1/auth/native/login', 'POST', { qq, password, rememberMe: false })).token;
}
async function main() {
  const admin = await login('100003', process.env.D2_ADMIN_PASSWORD);
  const customer = await login('100001', process.env.D2_CUSTOMER_PASSWORD);
  const now = Date.now(), hour = 60 * 60 * 1000;
  const event = await request('/api/v1/admin/repair-activities', 'POST', {
    title: '【现场界面验收样本】校园电脑服务', location: '课设验收现场', capacity: 12,
    activityAt: new Date(now + 2 * hour).toISOString(),
    signupOpensAt: new Date(now - 2 * hour).toISOString(),
    signupClosesAt: new Date(now + hour).toISOString(),
  }, admin);
  const detail = await request(`/api/v1/repair-activities/${event.id}`);
  for (const [name, phone, issueType] of [['D2-Alpha', '13000000201', 'OTHER'], ['D2-Beta', '13000000202', 'SOFTWARE_SYSTEM']]) {
    await request(`/api/v1/customer/repair-activities/${event.id}/registrations`, 'POST', {
      name, phone, issueType, deviceModel: '验收设备', consentAccepted: true, consentVersion: detail.consent.version,
    }, customer);
  }
  await request(`/api/v1/admin/repair-activities/${event.id}`, 'POST', { signupClosesAt: new Date(now - hour).toISOString() }, admin);
  console.log(JSON.stringify({ activityId: event.id, registrations: 2, closed: true }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
