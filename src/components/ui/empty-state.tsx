import * as React from "react";
import { cn } from "cn";

/** A friendly placeholder for "nothing here yet", with what to do next. */
export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed bg-surface-raised/40 px-6 py-8 text-center",
        className,
      )}
    >
      {icon && (
        <div className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground [&_svg]:size-5">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="type-h3">{title}</p>
        {children && <p className="mx-auto max-w-sm type-caption text-pretty">{children}</p>}
      </div>
      {action}
    </div>
  );
}
