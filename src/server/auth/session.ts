import "server-only";

import { createHmac, createPublicKey, randomBytes, timingSafeEqual, verify } from "node:crypto";

import { PublicKey } from "@solana/web3.js";
import { cookies } from "next/headers";

import { serverEnv } from "@/env/server";
import { buildSignInMessage } from "@/lib/auth/siws";

/**
 * Wallet sessions via Sign-In With Solana. Both the pending challenge and the
 * session live in HMAC-signed, httpOnly cookies, so there is no session table.
 */

export const SESSION_COOKIE = "orchestra_session";
export const CHALLENGE_COOKIE = "orchestra_siws";
const SESSION_TTL_S = 7 * 24 * 60 * 60;
const CHALLENGE_TTL_S = 10 * 60;
/** Development only: lets sign-in work before SESSION_SECRET is configured. */
const DEV_SECRET = "orchestra-development-session-secret-not-for-production";

function secret(): string {
  if (serverEnv.SESSION_SECRET) return serverEnv.SESSION_SECRET;
  if (serverEnv.NODE_ENV === "production") throw new Error("SESSION_SECRET is not set");
  return DEV_SECRET;
}

const b64url = (data: Buffer | string) => Buffer.from(data).toString("base64url");

/** `payload.signature`, both base64url; the signature is HMAC-SHA256 over the payload. */
export function signToken(payload: object, key = secret()): string {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${b64url(createHmac("sha256", key).update(body).digest())}`;
}

/** The payload if the token is authentic and unexpired (`exp`, Unix seconds), else null. */
export function readToken<T extends { exp: number }>(
  token: string | undefined,
  now = Date.now(),
  key = secret(),
): T | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", key).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as T;
    return payload.exp * 1000 > now ? payload : null;
  } catch {
    return null;
  }
}

/** DER prefix that turns a raw 32-byte ed25519 key into SPKI. */
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/** Whether `signature` (64 bytes) is `address`'s ed25519 signature of `message`. */
export function verifyWalletSignature(
  address: string,
  message: string | Uint8Array,
  signature: Uint8Array,
): boolean {
  try {
    const key = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, new PublicKey(address).toBuffer()]),
      format: "der",
      type: "spki",
    });
    return verify(null, Buffer.from(message), key, signature);
  } catch {
    return false;
  }
}

type Challenge = { address: string; message: string; exp: number };
type Session = { sub: string; exp: number };

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: serverEnv.NODE_ENV === "production",
  path: "/",
  maxAge,
});

/** Issues a sign-in message for `address` and remembers it for verification. */
export async function issueChallenge(address: string, domain: string): Promise<string> {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_S * 1000);
  const message = buildSignInMessage({
    domain,
    address,
    nonce: randomBytes(12).toString("hex"),
    issuedAt,
    expiresAt,
  });
  (await cookies()).set(
    CHALLENGE_COOKIE,
    signToken({
      address,
      message,
      exp: Math.floor(expiresAt.getTime() / 1000),
    } satisfies Challenge),
    cookieOptions(CHALLENGE_TTL_S),
  );
  return message;
}

/** Checks the signed challenge and starts a session. Returns the wallet, or null. */
export async function completeSignIn(
  address: string,
  signature: Uint8Array,
): Promise<string | null> {
  const jar = await cookies();
  const challenge = readToken<Challenge>(jar.get(CHALLENGE_COOKIE)?.value);
  jar.delete(CHALLENGE_COOKIE);
  if (!challenge || challenge.address !== address) return null;
  if (!verifyWalletSignature(address, challenge.message, signature)) return null;
  jar.set(
    SESSION_COOKIE,
    signToken({
      sub: address,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S,
    } satisfies Session),
    cookieOptions(SESSION_TTL_S),
  );
  return address;
}

/** The signed-in wallet, or null. */
export async function sessionWallet(): Promise<string | null> {
  return readToken<Session>((await cookies()).get(SESSION_COOKIE)?.value)?.sub ?? null;
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
