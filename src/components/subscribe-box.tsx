"use client";

import { Mail } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { subscribeEmail } from "@/lib/api-client";

/**
 * A small email signup card (home page). Posts to /api/subscribe, like the
 * footer's form: "Subscribing…" while sending, the server's message on failure,
 * and a hidden honeypot field for bots.
 */
export function SubscribeBox() {
  const id = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const honeypot = useRef<HTMLInputElement>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    try {
      await subscribeEmail(email, honeypot.current?.value ?? "");
      setState("done");
      setEmail("");
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Something went wrong. Please try again.",
      );
      setState("error");
    }
  };

  return (
    <section aria-labelledby={`${id}-heading`} className="border-t">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 rounded-2xl border bg-card p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2 md:max-w-xs">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Mail className="size-4.5" aria-hidden />
            </span>
            <h2 id={`${id}-heading`} className="pt-1 text-xl font-semibold">
              Stay in the loop
            </h2>
            <p className="text-sm text-muted-foreground">
              New stocks, features and updates to Quill, now and then.
            </p>
          </div>

          <form className="relative w-full md:max-w-sm" onSubmit={submit}>
            <label htmlFor={`${id}-email`} className="block text-sm font-medium">
              Get updates by email
            </label>
            {/* Honeypot: hidden from people (and screen readers), so only bots fill it in. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label htmlFor={`${id}-website`}>Website</label>
              <input
                ref={honeypot}
                id={`${id}-website`}
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>
            <div className="mt-2 flex gap-2">
              <input
                id={`${id}-email`}
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setState("idle");
                }}
                className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30"
              />
              <Button type="submit" disabled={state === "sending"}>
                {state === "sending" ? "Subscribing…" : "Subscribe"}
              </Button>
            </div>
            <p role="status" className="mt-2 min-h-5 text-sm text-muted-foreground">
              {state === "done" && "Thanks, you're on the list."}
              {state === "error" && <span className="font-medium text-foreground">{error}</span>}
            </p>
            <p className="text-xs text-muted-foreground">No spam. Unsubscribe anytime.</p>
          </form>
        </div>
      </div>
    </section>
  );
}
