import "server-only";

import { z } from "zod";

import { mintInformationSchema } from "@/lib/jupiter/schemas";
import { toTokenInfo, type TokenInfo } from "@/lib/tokens";

import { jupiterFetch } from "./client";

/** GET /tokens/v2/search — symbol, name or mint (comma-separated mints for batch lookup). */
export async function searchTokens(query: string, signal?: AbortSignal): Promise<TokenInfo[]> {
  const response = await jupiterFetch("tokens/v2/search", { query: { query }, signal });
  const mints = z.array(mintInformationSchema).parse(await response.json());
  return mints.map(toTokenInfo);
}
