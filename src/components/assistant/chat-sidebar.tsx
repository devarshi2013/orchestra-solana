"use client";

import { Check, MessageSquare, Pencil, SquarePen, Trash2, X } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-now";
import { groupChats, type StoredChat } from "@/lib/assistant/chat-history";
import { cn } from "@/lib/utils";

/**
 * Past conversations, grouped by when they were last active: open, rename
 * (inline) or delete (with a confirmation). Used as the desktop sidebar and
 * inside the mobile drawer.
 */
export function ChatSidebar({
  chats,
  activeId,
  busy,
  onNew,
  onOpen,
  onRename,
  onDelete,
}: {
  chats: StoredChat[];
  activeId: string | null;
  /** While a reply streams, switching chats is disabled. */
  busy: boolean;
  onNew: () => void;
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}) {
  const now = new Date(useNow());
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);
  const [confirming, setConfirming] = useState<StoredChat | null>(null);

  const finishRename = () => {
    if (editing) onRename(editing.id, editing.title);
    setEditing(null);
  };

  return (
    <nav aria-label="Chat history" className="flex h-full min-h-0 flex-col gap-3">
      <Button variant="outline" className="w-full justify-start" onClick={onNew} disabled={busy}>
        <SquarePen /> New chat
      </Button>

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        {chats.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            Your chats will appear here. They&apos;re saved in this browser for this wallet only.
          </p>
        ) : (
          groupChats(chats, now).map((group) => (
            <section key={group.label} className="mb-4">
              <h3 className="px-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {group.label}
              </h3>
              <ul className="space-y-0.5">
                {group.chats.map((chat) => {
                  const active = chat.id === activeId;
                  if (editing?.id === chat.id) {
                    return (
                      <li key={chat.id} className="flex items-center gap-1 px-1">
                        <input
                          autoFocus
                          aria-label="Chat name"
                          value={editing.title}
                          maxLength={80}
                          onChange={(e) => setEditing({ id: chat.id, title: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") finishRename();
                            if (e.key === "Escape") setEditing(null);
                          }}
                          className="h-8 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
                        />
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Save name"
                          onClick={finishRename}
                        >
                          <Check />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Cancel renaming"
                          onClick={() => setEditing(null)}
                        >
                          <X />
                        </Button>
                      </li>
                    );
                  }
                  return (
                    <li key={chat.id} className="group/chat relative">
                      <button
                        type="button"
                        onClick={() => onOpen(chat.id)}
                        disabled={busy && !active}
                        aria-current={active ? "page" : undefined}
                        title={chat.title}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 pr-16 text-left text-sm transition-colors disabled:opacity-50",
                          active
                            ? "bg-muted font-medium text-foreground"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                      >
                        <MessageSquare className="size-3.5 shrink-0 opacity-60" />
                        <span className="truncate">{chat.title}</span>
                      </button>
                      <div
                        className={cn(
                          "absolute inset-y-0 right-1 flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within/chat:opacity-100 group-hover/chat:opacity-100",
                          active && "opacity-100",
                        )}
                      >
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Rename "${chat.title}"`}
                          onClick={() => setEditing({ id: chat.id, title: chat.title })}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Delete "${chat.title}"`}
                          disabled={busy && active}
                          onClick={() => setConfirming(chat)}
                          className="hover:text-destructive"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>

      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{confirming?.title}&rdquo; and any plan in it will be removed from this
              browser. Purchases you made stay in your wallet; this can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (confirming) onDelete(confirming.id);
                setConfirming(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </nav>
  );
}
