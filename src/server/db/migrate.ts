/**
 * `pnpm db:migrate`: creates the strategies tables in DATABASE_URL (the Neon /
 * Vercel Postgres connection string, from the environment or .env.local).
 * Idempotent; the app also runs it once per process.
 */
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import postgres from "postgres";

import { driverUrl, migrationSql, SCHEMA } from "./schema.ts";

if (!process.env.DATABASE_URL && existsSync(".env.local")) loadEnvFile(".env.local");
const databaseUrl = process.env.DATABASE_URL?.trim().replace(/^(["'])(.*)\1$/, "$2");
if (!databaseUrl) throw new Error("DATABASE_URL is not set");

// prepare: false — Neon's pooler (PgBouncer, transaction mode) can't hold prepared statements.
const sql = postgres(driverUrl(databaseUrl), {
  max: 1,
  ssl: "require",
  prepare: false,
  onnotice: () => {},
});
try {
  await sql.unsafe(migrationSql);
  console.log(`Migrated schema "${SCHEMA}".`);
} finally {
  await sql.end();
}
