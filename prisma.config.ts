import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { defineConfig } from "prisma/config";
import { assertExperimentDatabase } from "./tools/db-target.mjs";

if (existsSync(".env")) loadEnvFile(".env");

if (process.env.DATABASE_URL) assertExperimentDatabase("migrate");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Generation and static builds do not open a connection. Runtime access validates the real value.
    url: process.env.DATABASE_URL ?? "mysql://build-only:build-only@127.0.0.1:3306/build_only",
    // Shadow database is only used by `prisma migrate dev` / `migrate diff` to detect drift.
    // Never points at a real environment; falls back to a throwaway local name.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
