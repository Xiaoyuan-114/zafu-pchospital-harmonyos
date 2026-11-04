import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

interface Order { id: string; deviceModel: string; status: string }
interface ServicePageState {
  authenticated: boolean;
  home: string;
  devices: { model: string; orderId: string }[];
  loadDevices(): Promise<void>;
  refreshDevices(): void;
  authChanged(): void;
}

function servicePage(listMine: () => Promise<Order[]>): ServicePageState {
  const source = readFileSync("../app/entry/src/main/ets/features/service/ServicePage.ets", "utf8");
  const methods = source.slice(0, source.indexOf("  @Builder"))
    .replace(/import[\s\S]*?from\s+['"][^'"]+['"];\s*/g, "")
    .replace(/@Watch\('[^']+'\)\s*/g, "")
    .replace(/@(Component|State|Prop)\s*/g, "")
    .replace("export struct ServicePage", "class ServicePage");
  const js = ts.transpileModule(`${methods}\n}\nnew ServicePage();`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return runInNewContext(js, {
    NavPathStack: class {}, HOME_STAFF: "STAFF", RepairOrderService: { listMine },
    ApiRequestError: class extends Error {}, isSessionExpiredCode: () => false,
    isNetworkErrorCode: () => false,
  }) as ServicePageState;
}

test("报修提交时设备列表正在读取：旧请求结束后重新读取并显示新设备", async () => {
  let resolveOld!: (value: Order[]) => void;
  const old = new Promise<Order[]>((resolve) => { resolveOld = resolve; });
  let calls = 0;
  const page = servicePage(async () => ++calls === 1 ? old : [{ id: "new", deviceModel: "验收设备", status: "SUBMITTED" }]);
  page.authenticated = true;
  page.home = "CUSTOMER";
  const loading = page.loadDevices();
  page.refreshDevices();
  assert.equal(calls, 1);
  resolveOld([]);
  await loading;
  assert.equal(calls, 2);
  assert.equal(page.devices[0]?.orderId, "new");
});

test("退出登录后迟到的设备响应不覆盖已清除的数据", async () => {
  let resolveOld!: (value: Order[]) => void;
  const old = new Promise<Order[]>((resolve) => { resolveOld = resolve; });
  const page = servicePage(() => old);
  page.authenticated = true;
  page.home = "CUSTOMER";
  const loading = page.loadDevices();
  page.authenticated = false;
  page.authChanged();
  resolveOld([{ id: "private", deviceModel: "旧设备", status: "SUBMITTED" }]);
  await loading;
  assert.equal(page.devices.length, 0);
});
