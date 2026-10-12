import { clearedCookie } from "@/server/auth/session";

/** POST → signs out (clears the session cookie). */
export function POST() {
  return Response.json({ ok: true }, { headers: { "set-cookie": clearedCookie() } });
}
