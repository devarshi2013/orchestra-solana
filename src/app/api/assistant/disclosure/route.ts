import { connection } from "next/server";
import { ASSISTANT_DISCLOSURE_VERSION } from "@/lib/assistant/disclosure";
import { acceptDisclosure, hasAcceptedDisclosure } from "@/server/assistant/disclosure";
import { handle, requireWallet } from "@/server/invest/route";

/** GET → whether this wallet accepted the current risk disclosure. */
export async function GET() {
  // Per-request data: never prerendered at build time.
  await connection();
  return handle(async () => {
    const owner = await requireWallet();
    return Response.json({
      accepted: await hasAcceptedDisclosure(owner),
      version: ASSISTANT_DISCLOSURE_VERSION,
    });
  });
}

/** POST → records the wallet's acceptance of the current disclosure. */
export async function POST() {
  return handle(async () => {
    await acceptDisclosure(await requireWallet());
    return Response.json({ accepted: true, version: ASSISTANT_DISCLOSURE_VERSION });
  });
}
