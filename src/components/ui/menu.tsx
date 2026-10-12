import { cn } from "@/lib/utils";

export function Menu({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "absolute top-full z-20 mt-1 flex origin-top-right animate-in flex-col rounded-md border border-wallet-btn-border bg-wallet-btn-surface shadow-lg duration-200 ease-out fade-in-0 zoom-in-95 slide-in-from-top-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MenuItem({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-sm px-2 py-1 text-left text-[11px] transition-colors",
        active
          ? "bg-wallet-btn-surface-hover text-wallet-btn-fg"
          : "text-wallet-fg-muted hover:bg-wallet-btn-surface-hover hover:text-wallet-btn-fg",
      )}
    >
      {children}
    </button>
  );
}
