"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  MoreHorizontal,
  PanelLeftClose,
  Pencil,
  Pin,
  PinOff,
  Search,
  Settings,
  ShoppingBag,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";

import { Wordmark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WalletButton } from "@/components/wallet/wallet-button";
import { useNow } from "@/hooks/use-now";
import {
  groupChats,
  hasPurchase,
  searchChats,
  type StoredChat,
} from "@/lib/assistant/chat-history";
import { cn } from "@/lib/utils";

const LONG_PRESS_MS = 500;

/** "⌘⇧O" on Apple devices, "Ctrl+Shift+O" elsewhere. */
function shortcutLabel() {
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘⇧O" : "Ctrl+Shift+O";
}

export type ChatSidebarProps = {
  chats: StoredChat[];
  activeId: string | null;
  /** While a reply streams, other chats can't be opened. */
  busy: boolean;
  /** "guest" before a wallet connects. */
  guest: boolean;
  onNew: () => void;
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  /** Desktop only: hides the sidebar. */
  onCollapse?: () => void;
};

/**
 * Chat history, ChatGPT-style: logo and "New chat", a search box, chats
 * grouped by date (pinned first) with a menu to rename, pin or delete each,
 * and the wallet, theme and settings at the bottom. Used as the desktop
 * sidebar and inside the mobile drawer.
 */
