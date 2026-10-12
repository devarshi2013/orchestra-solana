"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  MoreHorizontal,
  PanelLeftClose,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNow } from "@/hooks/use-now";
import { groupChats, searchChats, type StoredChat } from "@/lib/assistant/chat-history";
import { cn } from "@/lib/utils";

import { IconButton, SoftButton } from "./controls";

const LONG_PRESS_MS = 500;

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
 * Chat history: "New chat" and search, then the chats grouped by date (pinned
 * first) with a menu to rename, pin or delete each, and the settings at the
 * bottom. Used as the desktop sidebar and inside the mobile drawer.
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
    const items = [
      ...(listRef.current?.querySelectorAll<HTMLButtonElement>("[data-chat-item]") ?? []),
    ];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const last = items.length - 1;
    const moves: Record<string, number> = {
      Home: 0,
      End: last,
      ArrowDown: Math.min(last, index + 1),
      ArrowUp: Math.max(0, index - 1),
    };
    const next = moves[event.key];
    if (next === undefined || items.length === 0) return;
    event.preventDefault();
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
      <div className="flex items-center gap-1 px-3 pt-3">
        <SoftButton
          className="mr-auto pl-2.5"
          onClick={onNew}
          disabled={busy}
          aria-keyshortcuts="Control+Shift+O Meta+Shift+O"
        >
          <Plus className="size-4" /> New chat
        </SoftButton>
        {onCollapse && (
          <IconButton onClick={onCollapse} aria-label="Close sidebar">
            <PanelLeftClose />
          </IconButton>
        )}
      </div>
      <div className="px-3 pt-2">
        <label className="relative flex h-9 items-center rounded-full bg-soft transition-[background-color,box-shadow] duration-150 focus-within:bg-white focus-within:shadow-hairline">
          <span className="sr-only">Search chats</span>
          <Search
            className="pointer-events-none absolute left-3 size-3.5 text-ink-muted"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
            placeholder="Search"
            className="h-full w-full rounded-full bg-transparent pr-8 pl-8.5 text-[13.5px] tracking-[-0.01em] text-text-extra-high outline-none placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <IconButton
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-1 size-7 [&_svg]:size-3.5"
            >
              <X />
            </IconButton>
          )}
        </label>
      </div>

      {/* The chats */}
      {/* The scroll area's inner wrapper is a table by default, which lets long titles widen the list. */}
      <ScrollArea className="mt-2 min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]>div]:block!">
        <nav aria-label="Chat history" className="px-2 pb-3">
          {chats.length === 0 ? null : groups.length === 0 ? (
            <p className="px-3 py-6 text-[13px] text-ink-muted">No matches</p>
          ) : (
            <div ref={listRef} onKeyDown={onListKeyDown}>
              {groups.map((group) => (
                <section
                  key={group.label}
                  aria-labelledby={`chats-${group.label}`}
                  className="mb-2"
                >
                  <h3
                    id={`chats-${group.label}`}
                    className="px-2.5 pt-3 pb-1 text-[11.5px] font-medium text-ink-muted"
                  >
                    {group.label}
                  </h3>
                  <ul className="space-y-px">
                    <AnimatePresence initial={false}>
                      {group.chats.map((chat) => {
                        const active = chat.id === activeId;
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
                                className="h-8.5 w-full rounded-[10px] bg-white px-2.5 text-[13.5px] tracking-[-0.01em] text-text-extra-high shadow-hairline outline-none"
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
                                    "flex h-8.5 w-full items-center gap-2 rounded-[10px] px-2.5 pr-8 text-left text-[13.5px] tracking-[-0.01em] transition-colors duration-150 outline-none select-none focus-visible:ring-2 focus-visible:ring-gray-1200",
                                    active
                                      ? "bg-soft-strong font-medium text-text-extra-high"
                                      : "text-text-high hover:bg-soft hover:text-text-extra-high",
                                    busy && !active && "cursor-not-allowed opacity-60",
                                  )}
                                >
                                  <span className="min-w-0 flex-1 truncate">{chat.title}</span>
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
                                        "absolute top-1/2 right-1 flex size-6.5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-ink-muted opacity-0 transition-[opacity,background-color,color] duration-150 outline-none group-hover/chat:opacity-100 hover:bg-white hover:text-text-extra-high focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-gray-1200 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100",
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

      <div className="flex justify-end px-3 pt-1 pb-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton aria-label="Chat settings" className="[&_svg]:size-[17px]">
              <Settings />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-44">
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
            <AlertDialogDescription>&ldquo;{confirmDelete?.title}&rdquo;</AlertDialogDescription>
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
              {chats.length} {chats.length === 1 ? "chat" : "chats"}
              {guest ? " saved as a guest" : " for this wallet"}
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
