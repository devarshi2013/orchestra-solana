import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LABEL = { high: "High liquidity", medium: "Medium liquidity", low: "Low liquidity" };

/** The registry's liquidity tier (from a 100 USDC test quote's price impact). */
export function LiquidityBadge({
  tier,
  className,
}: {
  tier: "high" | "medium" | "low";
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      title={`${LABEL[tier]} (price impact of a 100 USDC test quote)`}
      className={cn(
        "gap-1 font-normal",
        tier === "high" && "border-success/40 text-success",
        tier === "medium" && "border-warning/40 text-warning",
        tier === "low" && "border-destructive/40 text-destructive",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          tier === "high" && "bg-success",
          tier === "medium" && "bg-warning",
          tier === "low" && "bg-destructive",
        )}
      />
      {LABEL[tier].split(" ")[0]}
    </Badge>
  );
}
