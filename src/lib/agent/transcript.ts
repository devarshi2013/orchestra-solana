import { redactAddressesInData } from "./redact";

/** Longest tool result shown in a "data used" panel. */
export const MAX_DISPLAYED_RESULT = 20_000;

/** A tool result as the browser may show it: addresses redacted, very long results cut. */
export function displayToolResult(content: string): string {
  const safe = redactAddressesInData(content);
  return safe.length > MAX_DISPLAYED_RESULT
    ? `${safe.slice(0, MAX_DISPLAYED_RESULT)}\n… (cut: ${safe.length - MAX_DISPLAYED_RESULT} more characters)`
    : safe;
}
