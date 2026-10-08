// Vercel build: apply database migrations when a database is configured, then
// build. Without DATABASE_URL the app still builds and deploys; features that
// need the database answer with an error naming the missing variable until it's
// added (Vercel → Settings → Environment Variables) and the project redeployed.
import { spawnSync } from "node:child_process";

// Values pasted into the dashboard from a .env file often keep their quotes.
const unquote = (value) => {
  const trimmed = (value ?? "").trim();
  const quoted = /^(["'])([\s\S]*)\1$/.exec(trimmed);
  return quoted ? quoted[2].trim() : trimmed;
};
const databaseUrl = unquote(process.env.DATABASE_URL);
const env = { ...process.env, ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}) };

const exec = (command, args) =>
  spawnSync(command, args, { stdio: "inherit", shell: false, env }).status ?? 1;

if (databaseUrl) {
  console.log("▶ Applying database migrations (prisma migrate deploy)");
  if (exec("pnpm", ["exec", "prisma", "migrate", "deploy"]) !== 0) {
    // Don't block the deploy: the site goes live and /api/health reports the database state.
    console.warn(
      "\n⚠ Database migrations FAILED (see the error above). Deploying anyway.\n" +
        "⚠ Check DATABASE_URL in Vercel → Settings → Environment Variables: a postgres:// URL,\n" +
        "⚠ no quotes, pooled connection string with sslmode=require. Then redeploy.\n" +
        "⚠ /api/health shows whether the database is reachable and has its tables.\n",
    );
  }
} else {
  console.warn(
    "\n⚠ DATABASE_URL is not set: skipping database migrations.\n" +
      "⚠ Sign-in, drafts, investments, history and the assistant need a Postgres database.\n" +
      "⚠ Add DATABASE_URL in Vercel → Settings → Environment Variables (Production and Preview), then redeploy.\n",
  );
}

process.exit(exec("pnpm", ["exec", "next", "build"]));
