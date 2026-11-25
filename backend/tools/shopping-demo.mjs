import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const base = process.env.SHOPPING_DEMO_API || "http://127.0.0.1:13080";
const url = new URL(base);
if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname)) throw new Error("演示脚本只允许连接本机后端");
const qq = process.env.SHOPPING_DEMO_QQ || "100002";
const password = process.env.SHOPPING_DEMO_PASSWORD || "staff123";
async function request(path, options = {}) {
  const res = await fetch(base + path, options);
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(`${path}: ${data.error?.message || res.status}`);
  return data.data;
}
const native = { "X-Client-Type": "native" };
const session = await request("/api/v1/auth/native/login", {
  method: "POST", headers: { ...native, "Content-Type": "application/json" },
  body: JSON.stringify({ qq, password }),
});
const headers = { ...native, Authorization: `Bearer ${session.token}` };
for (const [category, name, image, price, stock] of [
  ["COMPUTER", "【课设样本】二手笔记本", "computer", 89900, 1],
  ["COMPONENT", "【课设样本】内存条", "component", 7900, 1],
  ["PERIPHERAL", "【课设样本】无线鼠标", "peripheral", 3900, 1],
  ["CONSUMABLE", "【课设样本】导热硅脂", "consumable", 2500, 8],
]) {
  const list = await request(`/api/v1/shopping/products?q=${encodeURIComponent(name)}&page=1&pageSize=20`, { headers });
  let product = list.find((item) => item.title === name && item.category === category && item.actions.canUploadImages);
  if (!product) product = await request("/api/v1/shopping/products", {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ title: name, description: "课设本地演示商品", priceCents: price, category, condition: "演示样本", stock, pickupNote: "校园当面取货" }),
  });
  if (product.coverUrl) { console.log(`已存在：${name}`); continue; }
  const file = fileURLToPath(new URL(`./shopping-demo-images/${image}.png`, import.meta.url));
  const form = new FormData();
  form.append("photos", new Blob([await readFile(file)], { type: "image/png" }), `${image}.png`);
  await request(`/api/v1/shopping/products/${product.id}/images`, { method: "POST", headers, body: form });
  console.log(`已创建：${name}`);
}
