/**
 * The InnerMate presence — re-skinned for The Lamplit Study as an abstract
 * LAMP-GLOW: a soft radial warmth over a faint wick line. No face, no body,
 * no mascot (per the approved direction's hard bans). The component name and
 * API are kept so every call site survives unchanged.
 *
 * States modulate the light, not a character:
 *   calm      — resting glow, slow breath (default)
 *   listening — the flame stands a little taller and brighter
 *   thinking  — the glow leans, gently unsettled
 *   steady    — full, still brightness; the lamp holding for you
 * Breathing respects reduced motion via the motion-safe gate.
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
  // Flame geometry per state — height, brightness, lean.
  const flame =
    state === "listening" ? { h: 30, coreOpacity: 1, lean: 0 }
    : state === "thinking" ? { h: 26, coreOpacity: 0.9, lean: -3.5 }
    : state === "steady" ? { h: 28, coreOpacity: 1, lean: 0 }
    : { h: 24, coreOpacity: 0.85, lean: 0 };

  // The steady lamp does not breathe — it holds still for you.
  const breathing = state === "steady" ? "" : "motion-safe:animate-[qs-breathe_7s_ease-in-out_infinite]";

  return (
    <span
      aria-hidden
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size * 0.82 }}
    >
      {glow && (
        <span
          className={`absolute inset-[-16%] rounded-full blur-xl ${breathing}`}
          style={{
            background:
              "radial-gradient(circle at 50% 58%, color-mix(in oklab, var(--lamp) 38%, transparent), color-mix(in oklab, var(--lamp) 10%, transparent) 55%, transparent 72%)",
          }}
        />
      )}
      <svg
        viewBox="0 0 96 78"
        width={size}
        height={size * 0.8125}
        className={`relative ${breathing}`}
      >
        <defs>
          <radialGradient id="lampCore" cx="50%" cy="62%" r="55%">
            <stop offset="0%" stopColor="oklch(0.93 0.07 85)" />
            <stop offset="45%" stopColor="oklch(0.80 0.11 72)" />
            <stop offset="100%" stopColor="oklch(0.63 0.105 65 / 0)" />
          </radialGradient>
          <radialGradient id="lampHalo" cx="50%" cy="58%" r="70%">
            <stop offset="0%" stopColor="oklch(0.76 0.115 72 / 0.5)" />
            <stop offset="100%" stopColor="oklch(0.76 0.115 72 / 0)" />
          </radialGradient>
        </defs>

        {/* halo */}
        <ellipse cx="48" cy="44" rx="34" ry="30" fill="url(#lampHalo)" />

        {/* the flame — a soft teardrop of light */}
        <g transform={`rotate(${flame.lean} 48 52)`}>
          <path
            d={`M48 ${52 - flame.h}
               C 55 ${52 - flame.h * 0.45}, 57 ${52 - flame.h * 0.16}, 48 56
               C 39 ${52 - flame.h * 0.16}, 41 ${52 - flame.h * 0.45}, 48 ${52 - flame.h} Z`}
            fill="url(#lampCore)"
            opacity={flame.coreOpacity}
          />
        </g>

        {/* the wick line — the etching's single stroke */}
        <line x1="48" y1="56" x2="48" y2="61" stroke="oklch(0.42 0.03 75)" strokeWidth="1.5" strokeLinecap="round" />
        {/* the lamp's lip — a faint brass hairline */}
        <path d="M39 62.5 q9 4 18 0" stroke="oklch(0.63 0.105 65 / 0.55)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>
    </span>
  );
}
