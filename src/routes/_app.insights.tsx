import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { listMoods, listJournal } from "@/lib/data.functions";
import { TactileCard } from "@/components/TactileCard";
import { WeekArc, moodsToWeekArc } from "@/components/WeekArc";

export const Route = createFileRoute("/_app/insights")({
  component: Insights,
  head: () => ({
    meta: [
      { title: "Insights | My Quiet Space" },
      { name: "description", content: "A calm, non-clinical mirror of your mood check-ins over time." },
      { property: "og:title", content: "Insights" },
      { property: "og:description", content: "A calm, non-clinical mirror of your mood over time." },
      { property: "og:url", content: "https://neeraj2019.lovable.app/insights" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://neeraj2019.lovable.app/insights" }],
  }),
});

type Mood = {
  created_at: string;
  mood_score: number;
  emotion_tags?: string[] | null;
  trigger_tags?: string[] | null;
};

function Insights() {
  const m = useServerFn(listMoods);
  const j = useServerFn(listJournal);
  const { data: moodsRaw } = useQuery({ queryKey: ["moods"], queryFn: () => m() });
  const { data: journal } = useQuery({ queryKey: ["journal"], queryFn: () => j() });
  const moods = (moodsRaw ?? []) as Mood[];

  const stats = useMemo(() => computeStats(moods), [moods]);
  const weekStart = mondayISO(new Date());
  const arc = moodsToWeekArc(moods.map(x => ({ created_at: x.created_at, mood_score: x.mood_score })), weekStart);
  const arcAvg = arc.filter((v): v is number => v != null);
  const arcMean = arcAvg.length ? (arcAvg.reduce((a, b) => a + b, 0) / arcAvg.length).toFixed(1) : "—";

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">A soft mirror</p>
      <h1 className="mt-3 font-serif text-3xl sm:text-[2.4rem] leading-tight">Quietly noticed.</h1>
      <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
        Not a report card. Just gentle shapes of what you've been carrying.
      </p>

      {/* This week arc */}
      <TactileCard className="mt-8">
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">How this week has moved</p>
          <p className="font-serif text-sm text-muted-foreground">avg <span className="text-foreground">{arcMean}</span></p>
        </div>
        <div className="mt-4 text-foreground/80">
          <WeekArc days={arc} />
        </div>
        <p className="mt-2 text-[12px] italic text-muted-foreground">A wavy week is a real week.</p>
      </TactileCard>

      {/* 30-day soft trend */}
      <TactileCard className="mt-4">
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">The last 30 days</p>
          <p className="font-serif text-sm text-muted-foreground">{stats.thirtyCount} check-ins</p>
        </div>
        <div className="mt-4">
          <MoodTrend days={stats.thirty} />
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>heavier</span>
          <span>lighter</span>
        </div>
      </TactileCard>

      {/* Stats row */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Streak" value={stats.streak === 0 ? "—" : `${stats.streak} day${stats.streak === 1 ? "" : "s"}`} hint="days in a row you paused" />
        <Stat label="Kindest day" value={stats.bestDay ?? "—"} hint="on average" />
        <Stat label="Journal entries" value={String(journal?.length ?? 0)} hint="in your archive" />
      </div>

      {/* Time of day */}
      <TactileCard className="mt-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">When you check in</p>
        <div className="mt-4 grid grid-cols-4 gap-3">
          {stats.timeOfDay.map((t) => (
            <TimeOfDayBar key={t.label} label={t.label} count={t.count} max={stats.timeOfDayMax} />
          ))}
        </div>
      </TactileCard>

      {/* Emotions + triggers */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TactileCard>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Most felt</p>
          <TagWeights items={stats.topEmotions} tint="mint" />
        </TactileCard>
        <TactileCard>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Most triggered by</p>
          <TagWeights items={stats.topTriggers} tint="rose" />
        </TactileCard>
      </div>

      {stats.topTriggers[0] && (
        <TactileCard tint="lavender" className="mt-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">A gentle noticing</p>
          <p className="mt-2 font-serif text-lg leading-snug">
            <strong>{stats.topTriggers[0].label}</strong> kept showing up.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            That doesn't mean anything is wrong — just that it's asking for attention. A wind-down or an evening check-in might soften it.
          </p>
        </TactileCard>
      )}

      <p className="mt-12 text-center text-[13px] italic text-muted-foreground">
        A quiet week and a loud week both count.
      </p>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <TactileCard>
      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-serif text-3xl leading-none">{value}</p>
      {hint && <p className="mt-2 text-[12px] text-muted-foreground">{hint}</p>}
    </TactileCard>
  );
}

function TagWeights({ items, tint }: { items: { label: string; count: number }[]; tint: "mint" | "rose" }) {
  if (!items.length) {
    return <p className="mt-3 text-sm italic text-muted-foreground">Nothing to measure yet. That's allowed.</p>;
  }
  const max = items[0].count;
  const color = tint === "mint" ? "var(--mint)" : "var(--rose)";
  return (
    <ul className="mt-3 space-y-2.5">
      {items.map((it) => (
        <li key={it.label}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-foreground/85">{it.label}</span>
            <span className="text-[11px] text-muted-foreground">{it.count}</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-foreground/5">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(it.count / max) * 100}%`, background: color, opacity: 0.55 }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function TimeOfDayBar({ label, count, max }: { label: string; count: number; max: number }) {
  const h = max ? Math.max(6, Math.round((count / max) * 64)) : 6;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex h-16 items-end">
        <div
          className="w-6 rounded-t-md bg-foreground/25"
          style={{ height: `${h}px`, transition: "height 400ms ease" }}
          aria-hidden
        />
      </div>
      <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
      <p className="text-[11px] text-foreground/60">{count}</p>
    </div>
  );
}

function MoodTrend({ days }: { days: (number | null)[] }) {
  const w = 640;
  const h = 120;
  const pad = 8;
  const n = days.length;
  const step = (w - pad * 2) / Math.max(1, n - 1);
  const yFor = (v: number) => h - pad - ((Math.max(1, Math.min(10, v)) - 1) / 9) * (h - pad * 2);

  // Build smoothed path over non-null values, interpolating gaps.
  const filled = fillGaps(days);
  const points = filled.map((v, i) => ({ x: pad + step * i, y: yFor(v ?? 5.5) }));
  const path = points.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = points[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `${acc} Q ${cx} ${prev.y}, ${cx} ${(prev.y + p.y) / 2} T ${p.x} ${p.y}`;
  }, "");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" preserveAspectRatio="none" role="img" aria-label="Mood over the last 30 days">
      <defs>
        <linearGradient id="moodFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--mint)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--mint)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L ${pad + step * (n - 1)} ${h - pad} L ${pad} ${h - pad} Z`} fill="url(#moodFill)" />
      <path d={path} fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" strokeLinecap="round" />
      {days.map((v, i) =>
        v == null ? null : (
          <circle key={i} cx={pad + step * i} cy={yFor(v)} r={2.2} fill="currentColor" opacity="0.55" />
        ),
      )}
    </svg>
  );
}

function fillGaps(days: (number | null)[]): (number | null)[] {
  const out = [...days];
  // linear interpolation between known points; leave leading/trailing nulls as neutral
  let lastKnown = -1;
  for (let i = 0; i < out.length; i++) {
    if (out[i] != null) {
      if (lastKnown >= 0 && i - lastKnown > 1) {
        const a = out[lastKnown]!;
        const b = out[i]!;
        const gap = i - lastKnown;
        for (let k = 1; k < gap; k++) out[lastKnown + k] = a + ((b - a) * k) / gap;
      }
      lastKnown = i;
    }
  }
  return out;
}

function mondayISO(d: Date): string {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // 0 = Mon
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

function computeStats(moods: Mood[]) {
  const now = new Date();
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);

  // 30-day buckets (oldest -> newest)
  const thirty: (number | null)[] = Array.from({ length: 30 }, () => null);
  const dayBuckets: number[][] = Array.from({ length: 30 }, () => []);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 29);

  // Weekday averages (0=Sun..6=Sat)
  const weekdayBuckets: number[][] = Array.from({ length: 7 }, () => []);
  const tod = { Morning: 0, Midday: 0, Evening: 0, Night: 0 };
  const emo = new Map<string, number>();
  const trig = new Map<string, number>();
  let thirtyCount = 0;

  for (const m of moods) {
    const d = new Date(m.created_at);
    const diff = Math.floor((d.getTime() - start.getTime()) / 86400000);
    if (diff >= 0 && diff < 30) {
      dayBuckets[diff].push(m.mood_score);
      thirtyCount += 1;
    }
    weekdayBuckets[d.getDay()].push(m.mood_score);
    const h = d.getHours();
    if (h < 6) tod.Night += 1;
    else if (h < 12) tod.Morning += 1;
    else if (h < 18) tod.Midday += 1;
    else tod.Evening += 1;
    m.emotion_tags?.forEach((t) => emo.set(t, (emo.get(t) ?? 0) + 1));
    m.trigger_tags?.forEach((t) => trig.set(t, (trig.get(t) ?? 0) + 1));
  }
  for (let i = 0; i < 30; i++) {
    const b = dayBuckets[i];
    thirty[i] = b.length ? b.reduce((a, n) => a + n, 0) / b.length : null;
  }

  // Streak: consecutive days ending today with a check-in
  const daySet = new Set(moods.map((m) => dayKey(new Date(m.created_at))));
  let streak = 0;
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  while (daySet.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Kindest weekday
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let bestDay: string | null = null;
  let bestAvg = -Infinity;
  weekdayBuckets.forEach((b, i) => {
    if (b.length >= 2) {
      const a = b.reduce((s, n) => s + n, 0) / b.length;
      if (a > bestAvg) { bestAvg = a; bestDay = names[i]; }
    }
  });

  const top = (map: Map<string, number>) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, count]) => ({ label, count }));

  const timeOfDay = (Object.entries(tod) as [keyof typeof tod, number][]).map(([label, count]) => ({ label, count }));
  const timeOfDayMax = Math.max(1, ...timeOfDay.map((t) => t.count));

  return {
    thirty,
    thirtyCount,
    streak,
    bestDay,
    topEmotions: top(emo),
    topTriggers: top(trig),
    timeOfDay,
    timeOfDayMax,
  };
}