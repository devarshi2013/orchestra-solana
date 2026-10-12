import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/env";
import { strategiesConfigured, strategiesOff } from "@/server/db";
import { errorResponse } from "@/server/http";

/**
 * Wallet sessions: after the wallet signs the sign-in message, the server sets
 * an HttpOnly cookie holding `{ wallet, exp }` signed with SESSION_SECRET.
 */

const COOKIE = "tt_session";
const MAX_AGE_SECS = 30 * 24 * 3600;

const sign = (payload: string) =>
  createHmac("sha256", serverEnv.SESSION_SECRET!).update(payload).digest("base64url");

/** The Set-Cookie header value that signs `wallet` in for 30 days. */
export function sessionCookie(wallet: string): string {
  const payload = Buffer.from(
    JSON.stringify({ wallet, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECS }),
  ).toString("base64url");
  return cookie(`${payload}.${sign(payload)}`, MAX_AGE_SECS);
}

/** The Set-Cookie header value that signs out. */
export const clearedCookie = () => cookie("", 0);

const cookie = (value: string, maxAge: number) =>
  [
    `${COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
  ].join("; ");

/** The signed-in wallet, or null (no cookie, bad signature, expired, or strategies off). */
export function sessionWallet(request: Request): string | null {
  if (!strategiesConfigured()) return null;
  const raw = request.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  const [payload, signature] = raw?.split(".") ?? [];
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { wallet, exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      wallet?: unknown;
      exp?: unknown;
    };
    return typeof wallet === "string" && typeof exp === "number" && exp * 1000 > Date.now()
      ? wallet
      : null;
  } catch {
    return null;
  }
}

/** The signed-in wallet, or the Response to send instead (503 when strategies are off, else 401). */
export function requireWallet(request: Request): string | Response {
  if (!strategiesConfigured()) return strategiesOff();
  return sessionWallet(request) ?? errorResponse(401, "Sign in with your wallet first");
}
