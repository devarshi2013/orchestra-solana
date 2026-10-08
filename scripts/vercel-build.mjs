// Vercel build: apply database migrations when a database is configured, then
// build. Without DATABASE_URL the app still builds and deploys; features that
// need the database answer with an error naming the missing variable until it's
// added (Vercel → Settings → Environment Variables) and the project redeployed.
import { spawnSync } from "node:child_process";

const run = (command, args) => {
  const { status } = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (status !== 0) process.exit(status ?? 1);
};

if (process.env.DATABASE_URL?.trim()) {
  console.log("▶ Applying database migrations (prisma migrate deploy)");
  run("pnpm", ["exec", "prisma", "migrate", "deploy"]);
} else {
  console.warn(
    "\n⚠ DATABASE_URL is not set: skipping database migrations.\n" +
      "⚠ Sign-in, drafts, investments, history and the assistant need a Postgres database.\n" +
      "⚠ Add DATABASE_URL in Vercel → Settings → Environment Variables (Production and Preview), then redeploy.\n",
  );
}

run("pnpm", ["exec", "next", "build"]);
