import { connection } from "next/server";

import { jsonOr502 } from "@/server/http";
import { getBlockHeight } from "@/server/solana/rpc";

/**
 * GET → { blockHeight }: Solana's confirmed block height, read with the
 * server's RPC. A trade asks for it after the wallet signs, to tell whether
 * the quote expired while the prompt was open. Browsers can't ask a public
 * RPC themselves: api.mainnet-beta.solana.com answers them 403.
 */
export async function GET() {
  await connection();
  return jsonOr502("[solana] block height failed", async () => ({
    blockHeight: await getBlockHeight(),
  }));
}
