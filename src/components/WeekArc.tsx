import { useId } from "react";

// One dot per day: Mon..Sun. Pass average mood score per day (1..10) or null when missing.
export function WeekArc({
  days,
  height = 56,
  className,
  label = "How the week moved",
}: {
  days: (number | null)[]; // length 7, Mon..Sun
  height?: number;
  className?: string;
  label?: string;
}) {
  const id = useId();
  const w = 280;
  const h = height;
  const pad = 16;
  const step = (w - pad * 2) / 6;
  const yFor = (v: number | null) => {
    if (v == null) return h / 2;
    // higher score → higher on screen (smaller y)
    const t = Math.max(1, Math.min(10, v));
    return h - pad / 2 - ((t - 1) / 9) * (h - pad);
  };
  const points = days.map((d, i) => ({ x: pad + step * i, y: yFor(d), v: d }));
  const path = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `Q ${points[i - 1].x + step / 2} ${(points[i - 1].y + p.y) / 2}, ${p.x} ${p.y}`))
    .join(" ");
  const tints = (v: number | null) => {
    if (v == null) return "transparent";
    if (v <= 3) return "var(--rose)";
    if (v <= 6) return "var(--lavender)";
    return "var(--mint)";
  };
  const labels = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <figure className={className} aria-label={label}>
      <svg
        viewBox={`0 0 ${w} ${h + 18}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-labelledby={`${id}-title`}
      >
        <title id={`${id}-title`}>{label}</title>
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={p.v == null ? 4 : 5.5}
              fill={p.v == null ? "transparent" : tints(p.v)}
              stroke="currentColor"
              strokeOpacity={p.v == null ? 0.35 : 0}
              strokeWidth={1}
            />
            <text
              x={p.x}
              y={h + 14}
              textAnchor="middle"
              fontSize="9"
              letterSpacing="0.14em"
              fill="currentColor"
              opacity="0.55"
            >
              {labels[i]}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}

// Helper: bucket mood_logs (with created_at + mood_score) into Mon..Sun averages
// for the week starting at the given Monday (local time).
export function moodsToWeekArc(
  moods: { created_at: string; mood_score: number | null }[],
  weekStartISO: string,
): (number | null)[] {
  const start = new Date(weekStartISO + "T00:00:00");
  const buckets: number[][] = [[], [], [], [], [], [], []];
  for (const m of moods) {
    const d = new Date(m.created_at);
    const diff = Math.floor((d.getTime() - start.getTime()) / 86400000);
    if (diff >= 0 && diff < 7 && typeof m.mood_score === "number") {
      buckets[diff].push(m.mood_score);
    }
  }
  return buckets.map((b) => (b.length ? b.reduce((s, n) => s + n, 0) / b.length : null));
}