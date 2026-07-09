import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { ArrowRight, Feather, Hand, MoonStar, Sparkles, type LucideIcon } from "lucide-react";
import { listMoods, listJournal } from "@/lib/data.functions";
import { TactileCard } from "@/components/TactileCard";
import { WeekArc, moodsToWeekArc } from "@/components/WeekArc";
import { CheckinRitual } from "@/components/CheckinRitual";

export const Route = createFileRoute("/_app/insights")({
  component: Insights,
  head: () => ({
    meta: [
      { title: "Check-in & Insights | My Quiet Space" },
      { name: "description", content: "Name what you're feeling in under a minute, then watch your patterns take shape. Private to you." },
      { property: "og:title", content: "Check-in & Insights" },
      { property: "og:description", content: "Check in gently, then see a calm, non-clinical mirror of your mood over time." },
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

type JournalRow = { title?: string | null };

/* ── Deterministic sky helpers — identical on server and client ── */

const SKY_SEED = 947213;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const ACCENTS = ["var(--rose)", "var(--sky)", "var(--mint)", "var(--lavender)", "var(--amber)", "var(--sand)"];

const TAG_TINTS: Record<string, string> = {
  Heavy: "var(--lavender)",
  Anxious: "var(--rose)",
  Lonely: "var(--sky)",
  Numb: "var(--sand)",
  Confused: "var(--lavender)",
  Calm: "var(--mint)",
  Hopeful: "var(--dawn)",
  Grateful: "var(--amber)",
  Angry: "var(--rose)",
  Overwhelmed: "var(--sky)",
};

function tagTint(label: string): string {
  return TAG_TINTS[label] ?? ACCENTS[hashStr(label) % ACCENTS.length];
}

type Star = { label: string; count: number; x: number; y: number; weight: number; color: string };

function constellationStars(tags: { label: string; count: number }[]): Star[] {
  const max = tags[0]?.count ?? 1;
  const stars: Star[] = tags.map((t) => ({
    label: t.label,
    count: t.count,
    x: 10 + ((hashStr(t.label) % 1000) / 999) * 80,
    y: 12 + ((hashStr(`${t.label}·y`) % 1000) / 999) * 60,
    weight: t.count / max,
    color: tagTint(t.label),
  }));
  // Gentle deterministic de-overlap so labels never sit on each other.
  for (let i = 1; i < stars.length; i++) {
    for (let k = 0; k < i; k++) {
      if (Math.abs(stars[i].x - stars[k].x) < 16 && Math.abs(stars[i].y - stars[k].y) < 12) {
        stars[i].y = stars[i].y > 42 ? stars[i].y - 16 : stars[i].y + 16;
        stars[i].y = Math.min(72, Math.max(12, stars[i].y));
      }
    }
  }
  return stars.slice().sort((a, b) => a.x - b.x);
}

/* ── Gentle heuristics — computed from data already on the page ── */

// to: null means the check-in at the top of this page — rendered as a scroll, not a link
type NextStep = { title: string; body: string; cta: string; to: "/wind-down" | "/urge-shield" | null; icon: LucideIcon };

function pickNextStep(stats: {
  topTriggers: { label: string; count: number }[];
  timeOfDay: { label: string; count: number }[];
}): NextStep {
  const topTrigger = stats.topTriggers[0]?.label;
  const heaviest = stats.timeOfDay.reduce((a, b) => (b.count > a.count ? b : a), stats.timeOfDay[0]);
  const eveningsHeaviest = !!heaviest && heaviest.count > 0 && (heaviest.label === "Evening" || heaviest.label === "Night");
  if (topTrigger === "Sleep" || eveningsHeaviest) {
    return {
      title: "A night reset",
      body: "The late hours keep appearing in your sky. Three slow breaths and one line set down before bed can soften their edges.",
      cta: "Begin a night reset",
      to: "/wind-down",
      icon: MoonStar,
    };
  }
  if (topTrigger === "Work") {
    return {
      title: "A pause before action",
      body: "Work has been a bright signal lately. When the next wave rises, try meeting it with a small pause instead of a reply.",
      cta: "Practice the pause",
      to: "/urge-shield",
      icon: Hand,
    };
  }
  return {
    title: "A two-minute check-in",
    body: "The simplest way to add a star to this sky — pause, name the feeling, let it be seen. It's waiting at the top of this page.",
    cta: "Check in gently",
    to: null,
    icon: Feather,
  };
}

const DEEPER_QUESTIONS: Record<string, string> = {
  Anxious: "What would you do this week if you trusted yourself a little more?",
  Heavy: "What are you carrying that was never yours to hold?",
  Overwhelmed: "If you could set one thing down for seven days, what would it be?",
  Lonely: "Who could you let one sentence closer this week?",
  Numb: "When did you last feel something small and real — and what were you doing?",
  Confused: "If the fog lifted for an hour, what would you look at first?",
  Angry: "What is the anger standing guard over?",
  Calm: "What is quietly going right that deserves a longer look?",
  Hopeful: "What small thing would you begin if this feeling stayed a while?",
  Grateful: "Who doesn't know yet how much they steadied you?",
};

function pickQuestion(theme?: string): string {
  return (theme && DEEPER_QUESTIONS[theme]) || "What would this week feel like if you were on your own side?";
}

/* ── Screen ── */

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

  const windDownCount = useMemo(
    () => ((journal ?? []) as JournalRow[]).filter((e) => e.title === "Wind-down").length,
    [journal],
  );
  const pageCount = Math.max(0, (journal?.length ?? 0) - windDownCount);

  const stars = useMemo(() => constellationStars(stats.topEmotions), [stats.topEmotions]);
  const nextStep = pickNextStep(stats);
  const StepIcon = nextStep.icon;
  const question = pickQuestion(stats.topEmotions[0]?.label);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      {/* The check-in ritual — merged in from the old /checkin page */}
      <p className="qs-section-label">a moment to check in</p>
      <h1 className="mt-3 font-serif text-[28px] font-light leading-tight tracking-tight sm:text-[2.3rem]">
        How does today feel?
      </h1>
      <p className="mt-3 max-w-md text-[14.5px] leading-relaxed text-muted-foreground">
        Under a minute. Nothing here is a wrong answer — and every save adds a star to the sky below.
      </p>
      <div className="mt-8">
        <CheckinRitual />
      </div>

      {/* Patterns, built from the check-ins above */}
      <div className="mt-14 border-t border-border/40 pt-10">
        <p className="qs-section-label">your pattern constellation</p>
        <h2 className="mt-3 font-serif text-[24px] font-light leading-tight tracking-tight sm:text-[1.9rem]">
          Patterns, becoming visible.
        </h2>
        <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
          Not a report card. A sky slowly taking shape.
        </p>
      </div>

      {/* The constellation */}
      <ConstellationSky stars={stars} />

      {/* themes + signals */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TactileCard tint="mint">
          <p className="qs-section-label">themes</p>
          <p className="mt-2 font-serif text-lg leading-snug">What kept rising</p>
          <TagWeights items={stats.topEmotions} empty="no feelings named yet — the sky can wait." />
        </TactileCard>
        <TactileCard tint="rose">
          <p className="qs-section-label">signals</p>
          <p className="mt-2 font-serif text-lg leading-snug">What tended to stir it</p>
          <TagWeights items={stats.topTriggers} empty="no signals yet. they surface when they're ready." />
          {stats.topTriggers[0] && (
            <p className="mt-4 border-t border-border/40 pt-3 text-[13px] leading-relaxed text-muted-foreground">
              <strong className="font-medium text-foreground/85">{stats.topTriggers[0].label}</strong> kept flickering at
              the edge of your sky. Nothing is wrong — it's just asking to be noticed.
            </p>
          )}
        </TactileCard>
      </div>

      {/* the week's shape */}
      <TactileCard className="mt-4">
        <div className="flex items-baseline justify-between">
          <p className="qs-section-label">the week's shape</p>
          <p className="font-serif text-sm text-muted-foreground">resting near <span className="text-foreground">{arcMean}</span></p>
        </div>
        <div className="mt-4 text-foreground/80">
          <WeekArc days={arc} />
        </div>
        <p className="mt-2 text-[12px] italic text-muted-foreground">a wavy week is a real week.</p>

        <div className="mt-6 flex items-baseline justify-between border-t border-border/40 pt-5">
          <p className="qs-section-label">the last thirty nights</p>
          <p className="font-serif text-sm text-muted-foreground">{stats.thirtyCount} moments noticed</p>
        </div>
        <div className="mt-4">
          <MoodTrend days={stats.thirty} />
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>heavier</span>
          <span>lighter</span>
        </div>
      </TactileCard>

      {/* rhythms */}
      <TactileCard className="mt-4">
        <p className="qs-section-label">rhythms</p>
        <p className="mt-2 font-serif text-lg leading-snug">When the heavy hours come</p>
        <p className="mt-1 text-[13px] text-muted-foreground">the times of day you most often pause here</p>
        <div className="mt-5 grid grid-cols-4 gap-3">
          {stats.timeOfDay.map((t) => (
            <TimeOfDayBar key={t.label} label={t.label} count={t.count} max={stats.timeOfDayMax} />
          ))}
        </div>
      </TactileCard>

      {/* anchors */}
      <TactileCard tint="amber" className="mt-4">
        <p className="qs-section-label">anchors</p>
        <p className="mt-2 font-serif text-lg leading-snug">What steadied you</p>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Anchor value={pageCount} label="pages in your vault" />
          <Anchor value={windDownCount} label="nights set down gently" />
          <Anchor value={stats.bestDay ?? "—"} label="your kindest day" />
        </div>
        <p className="mt-5 border-t border-border/40 pt-4 font-serif text-[14px] italic leading-relaxed text-foreground/75">
          {stats.streak > 0
            ? `${stats.streak} ${stats.streak === 1 ? "day" : "days in a row"} you showed up for yourself. not a score — just something quietly true.`
            : "whenever you return, the sky will be here."}
        </p>
      </TactileCard>

      {/* one gentle next step + one deeper question */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TactileCard tint="sky">
          <p className="qs-section-label">one gentle next step</p>
          <div className="mt-3 flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background/60">
              <StepIcon className="h-4 w-4" strokeWidth={1.7} />
            </span>
            <div className="min-w-0">
              <p className="font-serif text-lg leading-snug">{nextStep.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{nextStep.body}</p>
            </div>
          </div>
          {nextStep.to ? (
            <Link
              to={nextStep.to}
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-foreground/80 transition-colors hover:text-foreground"
            >
              {nextStep.cta} <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.7} />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-foreground/80 transition-colors hover:text-foreground"
            >
              {nextStep.cta} <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.7} />
            </button>
          )}
        </TactileCard>
        <TactileCard tint="lavender">
          <p className="qs-section-label">one deeper question</p>
          <p className="mt-4 font-serif text-lg italic leading-relaxed text-foreground/90">{question}</p>
          <p className="mt-3 text-[12px] text-muted-foreground">no need to answer today. let it orbit for a while.</p>
        </TactileCard>
      </div>

      {/* CTA — the moon cycle */}
      <div className="mt-10 flex flex-col items-center">
        <Link to="/home" className="qs-pill-cta">
          <Sparkles className="h-4 w-4" strokeWidth={1.7} />
          Open your letter from the moon cycle
        </Link>
        <p className="mt-3 text-center text-[12px] text-muted-foreground">
          your letter from the week waits on Home.
        </p>
      </div>

      <p className="mt-12 text-center font-serif text-[13px] italic text-muted-foreground">
        a quiet week and a loud week both count.
      </p>
    </div>
  );
}

/* ── The constellation panel ── */

function ConstellationSky({ stars }: { stars: Star[] }) {
  // Fixed seed — the background sky renders identically on server and client.
  const bgStars = useMemo(() => {
    const rand = mulberry32(SKY_SEED);
    return Array.from({ length: 40 }, () => ({
      x: 2 + rand() * 96,
      y: 4 + rand() * 88,
      r: 1 + rand() * 1.6,
      o: 0.12 + rand() * 0.38,
      d: rand() * 6,
    }));
  }, []);

  return (
    <div
      className="sky-panel mt-8 h-[300px]"
      role="img"
      aria-label={
        stars.length
          ? `Your constellation — the feelings you named most: ${stars.map((s) => s.label).join(", ")}`
          : "An empty night sky, waiting for your first check-ins"
      }
    >
      {/* aurora band */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[-12%] top-[6%] h-28 rounded-[100%] opacity-50 blur-2xl motion-safe:animate-[qs-aurora_18s_ease-in-out_infinite_alternate]"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, color-mix(in oklab, var(--mint) 24%, transparent) 32%, color-mix(in oklab, var(--sky) 20%, transparent) 58%, color-mix(in oklab, var(--lavender) 16%, transparent) 78%, transparent 100%)",
        }}
      />

      {/* dim background stars */}
      {bgStars.map((s, i) => (
        <span
          key={i}
          aria-hidden
          className={
            "absolute rounded-full" +
            (i % 4 === 0 ? " motion-safe:animate-[qs-twinkle_5.5s_ease-in-out_infinite]" : "")
          }
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.r,
            height: s.r,
            background: "oklch(0.95 0.01 90)",
            opacity: s.o,
            animationDelay: `${s.d.toFixed(2)}s`,
          }}
        />
      ))}

      {/* faint threads between the named stars */}
      {stars.length > 1 && (
        <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {stars.slice(1).map((s, i) => (
            <line
              key={s.label}
              x1={stars[i].x}
              y1={stars[i].y}
              x2={s.x}
              y2={s.y}
              stroke="oklch(1 0 0 / 0.25)"
              strokeWidth="1"
              strokeDasharray="4 6"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      )}

      {/* the named stars */}
      {stars.map((s, i) => (
        <div
          key={s.label}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${s.x}%`, top: `${s.y}%` }}
        >
          <span
            className="mx-auto block rounded-full motion-safe:animate-[qs-twinkle_4.5s_ease-in-out_infinite]"
            style={{
              width: 6 + Math.round(s.weight * 8),
              height: 6 + Math.round(s.weight * 8),
              background: s.color,
              opacity: 0.55 + s.weight * 0.45,
              boxShadow: `0 0 ${8 + Math.round(s.weight * 14)}px ${2 + Math.round(s.weight * 4)}px color-mix(in oklab, ${s.color} 55%, transparent)`,
              animationDelay: `${(i * 0.9).toFixed(1)}s`,
            }}
          />
          <span
            className="mt-1.5 block whitespace-nowrap text-center font-serif text-[10.5px] italic"
            style={{ color: `color-mix(in oklab, ${s.color} 45%, var(--foreground))` }}
          >
            {s.label.toLowerCase()}
          </span>
        </div>
      ))}

      {/* two fireflies, resting under reduced motion */}
      <span aria-hidden className="qs-firefly hidden motion-safe:inline-block" style={{ left: "18%", top: "64%" }} />
      <span
        aria-hidden
        className="qs-firefly hidden motion-safe:inline-block"
        style={{ left: "82%", top: "30%", animationDelay: "4s" }}
      />

      {stars.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center px-10">
          <p className="text-center font-serif text-[15px] italic leading-relaxed text-foreground/60">
            check in for a few days and your sky will begin to take shape
          </p>
        </div>
      ) : (
        <p className="absolute inset-x-0 bottom-4 text-center font-serif text-[11px] italic text-foreground/45">
          each star is a feeling you named
        </p>
      )}
    </div>
  );
}

/* ── Small pieces ── */

function Anchor({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-2xl bg-background/40 px-3 py-4 text-center">
      <p className="font-serif text-2xl leading-none">{String(value)}</p>
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{label}</p>
    </div>
  );
}

function TagWeights({ items, empty }: { items: { label: string; count: number }[]; empty: string }) {
  if (!items.length) {
    return <p className="mt-4 text-sm italic text-muted-foreground">{empty}</p>;
  }
  const max = items[0].count;
  return (
    <ul className="mt-4 space-y-2.5">
      {items.map((it) => (
        <li key={it.label}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-foreground/85">{it.label}</span>
            <span className="text-[11px] text-muted-foreground">{it.count}</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-foreground/5">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(it.count / max) * 100}%`, background: tagTint(it.label), opacity: 0.55 }}
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
