import { describe, expect, it } from "vitest";

import { addSubscriber, ResendFailure } from "./subscribe";

type Contact = { email: string; unsubscribed: boolean; segments: string[] };
const err = (name: string, message = name) => ({ data: null, error: { name, message } });
const ok = <T>(data: T) => ({ data, error: null });

/** A small in-memory stand-in for the Resend contacts API. */
function fakeResend(contacts: Contact[] = []) {
  const find = (email: string) => contacts.find((c) => c.email === email);
  const calls: string[] = [];
  const resend = {
    contacts: {
      get: async ({ email }: { email: string }) => {
        calls.push("get");
        const c = find(email);
        return c ? ok({ id: email, email, unsubscribed: c.unsubscribed }) : err("not_found");
      },
      create: async ({ email, segments }: { email: string; segments: { id: string }[] }) => {
        calls.push("create");
        contacts.push({ email, unsubscribed: false, segments: segments.map((s) => s.id) });
        return ok({ id: email, object: "contact" });
      },
      update: async ({ email, unsubscribed }: { email: string; unsubscribed: boolean }) => {
        calls.push("update");
        find(email)!.unsubscribed = unsubscribed;
        return ok({ id: email, object: "contact" });
      },
      segments: {
        list: async ({ email }: { email: string }) => {
          calls.push("list");
          return ok({ data: find(email)!.segments.map((id) => ({ id })) });
        },
        add: async ({ email, segmentId }: { email: string; segmentId: string }) => {
          calls.push("add");
          find(email)!.segments.push(segmentId);
          return ok({ id: segmentId });
        },
      },
    },
  };
  return { resend: resend as unknown as Parameters<typeof addSubscriber>[0], contacts, calls };
}

describe("addSubscriber", () => {
  it("creates a new email straight into the audience", async () => {
    const { resend, contacts, calls } = fakeResend();
    await expect(addSubscriber(resend, "aud_1", "a@b.co")).resolves.toBe("subscribed");
    expect(contacts).toEqual([{ email: "a@b.co", unsubscribed: false, segments: ["aud_1"] }]);
    expect(calls).toEqual(["get", "create"]);
  });

  it("says already subscribed for a contact in the audience", async () => {
    const { resend, calls } = fakeResend([
      { email: "a@b.co", unsubscribed: false, segments: ["aud_1"] },
    ]);
    await expect(addSubscriber(resend, "aud_1", "a@b.co")).resolves.toBe("already");
    expect(calls).toEqual(["get", "list"]);
  });

  it("adds a known contact to the audience, and re-subscribes one who opted out", async () => {
    const { resend, contacts } = fakeResend([
      { email: "a@b.co", unsubscribed: false, segments: ["other"] },
      { email: "c@d.co", unsubscribed: true, segments: ["aud_1"] },
    ]);
    await expect(addSubscriber(resend, "aud_1", "a@b.co")).resolves.toBe("subscribed");
    await expect(addSubscriber(resend, "aud_1", "c@d.co")).resolves.toBe("subscribed");
    expect(contacts).toEqual([
      { email: "a@b.co", unsubscribed: false, segments: ["other", "aud_1"] },
      { email: "c@d.co", unsubscribed: false, segments: ["aud_1"] },
    ]);
  });

  it("throws on other Resend errors", async () => {
    const { resend } = fakeResend();
    resend.contacts.get = (async () =>
      err("invalid_api_key", "API key is invalid")) as unknown as typeof resend.contacts.get;
    await expect(addSubscriber(resend, "aud_1", "a@b.co")).rejects.toBeInstanceOf(ResendFailure);
  });
});
