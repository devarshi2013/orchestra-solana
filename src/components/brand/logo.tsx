import { cn } from "@/lib/utils";

import { QuillMark } from "./quill-mark";

/** The Quill mark on its own (the Q with a feather and a pen-nib tail). */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return <QuillMark className={className} title={title} />;
}

/** Mark + "Quill" in Sora. */
export function Wordmark({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={cn("size-8", markClassName)} />
      <span className="font-heading text-lg font-semibold tracking-tight text-foreground">
        Quill
      </span>
    </span>
  );
}
