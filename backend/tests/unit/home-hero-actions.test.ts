import assert from "node:assert/strict";
import test from "node:test";

import { heroActions, homeActivityPreview } from "../../src/config/home";

test("Hero 主 CTA 为报名活动 → /repair-activities", () => {
  assert.equal(heroActions.repair.label, "报名活动");
  assert.equal(heroActions.repair.href, "/repair-activities");
});

test("Hero 次要为维修说明 → /#process（非死链、非 handbook）", () => {
  assert.equal(heroActions.docs.label, "维修说明");
  assert.equal(heroActions.docs.href, "/#process");
  assert.ok(heroActions.docs.href.length > 0);
  assert.equal(heroActions.docs.href.includes("handbook"), false);
});

test("首页近场活动文案含查看全部入口", () => {
  assert.equal(homeActivityPreview.viewAllHref, "/repair-activities");
  assert.ok(homeActivityPreview.viewAll.length > 0);
});
