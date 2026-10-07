import "server-only";

import { ASSISTANT_DISCLOSURE_VERSION } from "@/lib/assistant/disclosure";
import { db } from "@/server/db";
import { InvestError } from "@/server/invest/service";

/** Whether `owner` accepted the current version of the assistant's risk disclosure. */
export async function hasAcceptedDisclosure(owner: string): Promise<boolean> {
  const row = await db.assistantDisclosure.findUnique({ where: { owner } });
  return row !== null && row.version >= ASSISTANT_DISCLOSURE_VERSION;
}

export async function acceptDisclosure(owner: string): Promise<void> {
  await db.assistantDisclosure.upsert({
    where: { owner },
    create: { owner, version: ASSISTANT_DISCLOSURE_VERSION },
    update: { version: ASSISTANT_DISCLOSURE_VERSION, acceptedAt: new Date() },
  });
}

/** A 403 unless the disclosure was accepted (the UI asks first; this is the backstop). */
export async function requireDisclosure(owner: string): Promise<void> {
  if (!(await hasAcceptedDisclosure(owner))) {
    throw new InvestError(403, "Accept the assistant's risk disclosure first");
  }
}
