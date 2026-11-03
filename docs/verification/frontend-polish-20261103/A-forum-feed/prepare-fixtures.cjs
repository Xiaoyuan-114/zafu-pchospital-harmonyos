// 仅向独立验收 API 写入可识别的测试帖子；密码由调用时环境提供。
const fs = require('node:fs');
const root = require('node:path').resolve(__dirname, '../../../..');
const base = 'http://127.0.0.1:13080';
async function request(path, options = {}) {
  const response = await fetch(base + path, options);
  const json = await response.json();
  if (!response.ok || !json.success) throw new Error(`${path}: HTTP ${response.status} ${json.error?.code}`);
  return json.data;
}
async function main() {
  const session = await request('/api/v1/auth/native/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Client-Type': 'native' },
    body: JSON.stringify({ qq: '100001', password: process.env.FORUM_FIXTURE_PASSWORD, rememberMe: false }),
  });
  const headers = { 'Content-Type': 'application/json', 'X-Client-Type': 'native', Authorization: `Bearer ${session.token}` };
  async function post(category, title, body, key) {
    return request('/api/v1/forum/posts', { method: 'POST', headers,
      body: JSON.stringify({ category, title, body, createRequestKey: key }) });
  }
  for (let i = 1; i <= 21; i++) {
    await post(['GENERAL', 'EXPERIENCE', 'QUESTION'][i % 3], `【界面验收样本】论坛分页 ${String(i).padStart(2, '0')}`,
      '这是独立课设验收库中用于检查分页与筛选的测试内容。', `ui-20261103-page-${i}`);
  }
  const files = ['docs/verification/issue-85-app/home-customer.jpeg', 'docs/verification/issue-85-app/service-customer.jpeg',
    'docs/verification/issue-85-app/forum-search-empty.jpeg'];
  for (let count = 1; count <= 3; count++) {
    const item = await post(count === 1 ? 'QUESTION' : 'EXPERIENCE', `【界面验收样本】${count} 张图片的排版检查`,
      '这些图片来自项目历史界面截图，用于检查论坛图片布局与列表阅读节奏。', `ui-20261103-images-${count}`);
    const form = new FormData();
    for (let i = 0; i < count; i++) {
      form.append('photos', new Blob([fs.readFileSync(`${root}/${files[i]}`)], { type: 'image/jpeg' }), `fixture-${i}.jpeg`);
      form.append('uploadKeys', `ui-20261103-${count}-${i}`);
    }
    await request(`/api/v1/forum/posts/${item.id}/images`, { method: 'POST',
      headers: { 'X-Client-Type': 'native', Authorization: `Bearer ${session.token}` }, body: form });
  }
  const list = await request('/api/v1/forum/posts?page=1&pageSize=20');
  console.log(JSON.stringify({ preparedPosts: 24, firstPageCount: list.length, imageCases: [1, 2, 3] }));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
