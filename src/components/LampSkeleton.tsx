import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { tx } from "@/lib/i18n-strings";

/**
 * The lamp warming up — a loading placeholder that gains warmth instead of a
 * grey shimmer or a spinner (see `.lamp-skeleton` in styles.css). The brass
 * overlay pulses opacity only (compositor-cheap), and it holds perfectly still
 * under reduced motion. Content replaces it in place when it arrives.
 *
 * A single block; compose several via `LampSkeletonList` for a loading list.
 */
export function LampSkeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("lamp-skeleton", className)} />;
}

/**
 * A short stack of lamp placeholders for a list that is still loading. Announced
 * once to assistive tech ("Loading…") while the blocks themselves are decorative.
 */
export function LampSkeletonList({
  rows = 3,
  rowClassName = "h-16 w-full",
  className,
  label,
}: {
  rows?: number;
  rowClassName?: string;
  className?: string;
  label?: string;
}) {
  const lang = useLang();
  return (
    <div role="status" aria-live="polite" className={cn("space-y-3", className)}>
      <span className="sr-only">{label ?? tx(lang, "Loading…")}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <LampSkeleton key={i} className={rowClassName} />
      ))}
    </div>
  );
}
