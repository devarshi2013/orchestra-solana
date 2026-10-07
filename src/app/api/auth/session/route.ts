import { sessionWallet, signOut } from "@/server/auth/session";

/** GET → { wallet } of the current session (null when signed out). */
export async function GET() {
  return Response.json({ wallet: await sessionWallet() });
}

/** DELETE → signs out. */
export async function DELETE() {
  await signOut();
  return Response.json({ wallet: null });
}
