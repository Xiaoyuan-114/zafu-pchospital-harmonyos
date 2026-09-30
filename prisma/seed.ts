import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../src/generated/prisma/client";
import { assertExperimentDatabase } from "../tools/db-target.mjs";

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
async function main(): Promise<void> {
  const prisma = new PrismaClient({ adapter });
  const now = new Date();
  try {
    await prisma.role.upsert({
      where: { code: "MEMBER" },
      update: { name: "成员" },
      create: {
        id: "00000000-0000-4000-8000-000000000001",
        code: "MEMBER",
        name: "成员",
        createdAt: now,
      },
    });
    const categories = [
      ["10000000-0000-4000-8000-000000000001", "COOLING_CLEANING", "散热 / 清灰"],
      ["10000000-0000-4000-8000-000000000002", "HARDWARE", "硬件故障"],
      ["10000000-0000-4000-8000-000000000003", "SYSTEM", "系统问题"],
      ["10000000-0000-4000-8000-000000000004", "SOFTWARE", "软件问题"],
      ["10000000-0000-4000-8000-000000000005", "DRIVER", "驱动问题"],
      ["10000000-0000-4000-8000-000000000006", "NETWORK", "网络问题"],
      ["10000000-0000-4000-8000-000000000007", "STORAGE", "磁盘 / 存储"],
      ["10000000-0000-4000-8000-000000000008", "PERIPHERAL", "外设问题"],
      ["10000000-0000-4000-8000-000000000009", "OTHER", "其他"],
      ["10000000-0000-4000-8000-000000000010", "OTHER_FAULT", "其他故障"],
    ] as const;
    for (const [index, [id, code, name]] of categories.entries()) {
      await prisma.repairCategory.upsert({
        where: { code },
        update: { name, sortOrder: index + 1 },
        create: { id, code, name, sortOrder: index + 1, createdAt: now },
      });
    }
    await prisma.role.upsert({
      where: { code: "ADMIN" },
      update: { name: "管理员" },
      create: {
        id: "00000000-0000-4000-8000-000000000002",
        code: "ADMIN",
        name: "管理员",
        createdAt: now,
      },
    });

    // M3 技能标签初始 Seed（任务书 §5.4）。
    // 与分类不同：这里**只补不存在的 code**，绝不覆盖管理员后续修改的名称、
    // 描述、排序或启用状态，因此 update 分支必须为空对象。
    const skills = [
      ["20000000-0000-4000-8000-000000000001", "WINDOWS", "Windows"],
      ["20000000-0000-4000-8000-000000000002", "HARDWARE", "硬件维修"],
      ["20000000-0000-4000-8000-000000000003", "NETWORK", "网络排障"],
      ["20000000-0000-4000-8000-000000000004", "LINUX", "Linux"],
      ["20000000-0000-4000-8000-000000000005", "LAPTOP_DISASSEMBLY", "笔记本拆装"],
      ["20000000-0000-4000-8000-000000000006", "SYSTEM_INSTALLATION", "系统安装"],
      ["20000000-0000-4000-8000-000000000007", "DRIVER", "驱动处理"],
      ["20000000-0000-4000-8000-000000000008", "STORAGE", "存储与数据迁移"],
    ] as const;
    for (const [index, [id, code, name]] of skills.entries()) {
      await prisma.skill.upsert({
        where: { code },
        update: {},
        create: { id, code, name, sortOrder: (index + 1) * 10, isActive: true, createdAt: now },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
