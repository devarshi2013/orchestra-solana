import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, { JUPITER_API_KEY: "jup_test_key" });
});

const state = vi.hoisted(() => ({
  result: "subscribed" as "subscribed" | "already" | "throw",
  emails: [] as string[],
}));

vi.mock("@/server/subscribe", () => ({
  addSubscriber: async (_resend: unknown, _segment: string, email: string) => {
    state.emails.push(email);
    if (state.result === "throw") throw new Error("invalid_api_key: API key is invalid");
    return state.result;
  },
}));

const post = (body: unknown, ip = "1.2.3.4") =>
  new NextRequest("http://localhost/api/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });

async function load(configured = true) {
  vi.resetModules();
  process.env.RESEND_API_KEY = configured ? "re_test_key" : "";
  process.env.RESEND_AUDIENCE_ID = configured ? "aud_test" : "";
  return (await import("./route")).POST;
}

const message = async (response: Response) =>
  ((await response.json()) as { error?: { message: string } }).error?.message;

beforeEach(() => {
  state.result = "subscribed";
  state.emails = [];
});

describe("POST /api/subscribe", () => {
  it("adds a valid email (trimmed, lower-cased)", async () => {
    const POST = await load();
    const response = await POST(post({ email: "  Ada@Example.com " }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(state.emails).toEqual(["ada@example.com"]);
  });

  it("rejects empty or invalid emails", async () => {
    const POST = await load();
    for (const body of [{ email: "" }, { email: "not-an-email" }, {}, null]) {
      const response = await POST(post(body));
      expect(response.status).toBe(400);
      expect(await message(response)).toBe("Invalid email");
    }
    expect(state.emails).toEqual([]);
  });

  it("says already subscribed, and hides Resend's errors", async () => {
    const POST = await load();
    state.result = "already";
    const already = await POST(post({ email: "a@b.co" }));
    expect(already.status).toBe(409);
    expect(await message(already)).toBe("Already subscribed");

    state.result = "throw";
    const failed = await POST(post({ email: "a@b.co" }, "5.6.7.8"));
    expect(failed.status).toBe(502);
    expect(await message(failed)).toBe("Something went wrong. Please try again.");
  });

  it("answers a filled honeypot like a success without adding anything", async () => {
    const POST = await load();
    const response = await POST(post({ email: "bot@spam.co", website: "https://spam.co" }));
    expect(response.status).toBe(200);
    expect(state.emails).toEqual([]);
  });

  it("is off (503) without the Resend variables", async () => {
    const POST = await load(false);
    const response = await POST(post({ email: "a@b.co" }));
    expect(response.status).toBe(503);
    expect(state.emails).toEqual([]);
  });

  it("limits signups per IP", async () => {
    const POST = await load();
    for (let i = 0; i < 10; i++)
      expect((await POST(post({ email: `u${i}@b.co` }, "9.9.9.9"))).status).toBe(200);
    expect((await POST(post({ email: "u11@b.co" }, "9.9.9.9"))).status).toBe(429);
  });
});
