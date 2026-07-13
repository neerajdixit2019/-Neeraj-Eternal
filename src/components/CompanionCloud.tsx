/**
 * The InnerMate companion — a soft cloud presence from the reference
 * illustration universe. Deliberately restrained: serene closed eyes, the
 * gentlest mouth, no big grin (the references' childish smiles were flagged
 * in the audit; this is the matured version).
 *
 * States map to what the moment needs:
 *   calm      — resting, eyes closed, soft breath (default)
 *   listening — eyes open, attentive
 *   thinking  — eyes closed, slight tilt
 *   steady    — protective, level gaze (no-impulse / safety adjacent)
 * Pure SVG, no assets; breathing uses the shared motion rules and respects
 * reduced motion via .motion-calm ancestors and the media query.
 */

type CloudState = "calm" | "listening" | "thinking" | "steady";

export function CompanionCloud({
  state = "calm",
  size = 96,
  glow = true,
  className = "",
}: {
  state?: CloudState;
  size?: number;
  glow?: boolean;
  className?: string;
}) {
  const eyes =
    state === "listening" || state === "steady" ? (
      <>
        <circle cx="38" cy="46" r="2.4" fill="oklch(0.22 0.04 285)" />
        <circle cx="58" cy="46" r="2.4" fill="oklch(0.22 0.04 285)" />
        <circle cx="38.8" cy="45.2" r="0.7" fill="oklch(0.95 0.01 290)" />
        <circle cx="58.8" cy="45.2" r="0.7" fill="oklch(0.95 0.01 290)" />
      </>
    ) : (
      <>
        {/* closed, serene */}
        <path d="M34.5 46 q3.5 2.8 7 0" stroke="oklch(0.22 0.04 285)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <path d="M54.5 46 q3.5 2.8 7 0" stroke="oklch(0.22 0.04 285)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      </>
    );

  const mouth =
    state === "steady" ? (
      <path d="M45 55.5 h6" stroke="oklch(0.30 0.05 290)" strokeWidth="1.6" strokeLinecap="round" />
    ) : (
      <path d="M44.5 55 q3.5 2.4 7 0" stroke="oklch(0.30 0.05 290)" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    );

  return (
    <span
      aria-hidden
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size * 0.82 }}
    >
      {glow && (
        <span
          className="absolute inset-[-18%] rounded-full blur-xl"
          style={{ background: "radial-gradient(circle at 50% 55%, color-mix(in oklab, var(--violet) 34%, transparent), transparent 70%)" }}
        />
      )}
      <svg
        viewBox="0 0 96 78"
        width={size}
        height={size * 0.8125}
        className="relative motion-safe:animate-[qs-breathe_7s_ease-in-out_infinite]"
        style={state === "thinking" ? { transform: "rotate(-3deg)" } : undefined}
      >
        <defs>
          <radialGradient id="cc-body" cx="42%" cy="30%" r="85%">
            <stop offset="0%" stopColor="oklch(0.72 0.09 292)" />
            <stop offset="55%" stopColor="oklch(0.58 0.11 290)" />
            <stop offset="100%" stopColor="oklch(0.44 0.10 286)" />
          </radialGradient>
        </defs>
        {/* cloud body: one soft mass, three lobes */}
        <path
          d="M22 62
             C 10 62, 6 50, 14 43
             C 10 32, 22 24, 31 28
             C 34 16, 52 13, 59 23
             C 70 18, 84 26, 82 38
             C 92 42, 92 56, 80 60
             C 76 66, 66 68, 60 64
             C 52 70, 36 70, 30 64
             C 27 65, 24 64, 22 62 Z"
          fill="url(#cc-body)"
        />
        {/* soft cheeks, barely there */}
        <ellipse cx="31" cy="52" rx="4" ry="2.4" fill="oklch(0.72 0.10 20 / 0.28)" />
        <ellipse cx="65" cy="52" rx="4" ry="2.4" fill="oklch(0.72 0.10 20 / 0.28)" />
        {eyes}
        {mouth}
      </svg>
    </span>
  );
}
