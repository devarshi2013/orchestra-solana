import { connection } from "next/server";
import { listConversations } from "@/server/assistant/conversations";
import { handle, requireWallet } from "@/server/invest/route";

/** GET → the signed-in wallet's assistant chats, newest first. */
export async function GET() {
  // Per-request data: never prerendered at build time.
  await connection();
  return handle(async () => Response.json(await listConversations(await requireWallet())));
}
