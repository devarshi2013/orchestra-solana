import "server-only";

import { z } from "zod";

import { sessionWallet } from "@/server/auth/session";
import { errorResponse, validationErrorResponse } from "@/server/http";

import { InvestError } from "./service";

/** The signed-in wallet, or a 401. */
export async function requireWallet(): Promise<string> {
  const wallet = await sessionWallet();
  if (!wallet) throw new InvestError(401, "Sign in with your wallet first");
  return wallet;
}

/** Runs a route body, mapping our errors to the API error envelope. */
export async function handle(body: () => Promise<Response>): Promise<Response> {
  try {
    return await body();
  } catch (error) {
    if (error instanceof InvestError) return errorResponse(error.status, error.message);
    if (error instanceof z.ZodError) return validationErrorResponse(error);
    console.error("[invest] unhandled", error);
    return errorResponse(500, "Something went wrong");
  }
}

export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new InvestError(400, "Body must be JSON");
  }
  return schema.parse(json);
}

/** Runs and legs as the browser sees them (the unsigned order stays server-side). */
export function publicRun<T extends { legs: { orderTransaction: string | null }[] }>(run: T) {
  return { ...run, legs: run.legs.map(({ orderTransaction: _omit, ...leg }) => leg) };
}
