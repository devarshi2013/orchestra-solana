import "server-only";

import type { Resend } from "resend";

/**
 * Adds an email to the Resend audience behind the signup forms. Resend now
 * calls audiences "segments" (an existing audience ID works as a segment ID),
 * and a contact exists once per account, so:
 * - a new email is created straight into the segment;
 * - a known email already in the segment (and not unsubscribed) is "already";
 * - otherwise it's added to the segment, and re-subscribed if it had opted out
 *   (they just asked to join again).
 */
export async function addSubscriber(
  resend: Pick<Resend, "contacts">,
  segmentId: string,
  email: string,
): Promise<"subscribed" | "already"> {
  const existing = await resend.contacts.get({ email });
  if (existing.error && existing.error.name !== "not_found")
    throw new ResendFailure(existing.error);

  if (!existing.data) {
    const created = await resend.contacts.create({ email, segments: [{ id: segmentId }] });
    if (created.error) throw new ResendFailure(created.error);
    return "subscribed";
  }

  const segments = await resend.contacts.segments.list({ email });
  if (segments.error) throw new ResendFailure(segments.error);
  const inSegment = segments.data?.data.some((s) => s.id === segmentId) ?? false;
  if (inSegment && !existing.data.unsubscribed) return "already";

  if (!inSegment) {
    const added = await resend.contacts.segments.add({ email, segmentId });
    if (added.error) throw new ResendFailure(added.error);
  }
  if (existing.data.unsubscribed) {
    const updated = await resend.contacts.update({ email, unsubscribed: false });
    if (updated.error) throw new ResendFailure(updated.error);
  }
  return "subscribed";
}

/** A Resend API error (name and message only; never the key). */
export class ResendFailure extends Error {
  constructor(readonly detail: { name: string; message: string }) {
    super(`${detail.name}: ${detail.message}`);
  }
}
