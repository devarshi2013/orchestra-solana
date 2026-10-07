/** A Solana address or mint: base58, 32-44 characters. */
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EDGE_PUNCTUATION = /^[("'`[{<]*|[)"'`\]}>.,;:!?]*$/g;
export const REDACTED = "[address removed]";

/**
 * A streaming filter that replaces anything shaped like a Solana address in
 * model text. Text is held back only until the current word ends, so output
 * stays streamy. The assistant never sees mints (no tool returns one); this
 * is a backstop for "never output a mint address".
 */
export function createAddressRedactor() {
  let pending = "";
  const scrub = (word: string) => {
    const core = word.replace(EDGE_PUNCTUATION, "");
    return ADDRESS.test(core) ? word.replace(core, REDACTED) : word;
  };
  return {
    /** Returns the text that is safe to emit now. */
    push(delta: string): string {
      pending += delta;
      const lastBreak = Math.max(
        pending.lastIndexOf(" "),
        pending.lastIndexOf("\n"),
        pending.lastIndexOf("\t"),
      );
      if (lastBreak < 0) return "";
      const ready = pending.slice(0, lastBreak + 1);
      pending = pending.slice(lastBreak + 1);
      return ready.split(/(\s+)/).map(scrub).join("");
    },
    /** Emits whatever is held back (call at the end of a text block). */
    flush(): string {
      const rest = scrub(pending);
      pending = "";
      return rest;
    },
  };
}

/** One-shot redaction of a whole string. */
export function redactAddresses(text: string): string {
  const redactor = createAddressRedactor();
  return redactor.push(text) + redactor.flush();
}

const EMBEDDED_ADDRESS =
  /(?<![1-9A-HJ-NP-Za-km-z])[1-9A-HJ-NP-Za-km-z]{32,44}(?![1-9A-HJ-NP-Za-km-z])/g;

/**
 * Redaction for structured data such as JSON tool results, where an address
 * can sit inside quotes or brackets rather than between spaces: any run of
 * 32–44 base58 characters is replaced.
 */
export function redactAddressesInData(text: string): string {
  return text.replace(EMBEDDED_ADDRESS, REDACTED);
}
