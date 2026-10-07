import { listConversations } from "@/server/assistant/conversations";
import { handle, requireWallet } from "@/server/invest/route";

/** GET → the signed-in wallet's assistant chats, newest first. */
export async function GET() {
  return handle(async () => Response.json(await listConversations(await requireWallet())));
}
