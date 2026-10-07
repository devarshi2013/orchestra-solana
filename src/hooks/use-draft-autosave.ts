"use client";

import { useEffect, useState } from "react";

import { ApiError, fetchDraft, saveDraft } from "@/lib/api-client";
import { useSymphonyEditor } from "@/stores/symphony-editor";

const SAVE_DELAY_MS = 1000;

/**
 * Restores the local draft, opens `?draft=<id>` from Postgres when given, and
 * saves every edit to Postgres a second after typing stops. Returns false
 * until the local draft is restored, so the editor never flashes defaults.
 */
export function useDraftAutosave(): { ready: boolean; notFound: boolean } {
  const [ready, setReady] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const draftId = useSymphonyEditor((s) => s.draftId);
  const revision = useSymphonyEditor((s) => s.revision);
  const savedRevision = useSymphonyEditor((s) => s.savedRevision);

  // Restore, then pick the draft: the URL's, else the local one, else a new id.
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      await useSymphonyEditor.persist.rehydrate();
      const store = useSymphonyEditor.getState();
      const urlId = new URLSearchParams(window.location.search).get("draft");
      if (urlId && urlId !== store.draftId) {
        try {
          const draft = await fetchDraft(urlId, controller.signal);
          store.loadSymphony(draft.symphony, draft.id);
          const { revision: loaded } = useSymphonyEditor.getState();
          useSymphonyEditor.getState().setSaveStatus("saved", loaded, draft.updatedAt);
        } catch (error) {
          if (controller.signal.aborted) return;
          if (error instanceof ApiError && error.status === 404) setNotFound(true);
        }
      }
      if (!useSymphonyEditor.getState().draftId) {
        useSymphonyEditor.getState().setDraftId(crypto.randomUUID());
      }
      setReady(true);
    })();
    return () => controller.abort();
  }, []);

  // Keep the URL pointing at the current draft, so it can be reopened or shared.
  useEffect(() => {
    if (!ready || !draftId) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("draft") === draftId) return;
    url.searchParams.set("draft", draftId);
    window.history.replaceState(null, "", url);
  }, [ready, draftId]);

  // Debounced save of the latest revision.
  useEffect(() => {
    if (!ready || !draftId || revision === savedRevision) return;
    const timer = setTimeout(() => {
      const { symphony, setSaveStatus } = useSymphonyEditor.getState();
      if (!symphony.name.trim()) return setSaveStatus("error");
      setSaveStatus("saving");
      saveDraft(draftId, symphony)
        .then((saved) => setSaveStatus("saved", revision, saved.updatedAt))
        .catch(() => setSaveStatus("error"));
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [ready, draftId, revision, savedRevision]);

  return { ready, notFound };
}
