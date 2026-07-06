import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type Tint = "none" | "rose" | "sky" | "amber" | "mint" | "lavender";

interface TactileCardProps extends HTMLAttributes<HTMLDivElement> {
  tint?: Tint;
  as?: "div" | "section" | "article";
}

const TINT_CLASS: Record<Tint, string> = {
  none: "",
  rose: "tactile-tint-rose",
  sky: "tactile-tint-sky",
  amber: "tactile-tint-amber",
  mint: "tactile-tint-mint",
  lavender: "tactile-tint-lavender",
};

export function TactileCard({ tint = "none", className, children, ...rest }: TactileCardProps) {
  return (
    <div
      className={cn("tactile p-6 sm:p-7", TINT_CLASS[tint], className)}
      {...rest}
    >
      {children}
    </div>
  );
}