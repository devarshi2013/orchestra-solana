import { connection } from "next/server";

import type { StocksResponse } from "@/lib/stocks/api";
import { jsonOr502 } from "@/server/http";
import { stockUniverse } from "@/server/stocks/universe";

/** GET → every listed company (Jupiter's verified stock tokens, grouped), most liquid first. */
export async function GET() {
  await connection();
  return jsonOr502(
    "[stocks] list failed",
    async () => {
      const { stocks, asOf } = await stockUniverse();
      return { stocks, asOf } satisfies StocksResponse;
    },
    "public, s-maxage=30",
  );
}
