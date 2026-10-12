import { cn } from "@/lib/utils";

type IconName = "dropdown-arrow";

const DEFAULT_SIZE: Record<IconName, string> = {
  "dropdown-arrow": "w-6 h-6",
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const url = `url(/icons/${name}.svg)`;
  return (
    <span
      role="img"
      aria-hidden="true"
      className={cn("inline-block shrink-0 bg-current", DEFAULT_SIZE[name], className)}
      style={{
        WebkitMaskImage: url,
        maskImage: url,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}
