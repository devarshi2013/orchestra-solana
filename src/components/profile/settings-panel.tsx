"use client";

import { useState } from "react";

import { SoftButton } from "@/components/assistant/controls";

/** Where triggered strategies are POSTed. */
export function SettingsPanel({
  url,
  onSave,
}: {
  url: string | null;
  onSave: (url: string | null) => Promise<void>;
}) {
  const [text, setText] = useState(url ?? "");
  const [state, setState] = useState<{ saving: boolean; error: string | null; saved: boolean }>({
    saving: false,
    error: null,
    saved: false,
  });
  const save = (next: string | null) => {
    setState({ saving: true, error: null, saved: false });
    void onSave(next)
      .then(() => setState({ saving: false, error: null, saved: true }))
      .catch((e: unknown) =>
        setState({
          saving: false,
          error: e instanceof Error ? e.message : "Couldn't save",
          saved: false,
        }),
      );
  };

  return (
    <section className="max-w-2xl rounded-[24px] bg-white p-5 shadow-hairline">
      <label htmlFor="webhook" className="text-[14px] font-medium text-text-extra-high">
        Webhook
      </label>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          id="webhook"
          type="url"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="https://discord.com/api/webhooks/…"
          className="h-11 w-full min-w-0 rounded-[14px] bg-soft px-3.5 text-[14px] outline-none placeholder:text-ink-muted focus:bg-white focus:shadow-hairline sm:flex-1"
        />
        <SoftButton
          dark
          className="h-11"
          disabled={state.saving || !text.trim()}
          onClick={() => save(text.trim())}
        >
          Save
        </SoftButton>
        {url && (
          <SoftButton
            className="h-11"
            disabled={state.saving}
            onClick={() => {
              setText("");
              save(null);
            }}
          >
            Clear
          </SoftButton>
        )}
      </div>
      <p className="mt-2 text-[12.5px] text-ink-muted">
        {state.error ? (
          <span className="text-status-error-text">{state.error}</span>
        ) : state.saved ? (
          "Saved"
        ) : (
          <>
            POST <code className="font-mono">{"{ text, content, strategy, price, url }"}</code> when
            a strategy triggers
          </>
        )}
      </p>
    </section>
  );
}
