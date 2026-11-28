/**
 * Issue #102 演示数据：给某个客户账号补两台设备与四条权益，供模拟器演示用。
 *
 * 为什么不做进 `prisma db seed`：
 * seed 只建角色/分类/技能字典，**不建账号**（见 backend/docs/local-development.md）。
 * 设备必须挂在真实账号上，所以这里按 `--account` 现查账号，绝不硬编码用户 UUID，
 * 也不创建任何账号。
 *
 * 权益的登记人必须是**工作人员**（`--staff`，默认 100002）：整个权限设计的地基是
 * 「保修只能由工作人员登记，客户自证不算」。如果这里图省事写成客户自己的 id，
 * 演示数据就会当场显示「由客户本人登记」——一旦界面加上登记人，数据自己打自己。
 *
 * 用法（只操作课设库，`assertExperimentDatabase` 会先拦一道）：
 *   corepack pnpm devices:demo -- --account 100001
 *   corepack pnpm devices:demo -- --account 100001 --staff 100002
 *
 * 幂等：设备与权益都用固定 UUID upsert，可重复执行；权益的起止日期按当天重算，
 * 保证「有效 / 已过期 / 已作废」三种状态在演示当天一定各有一条。
 * （「未生效」不做样本：它是将来才开始的权益，演示数据里凭空造一条只会让
 *   三张卡的排序截图对不上，该状态由 `devices.test.ts` 覆盖。）
 */
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../src/generated/prisma/client";
import { assertExperimentDatabase } from "./db-target.mjs";

// 与 `db:seed`、`accounts:prepare` 一致：先读本机 `.env`，否则 `DATABASE_URL` 为空，
// 闸门会以「不是实验库」为由直接拒绝执行。
if (existsSync(".env")) loadEnvFile(".env");

// 与 `db:seed` 同一档：只允许课设开发库或课设测试库。
assertExperimentDatabase("seed");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("缺少环境变量：DATABASE_URL");

const url = new URL(databaseUrl);
const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: url.port ? Number(url.port) : 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, ""),
  allowPublicKeyRetrieval: ["127.0.0.1", "localhost", "[::1]", "::1"].includes(url.hostname),
  cachingRsaPublicKey: process.env.DATABASE_RSA_PUBLIC_KEY_PATH,
  timezone: "Z",
  charset: "utf8mb4",
});

/** 固定 UUID：前缀 1020 便于一眼认出是 Issue #102 的演示数据。 */
const DEVICE_LAPTOP = "10200000-0000-4000-8000-000000000001";
const DEVICE_DESKTOP = "10200000-0000-4000-8000-000000000002";
const BENEFIT_WARRANTY = "10200000-0000-4000-8000-000000000101";
const BENEFIT_SERVICE = "10200000-0000-4000-8000-000000000102";
const BENEFIT_EXPIRED = "10200000-0000-4000-8000-000000000103";

function parseAccount(argv: string[]): string {
  const index = argv.indexOf("--account");
  const value = index >= 0 ? argv[index + 1] : undefined;
  if (!value || value.startsWith("--")) {
    throw new Error("缺少 --account，例如：corepack pnpm devices:demo -- --account 100001");
  }
  return value.trim();
}

/** 权益登记人：默认课设的工作人员账号，可用 `--staff` 覆盖。 */
function parseStaffAccount(argv: string[]): string {
  const index = argv.indexOf("--staff");
  const value = index >= 0 ? argv[index + 1] : undefined;
  if (value && !value.startsWith("--")) return value.trim();
  return "100002";
}

function startOfUtcDay(base: Date): Date {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
}

function shiftDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 86_400_000);
}