export function ChatSidebar({
  chats,
  activeId,
  busy,
  guest,
  onNew,
  onOpen,
  onRename,
  onPin,
  onDelete,
  onClearAll,
  onCollapse,
}: ChatSidebarProps) {
  const nowMs = useNow();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StoredChat | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const skipBlurSave = useRef(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A long press opens the menu; the click that ends it mustn't also open the chat.
  const longPressed = useRef(false);
  const [shortcut] = useState(shortcutLabel);

  const groups = useMemo(
    () => groupChats(searchChats(chats, query), new Date(nowMs)),
    [chats, query, nowMs],
  );
  const announce = (text: string) => setAnnouncement(text);

  const finishRename = () => {
    if (!editing) return;
    const title = editing.title.replace(/\s+/g, " ").trim();
    const before = chats.find((c) => c.id === editing.id)?.title;
    if (title && title !== before) {
      onRename(editing.id, title);
      announce(`Renamed to ${title}`);
    }
    setEditing(null);
  };

  /** Up/Down/Home/End move between chats; Enter opens the focused one (it's a button). */
  const onListKeyDown = (event: KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = [
      ...(listRef.current?.querySelectorAll<HTMLButtonElement>("[data-chat-item]") ?? []),
    ];
    if (items.length === 0) return;
    event.preventDefault();
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : event.key === "ArrowDown"
            ? Math.min(items.length - 1, index + 1)
            : Math.max(0, index < 0 ? 0 : index - 1);
    items[next]?.focus();
  };

  const startPress = (id: string) => {
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setMenuFor(id);
    }, LONG_PRESS_MS);
  };
  const endPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Logo, collapse, new chat */}
      <div className="flex items-center gap-2 px-3 pt-3">
        <Link
          href="/"
          aria-label="Quill home"
          className="flex-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Wordmark />
        </Link>
        {onCollapse && (
          <Button variant="ghost" size="icon-sm" onClick={onCollapse} aria-label="Close sidebar">
            <PanelLeftClose />
          </Button>
        )}
      </div>
      <div className="space-y-2 px-3 pt-3">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={onNew}
          disabled={busy}
          aria-keyshortcuts="Control+Shift+O Meta+Shift+O"
        >
          <SquarePen /> New chat
          <kbd className="ml-auto font-mono text-[10px] font-normal text-muted-foreground">
            {shortcut}
          </kbd>
        </Button>
        <label className="relative block">
          <span className="sr-only">Search chats</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
            placeholder="Search chats"
            className="h-8 w-full rounded-md border border-input bg-transparent pr-7 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <X className="size-3.5" />
            </button>
          )}
        </label>
      </div>

      {/* The chats */}
      <ScrollArea className="mt-3 min-h-0 flex-1">
        <nav aria-label="Chat history" className="px-2 pb-3">
          {chats.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No chats yet. Ask about any stock to get started.
            </p>
          ) : groups.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No chats match &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <div ref={listRef} onKeyDown={onListKeyDown}>
              {groups.map((group) => (
                <section
                  key={group.label}
                  aria-labelledby={`chats-${group.label}`}
                  className="mb-3"
                >
                  <h3
                    id={`chats-${group.label}`}
                    className="flex items-center gap-1 px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
                  >
                    {group.label === "Pinned" && <Pin className="size-3" aria-hidden />}
                    {group.label}
                  </h3>
                  <ul className="space-y-0.5">
                    <AnimatePresence initial={false}>
                      {group.chats.map((chat) => {
                        const active = chat.id === activeId;
                        const purchased = hasPurchase(chat);
                        return (
                          <motion.li
                            key={chat.id}
                            layout="position"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                            className="group/chat relative overflow-hidden"
                          >
                            {editing?.id === chat.id ? (
                              <input
                                autoFocus
                                aria-label="Chat name. Enter to save, Escape to cancel"
                                value={editing.title}
                                maxLength={80}
                                onFocus={(e) => e.currentTarget.select()}
                                onChange={(e) => setEditing({ id: chat.id, title: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") finishRename();
                                  if (e.key === "Escape") {
                                    skipBlurSave.current = true;
                                    setEditing(null);
                                  }
                                }}
                                onBlur={() => {
                                  if (skipBlurSave.current) skipBlurSave.current = false;
                                  else finishRename();
                                }}
                                className="h-8 w-full rounded-md border border-ring bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              />
                            ) : (
                              <>
                                <button
                                  type="button"
                                  data-chat-item
                                  onClick={() => {
                                    if (longPressed.current) longPressed.current = false;
                                    else onOpen(chat.id);
                                  }}
                                  onPointerDown={(e) =>
                                    e.pointerType === "touch" && startPress(chat.id)
                                  }
                                  onPointerUp={endPress}
                                  onPointerLeave={endPress}
                                  onPointerCancel={endPress}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    setMenuFor(chat.id);
                                  }}
                                  aria-current={active ? "page" : undefined}
                                  aria-disabled={busy && !active}
                                  title={chat.title}
                                  className={cn(
                                    "flex h-8 w-full items-center gap-1.5 rounded-md px-2 pr-8 text-left text-sm transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring",
                                    active
                                      ? "bg-primary/12 font-medium text-foreground"
                                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                    busy && !active && "cursor-not-allowed opacity-60",
                                  )}
                                >
                                  <span className="min-w-0 flex-1 truncate">{chat.title}</span>
                                  {purchased && (
                                    <ShoppingBag
                                      className="size-3.5 shrink-0 text-success"
                                      aria-label="Purchase made"
                                    />
                                  )}
                                </button>
                                <DropdownMenu
                                  open={menuFor === chat.id}
                                  onOpenChange={(open) => setMenuFor(open ? chat.id : null)}
                                >
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      aria-label={`Options for "${chat.title}"`}
                                      className={cn(
                                        "absolute top-1/2 right-1 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity outline-none group-hover/chat:opacity-100 hover:bg-background/70 hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100",
                                        active && "opacity-100",
                                      )}
                                    >
                                      <MoreHorizontal className="size-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start" className="w-40">
                                    <DropdownMenuItem
                                      onSelect={() =>
                                        setEditing({ id: chat.id, title: chat.title })
                                      }
                                    >
                                      <Pencil /> Rename
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onSelect={() => {
                                        onPin(chat.id, !chat.pinned);
                                        announce(
                                          chat.pinned
                                            ? `Unpinned ${chat.title}`
                                            : `Pinned ${chat.title}`,
                                        );
                                      }}
                                    >
                                      {chat.pinned ? <PinOff /> : <Pin />}
                                      {chat.pinned ? "Unpin" : "Pin to top"}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      variant="destructive"
                                      disabled={busy && active}
                                      onSelect={() => setConfirmDelete(chat)}
                                    >
                                      <Trash2 /> Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </>
                            )}
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ul>
                </section>
              ))}
            </div>
          )}
        </nav>
      </ScrollArea>

      {/* Wallet, theme, settings */}
      <div className="space-y-2 border-t p-3">
        <p className="px-1 text-[11px] text-muted-foreground">
          {guest
            ? "Guest: chats are saved in this browser. Connect a wallet to keep them with it."
            : "Saved in this browser, for this wallet only."}
        </p>
        <div className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1 [&_.wallet-adapter-button]:h-9 [&_.wallet-adapter-button]:w-full [&_.wallet-adapter-button]:justify-center [&_.wallet-adapter-button]:px-3 [&_.wallet-adapter-button]:text-sm">
            <WalletButton />
          </div>
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Chat settings">
                <Settings />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-48">
              <DropdownMenuItem
                variant="destructive"
                disabled={chats.length === 0 || busy}
                onSelect={() => setConfirmClear(true)}
              >
                <Trash2 /> Clear all history
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{confirmDelete?.title}&rdquo; and any plan in it will be removed from this
              browser. Purchases you made stay in your wallet; this can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (confirmDelete) {
                  onDelete(confirmDelete.id);
                  announce(`Deleted ${confirmDelete.title}`);
                }
                setConfirmDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all chat history?</AlertDialogTitle>
            <AlertDialogDescription>
              All {chats.length} {chats.length === 1 ? "chat" : "chats"}
              {guest ? " saved as a guest" : " for this wallet"} will be removed from this browser,
              pinned ones included. Purchases you made stay in your wallet; this can&apos;t be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                onClearAll();
                announce("Chat history cleared");
                setConfirmClear(false);
              }}
            >
              Clear all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
