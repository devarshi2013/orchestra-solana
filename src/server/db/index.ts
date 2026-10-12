import "server-only";

import postgres from "postgres";

import { serverEnv } from "@/env";
import { errorResponse } from "@/server/http";

import { driverUrl, migrationSql } from "./schema";

export { T } from "./schema";

/** Strategies need the database and a session secret; without both they're off. */
export const strategiesConfigured = () =>
  Boolean(serverEnv.DATABASE_URL && serverEnv.SESSION_SECRET);

/** The 503 every strategies route answers when they're off. */
export const strategiesOff = () =>
  errorResponse(503, "Strategies are off (needs DATABASE_URL and SESSION_SECRET)");

let client: { sql: postgres.Sql; ready: Promise<void> } | null = null;

/** The database client, with the schema migrated once per process (the first query waits for it). */
export async function db(): Promise<postgres.Sql> {
  if (!client) {
    const sql = postgres(driverUrl(serverEnv.DATABASE_URL!), {
      max: 5,
      ssl: "require",
      // Poolers in transaction mode (Neon's PgBouncer) can't hold prepared statements.
      prepare: false,
      onnotice: () => {},
      types: { numeric: { to: 1700, from: [1700], serialize: String, parse: Number } },
    });
    const ready = sql
      .unsafe(migrationSql)
      .then(() => undefined)
      .catch((error: unknown) => {
        client = null;
        throw error;
      });
    client = { sql, ready };
  }
  await client.ready;
  return client.sql;
}
