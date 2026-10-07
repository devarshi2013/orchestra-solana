import * as React from "react";
import { cn } from "cn";

/** Page title block: optional eyebrow, h1, description, and actions on the right. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        {eyebrow && (
          <p className="text-xs font-semibold tracking-wider text-primary uppercase dark:text-accent-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="type-h1">{title}</h1>
        {description && <p className="max-w-2xl text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A labelled card section (h2 + optional description and actions). */
export function Section({
  title,
  description,
  actions,
  className,
  bodyClassName,
  children,
  ...props
}: Omit<React.ComponentProps<"section">, "title"> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  bodyClassName?: string;
}) {
  const id = React.useId();
  return (
    <section
      aria-labelledby={id}
      className={cn("rounded-xl border bg-card text-card-foreground shadow-soft", className)}
      {...props}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4 sm:px-6">
        <div className="min-w-0 space-y-1">
          <h2 id={id} className="type-h2">
            {title}
          </h2>
          {description && <p className="type-caption">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div className={cn("p-4 sm:p-6", bodyClassName)}>{children}</div>
    </section>
  );
}
