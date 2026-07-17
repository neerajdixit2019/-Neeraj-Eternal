import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n";
import { tx } from "@/lib/i18n-strings";

/**
 * The breath pacer — a soft ring that breathes at an evidence-based pace:
 * 4s in / 6s out by default (the longer exhale is the parasympathetic
 * lever; no holds, which can feel edgy in panic — Iwabe et al. 2025).
 *
 * The ring is CSS-driven (transform/opacity only, sinusoidal); the phase
 * label re-syncs on every animationiteration so ring and words can't
 * drift apart. Under reduced motion the ring keeps a gentler amplitude —
 * the motion IS the function — and the always-visible count line carries
 * the exercise for anyone who needs zero motion.
 */
export function BreathPacer({
  inSecs = 4,
  outSecs = 6,
  className = "",
}: {
  inSecs?: number;
  outSecs?: number;
  className?: string;
}) {
  const lang = useLang();
  const [phase, setPhase] = useState<"in" | "out">("in");
  const ringRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ringRef.current;
    if (!el) return;
    let t: number | undefined;
    const startCycle = () => {
      setPhase("in");
      t = window.setTimeout(() => setPhase("out"), inSecs * 1000);
    };
    startCycle();
    el.addEventListener("animationiteration", startCycle);
    return () => {
      el.removeEventListener("animationiteration", startCycle);
      if (t) clearTimeout(t);
    };
  }, [inSecs, outSecs]);

  const vars = {
    "--qs-pace-in": `${inSecs}s`,
    "--qs-pace-out": `${outSecs}s`,
  } as React.CSSProperties;

  return (
    <div className={className}>
      {/* room for the ring at full inhale (120px × 1.667 ≈ 200px) */}
      <div className="relative mx-auto flex h-[210px] w-[210px] items-center justify-center" aria-hidden>
        <span className="relative block h-[120px] w-[120px]">
          <span ref={ringRef} className="qs-pacer absolute inset-0 block" style={vars} />
          <span className="qs-pacer--aura" style={vars} />
        </span>
      </div>
      {/* the words breathe with the ring — decorative; the count line below
          is the accessible instruction */}
      <p aria-hidden className="fade-in text-center font-serif text-[17px] font-light" key={phase}>
        {phase === "in" ? tx(lang, "Breathe in") : tx(lang, "Breathe out")}
      </p>
      <p className="mt-1.5 text-center text-[12.5px] text-muted-foreground">
        {tx(lang, "in")} {inSecs} · {tx(lang, "out")} {outSecs}
      </p>
    </div>
  );
}
