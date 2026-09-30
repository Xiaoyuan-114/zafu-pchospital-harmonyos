import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "@/generated/prisma/client";
import { getServerEnv } from "@/lib/env";

function createClient(): PrismaClient {
  const url = new URL(getServerEnv().DATABASE_URL);
  if (url.protocol !== "mysql:") throw new Error("DATABASE_URL 必须使用 mysql:// 协议");

  const cachingRsaPublicKey = process.env.DATABASE_RSA_PUBLIC_KEY_PATH;
  const isLoopback = ["127.0.0.1", "localhost", "[::1]", "::1"].includes(url.hostname);

  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    connectionLimit: Number(url.searchParams.get("connection_limit") ?? 10),
    // Local MySQL caching_sha2_password works without a server-mounted RSA key.
    // Remote hosts still require a pinned key or their configured TLS transport.
    allowPublicKeyRetrieval: isLoopback,
    cachingRsaPublicKey,
    timezone: "Z",
    charset: "utf8mb4",
  });

  return new PrismaClient({ adapter });
}

const globalForDb = globalThis as typeof globalThis & { __pcHospitalDb?: PrismaClient };
let productionDb: PrismaClient | undefined;

export function getDb(): PrismaClient {
  const client = globalForDb.__pcHospitalDb ?? productionDb ?? createClient();
  if (process.env.NODE_ENV !== "production") globalForDb.__pcHospitalDb = client;
  else productionDb = client;
  return client;
}

export async function disconnectDb(): Promise<void> {
  await (globalForDb.__pcHospitalDb ?? productionDb)?.$disconnect();
  globalForDb.__pcHospitalDb = undefined;
  productionDb = undefined;
}