async function main(): Promise<void> {
  const account = parseAccount(process.argv.slice(2));
  const prisma = new PrismaClient({ adapter });
  const now = new Date();
  const today = startOfUtcDay(now);
  try {
    const identity = await prisma.userIdentity.findFirst({
      where: { identifierNormalized: account, deletedAt: null },
      select: { userId: true, type: true },
    });
    if (!identity) {
      throw new Error(
        `找不到账号 ${account}。先执行 corepack pnpm accounts:prepare 准备课设测试账号，再跑本工具。`,
      );
    }
    const userId = identity.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, status: true, deletedAt: true },
    });
    if (!user || user.deletedAt !== null) throw new Error(`账号 ${account} 已删除，无法挂演示数据`);

    // 权益的登记人必须是工作人员，不能借用客户自己的 id（见文件头注释）。
    const staffAccount = parseStaffAccount(process.argv.slice(2));
    const staffIdentity = await prisma.userIdentity.findFirst({
      where: { identifierNormalized: staffAccount, deletedAt: null },
      select: { userId: true },
    });
    if (!staffIdentity) {
      throw new Error(
        `找不到工作人员账号 ${staffAccount}（权益登记人）。先执行 corepack pnpm accounts:prepare，` +
          "或用 --staff 指定一个工作人员账号。",
      );
    }
    const staffUserId = staffIdentity.userId;

    const devices = [
      {
        id: DEVICE_LAPTOP,
        label: "我的办公本",
        brand: "ThinkPad",
        model: "X1 Carbon Gen 11",
        serialNumber: "PF3K2Q9A",
        purchaseOn: shiftDays(today, -400),
      },
      {
        id: DEVICE_DESKTOP,
        label: "宿舍台式机",
        brand: "自组机",
        model: "R5 5600 / RTX 3060",
        serialNumber: null as string | null,
        purchaseOn: shiftDays(today, -700),
      },
    ];

    for (const device of devices) {
      const { id, ...data } = device;
      await prisma.customerDevice.upsert({
        where: { id },
        update: { ...data, ownerUserId: userId, status: "ACTIVE", deletedAt: null, updatedAt: now },
        create: {
          id,
          ...data,
          ownerUserId: userId,
          source: "SELF",
          status: "ACTIVE",
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    /**
     * 三条权益覆盖三种展示状态，日期按今天推算：
     * - 整机保修：生效中，长期有效（endOn 为空）
     * - 到店清灰：生效中，有截止日与次数
     * - 延保：已到期（endOn 在今天之前）
     * 已作废（VOID）那条放在台式机上，避免一个设备的列表被三种状态挤满。
     */
    const benefits = [
      {
        id: BENEFIT_WARRANTY,
        deviceId: DEVICE_LAPTOP,
        kind: "WARRANTY",
        name: "整机保修（演示数据）",
        provider: "联想（中国）",
        startOn: shiftDays(today, -400),
        endOn: null as Date | null,
        region: "中国大陆",
        totalUses: null as number | null,
        usedUses: 0,
        state: "ACTIVE",
        note: "课设演示样本，非真实保修记录",
      },
      {
        id: BENEFIT_SERVICE,
        deviceId: DEVICE_LAPTOP,
        kind: "SERVICE",
        name: "到店清灰服务（演示数据）",
        provider: "浙农林电脑医院",
        startOn: shiftDays(today, -30),
        endOn: shiftDays(today, 335),
        region: "浙江农林大学",
        totalUses: 4,
        usedUses: 1,
        state: "ACTIVE",
        note: "每学年 4 次，到店登记",
      },
      {
        id: BENEFIT_EXPIRED,
        deviceId: DEVICE_LAPTOP,
        kind: "EXTENDED",
        name: "延保一年（演示数据·已到期）",
        provider: "联想（中国）",
        startOn: shiftDays(today, -800),
        endOn: shiftDays(today, -70),
        region: "中国大陆",
        totalUses: null,
        usedUses: 0,
        state: "ACTIVE",
        note: "用于演示「已过保修期」的显示",
      },
    ];

    for (const benefit of benefits) {
      const { id, ...data } = benefit;
      await prisma.deviceBenefit.upsert({
        where: { id },
        // `update` 也写登记人：否则早先按客户 id 灌进去的旧数据，
        // 重跑脚本只会更新日期，登记人还是错的。
        update: { ...data, state: "ACTIVE", createdByUserId: staffUserId, updatedAt: now },
        create: {
          id,
          ...data,
          state: "ACTIVE",
          createdByUserId: staffUserId,
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    // 已作废样本：人不小心录错后撤销，客户侧应显示「已作废」而不是「已过期」。
    const voidBenefit = "10200000-0000-4000-8000-000000000104";
    await prisma.deviceBenefit.upsert({
      where: { id: voidBenefit },
      update: {
        deviceId: DEVICE_DESKTOP,
        kind: "ACCIDENT",
        name: "意外损坏保障（演示数据·已作废）",
        provider: "浙农林电脑医院",
        startOn: shiftDays(today, -200),
        endOn: shiftDays(today, 165),
        region: "浙江农林大学",
        totalUses: 2,
        usedUses: 0,
        state: "VOID",
        note: "录入错误后作废，演示「已作废」与「已过期」的区别",
        createdByUserId: staffUserId,
        updatedAt: now,
      },
      create: {
        id: voidBenefit,
        deviceId: DEVICE_DESKTOP,
        kind: "ACCIDENT",
        name: "意外损坏保障（演示数据·已作废）",
        provider: "浙农林电脑医院",
        startOn: shiftDays(today, -200),
        endOn: shiftDays(today, 165),
        region: "浙江农林大学",
        totalUses: 2,
        usedUses: 0,
        state: "VOID",
        note: "录入错误后作废，演示「已作废」与「已过期」的区别",
        createdByUserId: staffUserId,
        createdAt: now,
        updatedAt: now,
      },
    });

    const deviceCount = await prisma.customerDevice.count({ where: { ownerUserId: userId, deletedAt: null } });
    const benefitCount = await prisma.deviceBenefit.count({
      where: { deviceId: { in: [DEVICE_LAPTOP, DEVICE_DESKTOP] } },
    });
    process.stdout.write(
      [
        `账号 ${account}（${user.displayName ?? "未命名"}）现有 ${deviceCount} 台在用设备、${benefitCount} 条权益记录。`,
        `权益登记人：工作人员 ${staffAccount}（不是客户本人）。`,
        "演示入口：App → 服务 → 我的设备 → 点任一设备 → 设备与权益。",
        "清理：删除 customer_devices / device_benefits 中 id 以 10200000 开头的行。",
        "",
      ].join("\n"),
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main();
