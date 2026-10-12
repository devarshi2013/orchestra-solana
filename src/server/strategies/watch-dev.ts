/**
 * `pnpm strategies:watch`: in development, runs the strategy watcher every 30 s
 * against the local dev server (production uses Vercel Cron, vercel.json).
 * Reads CRON_SECRET from the environment or .env.local; WATCH_URL overrides the target.
 */
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

if (!process.env.CRON_SECRET && existsSync(".env.local")) loadEnvFile(".env.local");
const secret = process.env.CRON_SECRET?.trim().replace(/^(["'])(.*)\1$/, "$2");
if (!secret) throw new Error("CRON_SECRET is not set");
const target = process.env.WATCH_URL ?? "http://localhost:3000/api/strategies/run";

async function tick() {
  try {
    const response = await fetch(target, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    });
    console.log(new Date().toISOString(), response.status, await response.text());
  } catch (error) {
    console.error(new Date().toISOString(), "watcher call failed", error);
  }
}

await tick();
setInterval(tick, 30_000);
