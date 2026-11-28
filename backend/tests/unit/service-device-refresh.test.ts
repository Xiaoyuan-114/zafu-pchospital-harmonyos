import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

/**
 * 首页设备卡的取数与刷新竞态（Issue #102 后设备改为独立绑定数据）。
 *
 * 这里用源码切片跑真实的 `loadDevices / refreshDevices / authChanged`，
 * 只把网络层（`DeviceService`）换成假实现 —— 要守的是「请求进行中再次刷新
 * 不能丢事件、退出登录后迟到响应不能回填」这两条时序规则，
 * 与数据来自哪张表无关，所以换成 `DeviceService.listMine` 后断言照旧成立。
 */
interface Device { id: string; label: string; brand: string; model: string; status: string }
interface ServicePageState {
  authenticated: boolean;
  home: string;
  devices: Device[];
  loadDevices(): Promise<void>;
  refreshDevices(): void;
  authChanged(): void;
}

function servicePage(listMine: () => Promise<Device[]>): ServicePageState {
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
    NavPathStack: class {}, HOME_STAFF: "STAFF", DeviceService: { listMine },
    ApiRequestError: class extends Error {}, isSessionExpiredCode: () => false,
    isNetworkErrorCode: () => false,
  }) as ServicePageState;
}

test("绑定设备时设备列表正在读取：旧请求结束后重新读取并显示新设备", async () => {
  let resolveOld!: (value: Device[]) => void;
  const old = new Promise<Device[]>((resolve) => { resolveOld = resolve; });
  let calls = 0;
  const page = servicePage(async () => ++calls === 1 ? old : [{
    id: "new", label: "验收设备", brand: "联想", model: "T14", status: "ACTIVE",
  }]);
  page.authenticated = true;
  page.home = "CUSTOMER";
  const loading = page.loadDevices();
  page.refreshDevices();
  assert.equal(calls, 1);
  resolveOld([]);
  await loading;
  assert.equal(calls, 2);
  assert.equal(page.devices[0]?.id, "new");
  assert.equal(page.devices[0]?.label, "验收设备");
});

test("退出登录后迟到的设备响应不覆盖已清除的数据", async () => {
  let resolveOld!: (value: Device[]) => void;
  const old = new Promise<Device[]>((resolve) => { resolveOld = resolve; });
  const page = servicePage(() => old);
  page.authenticated = true;
  page.home = "CUSTOMER";
  const loading = page.loadDevices();
  page.authenticated = false;
  page.authChanged();
  resolveOld([{ id: "private", label: "旧设备", brand: "联想", model: "T14", status: "ACTIVE" }]);
  await loading;
  assert.equal(page.devices.length, 0);
});
