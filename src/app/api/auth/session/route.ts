import { connection } from "next/server";
import { sessionWallet, signOut } from "@/server/auth/session";

/** GET → { wallet } of the current session (null when signed out). */
export async function GET() {
  // Per-request data: never prerendered at build time.
  await connection();
  return Response.json({ wallet: await sessionWallet() });
}

/** DELETE → signs out. */
export async function DELETE() {
  await signOut();
  return Response.json({ wallet: null });
}
