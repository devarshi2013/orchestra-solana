import { walletFunds } from "@/server/assistant/quote";
import { handle, requireWallet } from "@/server/invest/route";

/** GET → the signed-in wallet's USDC and SOL, for the plan's pre-flight checks. */
export async function GET() {
  return handle(async () => Response.json(await walletFunds(await requireWallet())));
}
