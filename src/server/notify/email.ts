import "server-only";

import { serverEnv } from "@/env/server";

export type Email = { to: string; subject: string; text: string; html: string };

/**
 * Sends through Resend's REST API when RESEND_API_KEY and EMAIL_FROM are set;
 * otherwise logs the email, so development needs no mail setup. Returns
 * whether it was actually sent.
 */
export async function sendEmail(email: Email): Promise<boolean> {
  if (!serverEnv.RESEND_API_KEY || !serverEnv.EMAIL_FROM) {
    console.info(
      `[email] (not configured) to=${email.to} subject="${email.subject}"\n${email.text}`,
    );
    return false;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${serverEnv.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from: serverEnv.EMAIL_FROM, ...email }),
  });
  if (!response.ok) {
    throw new Error(`Resend ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  return true;
}
