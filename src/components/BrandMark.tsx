/**
 * The InnerMate mark — a lamplit doorway.
 *
 * The whole app is one room behind one door ("Enter your quiet space"; the
 * brass CTA is literally the doorway lintel). The mark is that door: a
 * nightwall arch with a brass threshold, and inside it the heart — kept from
 * the original logo — burning as the lamp's flame, with a small pool of
 * rationed amber light around it. Pure SVG, no animation (a logo should be
 * still), colors hard-coded so the mark stays itself on any background.
 *
 * The same artwork lives in /favicon.svg and the PWA icons — change one,
 * regenerate the others (see docs in that file's header).
 */
export function BrandMark({ size = 26, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        {/* the lamplight pool — brightest at the flame, gone by the walls */}
        <radialGradient id="bm-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="oklch(0.82 0.11 78)" stopOpacity="0.55" />
          <stop offset="55%" stopColor="oklch(0.74 0.10 72)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="oklch(0.70 0.10 70)" stopOpacity="0" />
        </radialGradient>
        {/* brass, top-lit — same stops the old heart carried */}
        <linearGradient id="bm-flame" x1="0" y1="0" x2="24" y2="24">
          <stop offset="0%" stopColor="oklch(0.80 0.11 75)" />
          <stop offset="100%" stopColor="oklch(0.63 0.105 65)" />
        </linearGradient>
        {/* the door's depth — night at the floor, lifting toward the arch */}
        <linearGradient id="bm-night" x1="0" y1="48" x2="0" y2="6">
          <stop offset="0%" stopColor="oklch(0.19 0.028 268)" />
          <stop offset="100%" stopColor="oklch(0.26 0.035 272)" />
        </linearGradient>
      </defs>

      {/* the room behind the door */}
      <path
        d="M11 42 V20.5 C11 12.7 16.6 6.8 24 6.8 C31.4 6.8 37 12.7 37 20.5 V42 Z"
        fill="url(#bm-night)"
      />
      {/* lamplight, pooled low in the doorway — a lamp on a table, not a badge */}
      <circle cx="24" cy="27" r="12.5" fill="url(#bm-glow)" />

      {/* the heart, burning as the lamp's flame */}
      <g transform="translate(16.5 19) scale(0.63)">
        <path
          d="M12 20.5c-.4 0-.8-.15-1.1-.43C6.3 15.9 3.5 13.3 3.5 9.9 3.5 7.4 5.4 5.5 7.8 5.5c1.5 0 2.9.7 3.7 1.9l.5.7.5-.7c.8-1.2 2.2-1.9 3.7-1.9 2.4 0 4.3 1.9 4.3 4.4 0 3.4-2.8 6-7.4 10.17-.3.28-.7.43-1.1.43Z"
          fill="url(#bm-flame)"
        />
        {/* the glint — the wick catching */}
        <circle cx="9.1" cy="9.2" r="1.5" fill="oklch(0.93 0.055 85)" opacity="0.9" />
      </g>

      {/* the door frame — a hairline of brass */}
      <path
        d="M11 42 V20.5 C11 12.7 16.6 6.8 24 6.8 C31.4 6.8 37 12.7 37 20.5 V42"
        stroke="oklch(0.72 0.095 72)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* the threshold — a hair wider than the door, so you can step in */}
      <path
        d="M8 42 H40"
        stroke="oklch(0.72 0.095 72)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.65"
      />
    </svg>
  );
}
