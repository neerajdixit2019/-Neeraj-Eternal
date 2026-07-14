import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, Feather, Hand, MoonStar, Sparkles, MessageCircle, X,
  type LucideIcon,
} from "lucide-react";
import { listMoods, listJournal, listHiddenPatterns, unhidePattern, hidePattern } from "@/lib/data.functions";
import { listInsightEvents, keepIntention, getIntentionState, recordIntentionOutcome } from "@/lib/insights.functions";
import {
  sourceMixFor, describeMix, sourceCount, isInferredOnly, toMoodEntries, changeSignals,
  skyReading, SOURCE_LABEL,
  type InsightEvent,
} from "@/lib/insight-events";
import { getProfile } from "@/lib/data.functions";
import { toast } from "sonner";
import { TactileCard } from "@/components/TactileCard";
import { CheckinRitual } from "@/components/CheckinRitual";
import { CompanionCloud } from "@/components/CompanionCloud";
import {
  filterByPeriod, buildConstellation, statusFor, timeOfDayFor, peakTod,
  momentsFor, timelinePoints, timelineSummary, innermateContext, tagStats,
  cooccurrence, coBetween, weekdayRhythm, PERIOD_LABEL, PERIOD_DAYS, TOD_LABELS,
  type Period, type MoodEntry, type Constellation, type MapNode,
} from "@/lib/pattern-map";

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

type Mood = MoodEntry & { mood_score: number };
type JournalRow = { title?: string | null; created_at?: string | null };

/* ── Tints: emotions keep their constellation colours; triggers sit in the warm family ── */

const ACCENTS = ["var(--rose)", "var(--sky)", "var(--mint)", "var(--lavender)", "var(--amber)", "var(--sand)"];
const TAG_TINTS: Record<string, string> = {
  Heavy: "var(--lavender)", Anxious: "var(--rose)", Lonely: "var(--sky)",
  Numb: "var(--sand)", Confused: "var(--lavender)", Calm: "var(--mint)",
  Hopeful: "var(--dawn)", Grateful: "var(--amber)", Angry: "var(--rose)",
  Overwhelmed: "var(--sky)",
  Work: "var(--amber)", Relationship: "var(--rose)", Family: "var(--amber)",
  Health: "var(--mint)", Money: "var(--sand)", Memories: "var(--lavender)",
  Sleep: "var(--sky)", Future: "var(--lavender)",
};
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function tagTint(label: string): string {
  return TAG_TINTS[label] ?? ACCENTS[hashStr(label) % ACCENTS.length];
}
const WEIGHT_WORD = (score: number) =>
  score <= 3 ? "heavy" : score <= 5 ? "cloudy" : score <= 7 ? "settled" : score <= 9 ? "open" : "bright";

/* ── Screen ── */

function Insights() {
  const m = useServerFn(listMoods);
  const j = useServerFn(listJournal);
  const hiddenFn = useServerFn(listHiddenPatterns);
  const navigate = useNavigate();
  const eventsFn = useServerFn(listInsightEvents);
  const { data: moodsRaw, isLoading } = useQuery({ queryKey: ["moods"], queryFn: () => m() });
  const { data: journal } = useQuery({ queryKey: ["journal"], queryFn: () => j() });
  const { data: hiddenRaw } = useQuery({ queryKey: ["hiddenPatterns"], queryFn: () => hiddenFn() });
  const { data: eventsRaw } = useQuery({ queryKey: ["insightEvents"], queryFn: () => eventsFn() });
  const moods = (moodsRaw ?? []) as Mood[];
  const hidden = (hiddenRaw ?? []) as string[];
  const events = (eventsRaw ?? []) as InsightEvent[];

  const [view, setView] = useState<"constellation" | "timeline">("constellation");
  const [period, setPeriod] = useState<Period>("month");
  const [selected, setSelected] = useState<string | null>(null);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [timelineTag, setTimelineTag] = useState<string | null>(null);

  const periodMoods = useMemo(() => filterByPeriod(moods, period) as Mood[], [moods, period]);
  // The unified engine: every consented source becomes events; the events
  // (not just check-ins) feed the constellation. Falls back to check-ins
  // alone until the event feed arrives, so the page never blanks.
  const periodEvents = useMemo(() => {
    const days = PERIOD_DAYS[period];
    if (days == null) return events;
    const cutoff = Date.now() - days * 86400000;
    return events.filter((e) => new Date(e.created_at).getTime() >= cutoff);
  }, [events, period]);
  const engineEntries = useMemo(
    () => (periodEvents.length > 0 ? toMoodEntries(periodEvents) : (periodMoods as Mood[])),
    [periodEvents, periodMoods],
  );
  const constellation = useMemo(
    () => buildConstellation(engineEntries, { hidden }),
    [engineEntries, hidden],
  );
  const co = useMemo(() => cooccurrence(engineEntries), [engineEntries]);
  const stats = useMemo(() => tagStats(engineEntries), [engineEntries]);
  const hiddenSet = useMemo(() => new Set(hidden.map((h) => h.toLowerCase())), [hidden]);
  const visibleStats = useMemo(() => stats.filter((s) => !hiddenSet.has(s.label.toLowerCase())), [stats, hiddenSet]);
  const topSignals = useMemo(() => visibleStats.filter((s) => s.kind === "trigger").slice(0, 4), [visibleStats]);

  // Today's saved check-in (compact card once done)
  const todayKey = new Date().toDateString();
  const todayMood = moods.find((x) => new Date(x.created_at).toDateString() === todayKey);

  const talkToInnerMate = (text: string) => {
    try { sessionStorage.setItem("innermate.reflect", text); } catch { /* noop */ }
    navigate({ to: "/companion" });
  };

  const exploreConstellation = () =>
    talkToInnerMate(innermateContext(constellation, periodMoods, PERIOD_LABEL[period]));

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
      {/* Eyebrow row — the observatory's date line */}
      <div className="flex items-baseline justify-between gap-4">
        <p className="qs-section-label">insights</p>
        <p className="text-[12.5px] text-muted-foreground">
          {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* Tonight's sky — the narrative reading (design 1a) */}
      <SkyHero events={events} />

      {/* Tabs + period */}
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Insight views" className="flex gap-1 rounded-full border p-1"
          style={{ borderColor: "var(--border-subtle)", background: "color-mix(in oklab, var(--card) 40%, transparent)", width: "fit-content" }}>
          {(["constellation", "timeline"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className="rounded-full px-4 py-2 text-[13.5px] capitalize transition"
              style={view === v
                ? { background: "var(--surface-selected)", color: "var(--text-primary)", fontWeight: 600 }
                : { color: "var(--text-secondary)" }}
            >
              {v}
            </button>
          ))}
        </div>
        <select
          value={period}
          onChange={(e) => { setPeriod(e.target.value as Period); setSelected(null); }}
          aria-label="Time period"
          className="h-10 rounded-full border px-4 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          style={{ borderColor: "var(--border-subtle)", background: "color-mix(in oklab, var(--card) 60%, transparent)", color: "var(--text-primary)" }}
        >
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <option key={p} value={p}>{PERIOD_LABEL[p]}</option>
          ))}
        </select>
      </div>

      {/* Compact check-in — expands to the full ritual */}
      <div className="mt-6">
        {todayMood && !checkinOpen ? (
          <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-3xl px-5 py-4">
            <div className="min-w-0">
              <p className="font-serif text-[16px] leading-snug">
                Today feels <em className="italic">{WEIGHT_WORD(todayMood.mood_score)}</em>
              </p>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                {[...(todayMood.emotion_tags ?? []), ...(todayMood.trigger_tags ?? [])].slice(0, 4).join(" · ") || "no tags"}
                {" · saved at "}
                {new Date(todayMood.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setCheckinOpen(true)}
                className="rounded-full border px-3.5 py-2 text-[12.5px] transition hover:-translate-y-0.5"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}>
                Add another
              </button>
              <button type="button"
                onClick={() => talkToInnerMate(`I just checked in — today feels ${WEIGHT_WORD(todayMood.mood_score)}. ${(todayMood.emotion_tags ?? []).join(", ")}${todayMood.trigger_tags?.length ? ` — around ${todayMood.trigger_tags.join(", ")}` : ""}.${todayMood.note ? ` ${todayMood.note}` : ""}`)}
                className="rounded-full px-3.5 py-2 text-[12.5px] transition"
                style={{ background: "color-mix(in oklab, var(--accent-primary) 20%, transparent)", color: "var(--text-primary)" }}>
                Talk to InnerMate
              </button>
            </div>
          </div>
        ) : (
          <div className="glass rounded-3xl p-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="qs-section-label">a moment to check in</p>
              {todayMood && (
                <button type="button" onClick={() => setCheckinOpen(false)} className="text-[12px] text-muted-foreground transition hover:text-foreground">
                  collapse
                </button>
              )}
            </div>
            <div className="mt-3"><CheckinRitual /></div>
            <Link to="/checkin" className="mt-2 inline-block text-[13px] text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline">
              prefer the guided journey? →
            </Link>
          </div>
        )}
      </div>

      {/* What may be shaping it — the design's influence list, on real signals */}
      {topSignals.length > 0 && (
        <div className="mt-6">
          <p className="qs-section-label">what may be shaping it · {PERIOD_LABEL[period].toLowerCase()}</p>
          <div className="mt-3.5 flex flex-col gap-4">
            {topSignals.slice(0, 3).map((s, i) => {
              const mix = describeMix(sourceMixFor(periodEvents, s.label));
              return (
                <Link key={s.label} to="/pattern/$tag" params={{ tag: s.label }} className="group flex gap-3">
                  <span
                    aria-hidden
                    className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full motion-safe:animate-[qs-twinkle_4s_ease-in-out_infinite]"
                    style={{ background: "var(--dawn)", boxShadow: "0 0 8px color-mix(in oklab, var(--dawn) 60%, transparent)", animationDelay: `${i * 0.9}s` }}
                  />
                  <span className="min-w-0">
                    <span className="block text-[14.5px] font-semibold text-foreground transition group-hover:text-foreground">{s.label}</span>
                    <span className="mt-0.5 block text-[13px] leading-relaxed text-secondary-foreground">
                      appeared {s.count} {s.count === 1 ? "time" : "times"} · {statusFor(s.count).toLowerCase()}
                    </span>
                    {mix && <span className="mt-0.5 block text-[11px] text-muted-foreground">seen in {mix}</span>}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="sky-panel mt-6 flex h-[280px] items-center justify-center">
          <p className="font-serif text-[14px] italic text-foreground/60">reading your sky…</p>
        </div>
      ) : view === "constellation" ? (
        <ConstellationView
          constellation={constellation}
          periodMoods={engineEntries as Mood[]}
          events={periodEvents}
          period={period}
          co={co}
          selected={selected}
          setSelected={setSelected}
          onExplore={exploreConstellation}
          onTalk={talkToInnerMate}
        />
      ) : (
        <TimelineView periodMoods={periodMoods} visibleTags={visibleStats.map((s) => s.label)} filterTag={timelineTag} setFilterTag={setTimelineTag} />
      )}

      {/* A rhythm we noticed — weekday pattern with its own numbers */}
      <RhythmCard moods={moods} hidden={hidden} />

      {/* What is changing — evidence-gated progress, never invented */}
      <WhatIsChanging events={events} />

      {/* Supporting panels — real evidence phrasing */}
      {constellation.confidence.level !== "insufficient" && (
        <SupportingPanels periodMoods={engineEntries as Mood[]} visible={visibleStats} journal={(journal ?? []) as JournalRow[]} />
      )}

      {/* Set-aside patterns — restorable */}
      {hidden.length > 0 && <SetAside tags={hidden} />}

      {/* Closing: one gentle step + one question + the letter */}
      <ClosingRow periodMoods={periodMoods} topEmotion={visibleStats.find((s) => s.kind === "emotion")?.label} />
    </div>
  );
}

/* ── Tonight's sky — narrative hero (design 1a "Quiet cosmic sanctuary") ── */

function daysAgoLabel(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}

function SkyHero({ events }: { events: InsightEvent[] }) {
  const profileFn = useServerFn(getProfile);
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });
  const [showWhy, setShowWhy] = useState(false);
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => { setHour(new Date().getHours()); }, []);
  const sky = useMemo(() => skyReading(events), [events]);
  const name = (profile as { display_name?: string | null } | null | undefined)?.display_name?.split(" ")[0];
  const greeting = hour == null ? "Hello" : hour < 5 ? "Still up" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="relative mt-5">
      {/* faint fixed stars behind the reading */}
      <span aria-hidden className="absolute right-[6%] top-1 h-[3px] w-[3px] rounded-full bg-foreground/50 motion-safe:animate-[qs-twinkle_5s_ease-in-out_infinite]" />
      <span aria-hidden className="absolute right-[22%] top-10 h-[2px] w-[2px] rounded-full bg-foreground/30 motion-safe:animate-[qs-twinkle_6s_ease-in-out_infinite]" style={{ animationDelay: "2s" }} />
      <span aria-hidden className="absolute right-[13%] top-24 h-[2px] w-[2px] rounded-full" style={{ background: "color-mix(in oklab, var(--dawn) 70%, transparent)" }} />

      {/* the breathing orb — dawn-in-violet, the sky's presence */}
      <div
        aria-hidden
        className="h-[84px] w-[84px] rounded-full motion-safe:animate-[qs-breathe_6.5s_ease-in-out_infinite]"
        style={{
          background:
            "radial-gradient(circle at 38% 32%, color-mix(in oklab, var(--dawn) 85%, transparent), color-mix(in oklab, var(--violet) 55%, transparent) 46%, color-mix(in oklab, var(--violet) 12%, transparent) 72%, transparent 78%)",
          filter: "blur(0.4px)",
        }}
      />
      <p className="mt-4 text-[13px] text-muted-foreground">{greeting}{name ? `, ${name}` : ""}</p>
      <h1 className="mt-1.5 font-serif text-[29px] font-light leading-[1.16] tracking-tight sm:text-[34px]" style={{ textWrap: "balance" }}>
        {sky.headline}
      </h1>
      <p className="mt-2.5 max-w-lg text-[14px] leading-relaxed text-secondary-foreground">{sky.reading}</p>

      {sky.sources.length > 0 && (
        <button
          type="button"
          onClick={() => setShowWhy(!showWhy)}
          aria-expanded={showWhy}
          className="mt-3 text-[12.5px] transition hover:brightness-125"
          style={{ color: "var(--accent-secondary)" }}
        >
          why this sky? ›
        </button>
      )}
      {showWhy && (
        <div
          className="fade-in mt-3 rounded-2xl border p-4"
          style={{ borderColor: "color-mix(in oklab, var(--violet) 18%, transparent)", background: "color-mix(in oklab, var(--violet) 8%, transparent)" }}
        >
          <p className="qs-section-label">read from what you shared</p>
          <ul className="mt-2.5 space-y-2 text-[12.5px] leading-relaxed text-secondary-foreground">
            {sky.sources.map((s) => (
              <li key={s.id} className="flex gap-2">
                <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-foreground/50" />
                <span>
                  {SOURCE_LABEL[s.source] === "check-ins" ? "a check-in" : SOURCE_LABEL[s.source] === "chats" ? "a conversation" : SOURCE_LABEL[s.source] === "journal" ? "a journal page" : "a memory"}
                  {" "}{daysAgoLabel(s.created_at)}
                  {[...s.emotions, ...s.triggers].length > 0 ? ` — ${[...s.emotions, ...s.triggers].slice(0, 3).join(", ").toLowerCase()}` : ""}
                  {s.excerpt ? <> · <em>“{s.excerpt}”</em></> : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11.5px] text-muted-foreground">
            nothing else is read — <Link to="/settings" className="underline underline-offset-2">manage what your sky may learn from</Link>
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Constellation view ── */

function ConstellationView({
  constellation, periodMoods, events, period, co, selected, setSelected, onExplore, onTalk,
}: {
  constellation: Constellation;
  periodMoods: Mood[];
  events: InsightEvent[];
  period: Period;
  co: Map<string, number>;
  selected: string | null;
  setSelected: (v: string | null) => void;
  onExplore: () => void;
  onTalk: (text: string) => void;
}) {
  const { center, ring, edges, checkinCount, confidence } = constellation;

  /* Low-data: no fake maps. */
  if (!center) {
    return (
      <div className="sky-panel mt-6 flex min-h-[260px] flex-col items-center justify-center px-8 py-10 text-center">
        <CompanionCloud size={64} state="calm" />
        <p className="mt-4 max-w-sm font-serif text-[16px] italic leading-relaxed text-foreground/75">
          Your constellation is beginning to form.
          {confidence.level === "insufficient" && confidence.needed > 0
            ? ` ${confidence.needed === 1 ? "One more check-in" : `${confidence.needed} more check-ins`} may reveal the first connections.`
            : " Check in when something is worth naming."}
        </p>
        {periodMoods.length > 0 && (
          <div className="mt-5 w-full max-w-sm space-y-2 text-left">
            {periodMoods.slice(0, 3).map((mm) => (
              <div key={mm.created_at} className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border-subtle)", background: "color-mix(in oklab, var(--card) 40%, transparent)" }}>
                <p className="text-[12px] text-muted-foreground">{new Date(mm.created_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</p>
                <p className="mt-0.5 text-[13.5px] text-foreground/90">
                  {mm.mood_score != null ? `feels ${WEIGHT_WORD(mm.mood_score)}` : "a noted moment"}
                  {(mm.emotion_tags?.length ?? 0) > 0 ? ` · ${mm.emotion_tags!.join(", ")}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="qs-pill-cta mt-6">
          Add today's moment
        </button>
      </div>
    );
  }

  const nodes = [center, ...ring];
  const connectedTo = (label: string) =>
    new Set(edges.filter((e) => e.a === label || e.b === label).flatMap((e) => [e.a, e.b]));
  const activeSet = selected ? connectedTo(selected) : null;
  const maxEdge = Math.max(1, ...edges.map((e) => e.strength));
  const selectedNode = selected ? nodes.find((n) => n.label === selected) ?? null : null;

  return (
    <>
      {/* The map */}
      <div className="sky-panel relative mt-6 h-[340px] sm:h-[400px]" role="group" aria-label={`Your pattern constellation — strongest: ${center.label}, ${center.count} appearances`}>
        {/* faint background stars (fixed, decorative) */}
        {Array.from({ length: 26 }, (_, i) => (
          <span key={i} aria-hidden className="absolute rounded-full"
            style={{ left: `${(i * 41) % 100}%`, top: `${(i * 59) % 92}%`, width: 1.5, height: 1.5, background: "oklch(0.95 0.01 90)", opacity: 0.14 + (i % 3) * 0.08 }} />
        ))}

        {/* edges — thickness is real co-occurrence strength */}
        <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {edges.map((e) => {
            const A = nodes.find((n) => n.label === e.a)!;
            const B = nodes.find((n) => n.label === e.b)!;
            const dimmed = activeSet ? !(activeSet.has(e.a) && activeSet.has(e.b)) : false;
            return (
              <line key={`${e.a}|${e.b}`} x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                stroke="oklch(1 0 0 / 0.30)"
                strokeWidth={0.35 + (e.strength / maxEdge) * 1.05}
                strokeDasharray={e.strength >= 2 ? undefined : "2 3"}
                opacity={dimmed ? 0.12 : 0.75}
                vectorEffect="non-scaling-stroke" />
            );
          })}
        </svg>

        {/* nodes — size=frequency, glow=recency; keyboard-focusable buttons */}
        {nodes.map((n) => {
          const isCenter = n.label === center.label;
          const tint = tagTint(n.label);
          const dimmed = activeSet ? !activeSet.has(n.label) && n.label !== selected : false;
          const dot = isCenter ? 18 + n.weight * 8 : 9 + n.weight * 9;
          return (
            <button
              key={n.label}
              type="button"
              onClick={() => setSelected(selected === n.label ? null : n.label)}
              aria-pressed={selected === n.label}
              aria-label={`${n.label}: appeared ${n.count} ${n.count === 1 ? "time" : "times"}, ${statusFor(n.count).toLowerCase()}`}
              className="absolute flex min-h-[44px] min-w-[44px] -translate-x-1/2 -translate-y-1/2 flex-col items-center outline-none transition-opacity duration-300 focus-visible:ring-2 focus-visible:ring-primary/60 rounded-2xl"
              style={{ left: `${n.x}%`, top: `${n.y}%`, opacity: dimmed ? 0.25 : 1 }}
            >
              <span aria-hidden className="rounded-full motion-safe:animate-[qs-twinkle_6s_ease-in-out_infinite]"
                style={{
                  width: dot, height: dot, background: tint,
                  opacity: 0.5 + n.glow * 0.5,
                  boxShadow: `0 0 ${6 + Math.round(n.glow * 16)}px ${1 + Math.round(n.glow * 4)}px color-mix(in oklab, ${tint} 55%, transparent)`,
                }} />
              <span className="mt-1.5 whitespace-nowrap text-center font-serif text-[11px] italic leading-tight"
                style={{ color: `color-mix(in oklab, ${tint} 40%, var(--foreground))` }}>
                {n.label.toLowerCase()}
              </span>
              <span className="text-[9.5px] text-muted-foreground">×{n.count}{isCenter ? ` · ${statusFor(n.count).toLowerCase()}` : ""}</span>
            </button>
          );
        })}

        {selected && (
          <button type="button" onClick={() => setSelected(null)}
            className="absolute right-3 top-3 rounded-full border px-3 py-1.5 text-[11.5px] backdrop-blur transition hover:text-foreground"
            style={{ borderColor: "var(--border-subtle)", background: "color-mix(in oklab, var(--background) 70%, transparent)", color: "var(--text-secondary)" }}>
            reset
          </button>
        )}
        <p className="absolute inset-x-0 bottom-2.5 text-center font-serif text-[10.5px] italic text-foreground/40">
          tap a star to see its connections · size is frequency, light is recency
        </p>
      </div>

      {/* Selected node panel */}
      {selectedNode && (
        <NodePanel node={selectedNode} periodMoods={periodMoods} events={events} co={co} centerLabel={center.label} onTalk={onTalk} onClose={() => setSelected(null)} />
      )}

      {/* What this pattern may reveal */}
      <RevealCard constellation={constellation} periodMoods={periodMoods} events={events} period={period} onExplore={onExplore} onSelectCenter={() => setSelected(center.label)} />
    </>
  );
}

function NodePanel({
  node, periodMoods, events, co, centerLabel, onTalk, onClose,
}: {
  node: MapNode; periodMoods: Mood[]; events: InsightEvent[]; co: Map<string, number>; centerLabel: string;
  onTalk: (t: string) => void; onClose: () => void;
}) {
  const [whyOpen, setWhyOpen] = useState(false);
  const moments = momentsFor(periodMoods, node.label, 3);
  const peak = peakTod(timeOfDayFor(periodMoods, node.label));
  const mix = sourceMixFor(events, node.label);
  const mixLine = describeMix(mix);
  const inferredOnly = isInferredOnly(events, node.label);
  const related = tagStats(periodMoods)
    .filter((s) => s.label !== node.label)
    .map((s) => ({ label: s.label, n: coBetween(co, node.label, s.label) }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);
  return (
    <div className="glass mt-3 rounded-3xl p-5 fade-in" role="region" aria-label={`Details for ${node.label}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="qs-section-label">{node.kind === "emotion" ? "a feeling" : "a signal"}</p>
          <h3 className="mt-1 font-serif text-[20px] font-light leading-snug">{node.label}</h3>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {node.count} supporting {node.count === 1 ? "moment" : "moments"}
            {mixLine ? ` · ${mixLine}` : ""} · {statusFor(node.count).toLowerCase()}
            {peak ? ` · most often ${peak.label.toLowerCase()}` : ""}
            {node.label !== centerLabel && node.linkToCenter > 0 ? ` · with ${centerLabel.toLowerCase()} ×${node.linkToCenter}` : ""}
          </p>
          {inferredOnly && (
            <p className="mt-1 text-[11.5px] italic text-muted-foreground">
              noticed in your own words in chat — you haven't named it in a check-in yet.
            </p>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label="Close details" className="glass flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground">
          <X className="h-3.5 w-3.5" strokeWidth={1.8} />
        </button>
      </div>

      {related.length > 0 && (
        <p className="mt-3 text-[13px] leading-relaxed text-secondary-foreground">
          tended to appear alongside {related.map((r) => `${r.label.toLowerCase()} (×${r.n})`).join(", ")}.
        </p>
      )}

      {moments.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="qs-section-label">supporting moments</p>
          {moments.map((mm) => (
            <div key={mm.created_at} className="rounded-2xl border px-4 py-2.5" style={{ borderColor: "var(--border-subtle)", background: "color-mix(in oklab, var(--card) 40%, transparent)" }}>
              <p className="text-[11.5px] text-muted-foreground">
                {new Date(mm.created_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · feels {WEIGHT_WORD(mm.mood_score ?? 5)}
              </p>
              {mm.note && <p className="mt-1 font-serif text-[13px] italic leading-relaxed text-foreground/85 line-clamp-2">“{mm.note}”</p>}
            </div>
          ))}
        </div>
      )}

      {/* Why am I seeing this? — full provenance, in plain language */}
      <button type="button" onClick={() => setWhyOpen(!whyOpen)} aria-expanded={whyOpen}
        className="mt-3 text-[12px] text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline">
        why am I seeing this?
      </button>
      {whyOpen && (
        <div className="mt-2 rounded-2xl border px-4 py-3 text-[12.5px] leading-relaxed text-secondary-foreground fade-in"
          style={{ borderColor: "var(--border-subtle)", background: "color-mix(in oklab, var(--card) 35%, transparent)" }}>
          <p>
            This appears because it came up in {mixLine || `${node.count} of your moments`} during this period
            {peak ? `, most often in the ${peak.label.toLowerCase()}` : ""}.
            {" "}{inferredOnly
              ? "It was noticed by matching words in things you wrote — an inference, not something you selected."
              : "It comes from tags you selected yourself, which is the strongest kind of evidence."}
          </p>
          <p className="mt-1.5">
            Only your own words are read — never InnerMate's replies, and never anything from a safety moment.
            You can switch any source off in <Link to="/settings" className="underline underline-offset-2">the Sanctuary</Link>,
            or set this pattern aside on its <Link to="/pattern/$tag" params={{ tag: node.label }} className="underline underline-offset-2">detail page</Link>.
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2.5">
        <button type="button"
          onClick={() => onTalk(`${node.label} has come up in ${node.count} of my recent moments${mixLine ? ` (${mixLine})` : ""}${peak ? `, most often in the ${peak.label.toLowerCase()}` : ""}. Does that feel accurate to explore together?`)}
          className="qs-pill-cta" style={{ padding: "0.55rem 1.05rem", fontSize: "13px" }}>
          <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.7} /> Explore with InnerMate
        </button>
        <Link to="/pattern/$tag" params={{ tag: node.label }}
          className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] transition hover:-translate-y-0.5"
          style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}>
          full detail <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

function RevealCard({
  constellation, periodMoods, events, period, onExplore, onSelectCenter,
}: {
  constellation: Constellation; periodMoods: Mood[]; events: InsightEvent[]; period: Period;
  onExplore: () => void; onSelectCenter: () => void;
}) {
  const { center, ring, checkinCount, confidence } = constellation;
  if (!center) return null;
  const companions = ring.filter((n) => n.linkToCenter > 0).slice(0, 2);
  const peak = peakTod(timeOfDayFor(periodMoods, center.label));
  const mix = sourceMixFor(events, center.label);
  const mixLine = describeMix(mix);
  const crossSource = sourceCount(mix) >= 2;
  return (
    <TactileCard tint="lavender" className="mt-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="qs-section-label">what this pattern may reveal</p>
        <p className="text-[11px] text-muted-foreground">{confidence.label} · {checkinCount} moments</p>
      </div>
      <p className="mt-3 text-[14.5px] leading-relaxed text-foreground/90">
        <strong className="font-medium">{center.label}</strong> appeared in {center.count} of your {checkinCount} moments
        {peak ? <>, most often in the <strong className="font-medium">{peak.label.toLowerCase()}</strong></> : null}
        {companions.length > 0 && (
          <>, and tended to occur when {companions.map((c) => c.label.toLowerCase()).join(" or ")} {companions.length === 1 ? "was" : "were"} present</>
        )}.
        {" "}That's an observation, not a verdict — but it may be worth exploring gently.
      </p>
      {mixLine && (
        <p className="mt-2 text-[12px] text-muted-foreground">
          seen across {mixLine}
          {crossSource ? " — appearing in more than one place makes this more dependable" : ""}.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2.5">
        <button type="button" onClick={onExplore} className="qs-pill-cta" style={{ padding: "0.55rem 1.05rem", fontSize: "13px" }}>
          <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.7} /> Explore this with InnerMate
        </button>
        <button type="button" onClick={onSelectCenter}
          className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] transition hover:-translate-y-0.5"
          style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}>
          view supporting moments
        </button>
      </div>
    </TactileCard>
  );
}

/* ── Timeline view ── */

function TimelineView({
  periodMoods, visibleTags, filterTag, setFilterTag,
}: {
  periodMoods: Mood[]; visibleTags: string[]; filterTag: string | null; setFilterTag: (t: string | null) => void;
}) {
  const [openIso, setOpenIso] = useState<string | null>(null);
  const points = useMemo(() => timelinePoints(periodMoods, filterTag ?? undefined), [periodMoods, filterTag]);
  const summary = useMemo(() => timelineSummary(points, periodMoods), [points, periodMoods]);
  const open = openIso ? points.find((p) => p.iso === openIso) ?? null : null;

  const W = 640, H = 150, pad = 14;
  const t0 = points.length ? new Date(points[0].iso).getTime() : 0;
  const t1 = points.length ? new Date(points[points.length - 1].iso).getTime() : 1;
  const span = Math.max(1, t1 - t0);
  const xFor = (iso: string) => pad + ((new Date(iso).getTime() - t0) / span) * (W - pad * 2);
  const yFor = (v: number) => H - pad - ((Math.max(1, Math.min(10, v)) - 1) / 9) * (H - pad * 2);
  // Only connect points that are ≤ 2 days apart — gaps stay visibly empty.
  const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 1; i < points.length; i++) {
    const gap = new Date(points[i].iso).getTime() - new Date(points[i - 1].iso).getTime();
    if (gap <= 2 * 86400000) {
      segments.push({ x1: xFor(points[i - 1].iso), y1: yFor(points[i - 1].score), x2: xFor(points[i].iso), y2: yFor(points[i].score) });
    }
  }

  return (
    <div className="mt-6">
      <p className="text-[14px] leading-relaxed text-secondary-foreground">{summary}</p>

      {/* tag filter */}
      {visibleTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {visibleTags.slice(0, 8).map((t) => (
            <button key={t} type="button" onClick={() => setFilterTag(filterTag === t ? null : t)}
              aria-pressed={filterTag === t}
              className={`qs-chip ${filterTag === t ? "qs-chip--active" : ""}`}>
              {t}
            </button>
          ))}
          {filterTag && (
            <button type="button" onClick={() => setFilterTag(null)} className="text-[12px] text-muted-foreground underline-offset-4 hover:underline">
              clear
            </button>
          )}
        </div>
      )}

      <div className="sky-panel mt-4 p-4">
        {points.length === 0 ? (
          <p className="py-10 text-center font-serif text-[14px] italic text-foreground/60">
            no check-ins {filterTag ? `with ${filterTag.toLowerCase()} ` : ""}in this period.
          </p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Timeline of ${points.length} check-ins. ${summary}`}>
            {segments.map((s, i) => (
              <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.4" strokeLinecap="round" />
            ))}
            {points.map((p) => {
              const domEmotion = p.emotions[0];
              const tint = domEmotion ? tagTint(domEmotion) : "var(--mint)";
              return (
                <g key={p.iso}>
                  <circle cx={xFor(p.iso)} cy={yFor(p.score)} r={10} fill="transparent"
                    style={{ cursor: "pointer" }} onClick={() => setOpenIso(openIso === p.iso ? null : p.iso)} />
                  <circle cx={xFor(p.iso)} cy={yFor(p.score)} r={openIso === p.iso ? 5 : 3.4}
                    fill={tint} opacity={0.9} pointerEvents="none" />
                </g>
              );
            })}
          </svg>
        )}
        <div className="mt-1 flex items-center justify-between text-[10.5px] text-muted-foreground">
          <span>{points.length ? new Date(points[0].iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}</span>
          <span>gaps are simply days you didn't check in — they don't count against you</span>
          <span>{points.length ? new Date(points[points.length - 1].iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}</span>
        </div>
      </div>

      {open && (
        <div className="glass mt-3 rounded-3xl p-5 fade-in" role="region" aria-label="Check-in details">
          <div className="flex items-start justify-between">
            <p className="text-[12px] text-muted-foreground">
              {new Date(open.iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
            <button type="button" onClick={() => setOpenIso(null)} aria-label="Close" className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1.5 font-serif text-[16px]">feels {WEIGHT_WORD(open.score)}</p>
          {(open.emotions.length > 0 || open.triggers.length > 0) && (
            <p className="mt-1 text-[13px] text-secondary-foreground">{[...open.emotions, ...open.triggers].join(" · ")}</p>
          )}
          {open.note && <p className="mt-2 font-serif text-[13.5px] italic leading-relaxed text-foreground/85">“{open.note}”</p>}
        </div>
      )}
    </div>
  );
}

/* ── A rhythm we noticed — weekday pattern, gated and set-aside-able ── */

function RhythmCard({ moods, hidden }: { moods: Mood[]; hidden: string[] }) {
  const qc = useQueryClient();
  const hideFn = useServerFn(hidePattern);
  const rhythm = useMemo(() => weekdayRhythm(moods), [moods]);
  const [hiding, setHiding] = useState(false);
  if (!rhythm) return null;
  const tag = `${rhythm.weekday} rhythm`;
  if (hidden.some((h) => h.toLowerCase() === tag.toLowerCase())) return null;

  const setAside = async () => {
    if (hiding) return;
    setHiding(true);
    try {
      await hideFn({ data: { tag, reasons: [] } });
      qc.invalidateQueries({ queryKey: ["hiddenPatterns"] });
    } catch { setHiding(false); }
  };

  return (
    <div className="glass mt-5 rounded-3xl p-5">
      <p className="qs-section-label">a rhythm we noticed</p>
      <p className="mt-2 text-[14.5px] leading-relaxed text-foreground/90">{rhythm.statement}</p>
      <p className="mt-1.5 text-[11.5px] text-muted-foreground">
        {rhythm.evidence} · an observation, not a rule — some {rhythm.weekday}s will be different.
      </p>
      <button
        type="button"
        onClick={setAside}
        disabled={hiding}
        className="mt-3 text-[12px] text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline disabled:opacity-60"
      >
        this doesn't fit — set it aside
      </button>
    </div>
  );
}

/* ── What is changing — only when evidence supports it ── */

function WhatIsChanging({ events }: { events: InsightEvent[] }) {
  const signals = useMemo(() => changeSignals(events), [events]);
  if (signals.length === 0) return null;
  return (
    <TactileCard tint="mint" className="mt-5">
      <p className="qs-section-label">what is changing</p>
      <ul className="mt-3 space-y-3">
        {signals.map((s) => (
          <li key={s.text}>
            <p className="text-[14px] leading-relaxed text-foreground/90">{s.text}</p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">evidence: {s.evidence}</p>
          </li>
        ))}
      </ul>
    </TactileCard>
  );
}

/* ── Supporting panels ── */

function SupportingPanels({ periodMoods, visible, journal }: { periodMoods: Mood[]; visible: ReturnType<typeof tagStats>; journal: JournalRow[] }) {
  const total = periodMoods.length;
  const emotions = visible.filter((s) => s.kind === "emotion").slice(0, 3);
  const triggers = visible.filter((s) => s.kind === "trigger").slice(0, 3);
  const co = useMemo(() => cooccurrence(periodMoods), [periodMoods]);
  const topEmotion = emotions[0]?.label;

  // Only weighted moments (check-ins) can be "heavy" — null weights never count.
  const heavy = periodMoods.filter((mm) => mm.mood_score != null && mm.mood_score <= 4);
  const heavyPeak = peakTod(timeOfDayFor(heavy));
  const allTod = timeOfDayFor(periodMoods);
  const todMax = Math.max(1, ...TOD_LABELS.map((l) => allTod[l]));

  const weekAgo = Date.now() - 7 * 86400000;
  const pagesThisPeriod = journal.filter((jr) => jr.created_at && new Date(jr.created_at).getTime() >= weekAgo).length;
  const windDowns = journal.filter((jr) => jr.title === "Wind-down").length;

  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <TactileCard tint="mint">
        <p className="qs-section-label">what kept returning</p>
        {emotions.length === 0 ? (
          <p className="mt-3 text-sm italic text-muted-foreground">no feelings named yet — the sky can wait.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {emotions.map((e) => (
              <li key={e.label}>
                <Link to="/pattern/$tag" params={{ tag: e.label }} className="block text-[13.5px] leading-relaxed text-foreground/90 transition hover:text-foreground">
                  <strong className="font-medium">{e.label}</strong> appeared in {e.count} of {total} moments →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </TactileCard>

      <TactileCard tint="rose">
        <p className="qs-section-label">what tended to stir it</p>
        {triggers.length === 0 ? (
          <p className="mt-3 text-sm italic text-muted-foreground">no signals yet. they surface when they're ready.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {triggers.map((t) => {
              const withTop = topEmotion ? coBetween(co, t.label, topEmotion) : 0;
              return (
                <li key={t.label} className="text-[13.5px] leading-relaxed text-foreground/90">
                  <strong className="font-medium">{t.label}</strong> ×{t.count}
                  {withTop > 0 && topEmotion ? ` — in ${withTop} ${topEmotion.toLowerCase()} check-ins` : ""}
                </li>
              );
            })}
          </ul>
        )}
      </TactileCard>

      <TactileCard>
        <p className="qs-section-label">when it tended to happen</p>
        <div className="mt-4 grid grid-cols-4 gap-3">
          {TOD_LABELS.map((l) => (
            <div key={l} className="flex flex-col items-center gap-1.5">
              <div className="flex h-14 items-end">
                <div className="w-6 rounded-t-md" style={{
                  height: `${Math.max(5, Math.round((allTod[l] / todMax) * 52))}px`,
                  background: heavyPeak?.label === l ? "var(--accent-primary)" : "var(--foreground)",
                  opacity: heavyPeak?.label === l ? 0.85 : 0.22,
                }} aria-hidden />
              </div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{l}</p>
              <p className="text-[10.5px] text-foreground/60">{allTod[l]}</p>
            </div>
          ))}
        </div>
        {heavyPeak && (
          <p className="mt-3 border-t border-border/40 pt-3 text-[12.5px] leading-relaxed text-muted-foreground">
            most of the heavier check-ins happened around {heavyPeak.label.toLowerCase()}.
          </p>
        )}
      </TactileCard>

      <TactileCard tint="amber">
        <p className="qs-section-label">practices you returned to</p>
        <ul className="mt-3 space-y-2 text-[13.5px] leading-relaxed text-foreground/90">
          {pagesThisPeriod > 0 && <li>{pagesThisPeriod} journal {pagesThisPeriod === 1 ? "page" : "pages"} this week</li>}
          {windDowns > 0 && <li>{windDowns} night{windDowns === 1 ? "" : "s"} set down with the wind-down</li>}
          {pagesThisPeriod === 0 && windDowns === 0 && (
            <li className="italic text-muted-foreground">nothing yet — the tools are there when you want them.</li>
          )}
        </ul>
        <p className="mt-3 border-t border-border/40 pt-3 text-[11.5px] italic leading-relaxed text-muted-foreground">
          we only list what you actually did — never a claim that it "worked".
        </p>
      </TactileCard>
    </div>
  );
}

/* ── Set-aside (restorable hidden patterns) ── */

function SetAside({ tags }: { tags: string[] }) {
  const qc = useQueryClient();
  const unhideFn = useServerFn(unhidePattern);
  const restore = async (tag: string) => {
    try {
      await unhideFn({ data: { tag } });
      qc.invalidateQueries({ queryKey: ["hiddenPatterns"] });
    } catch { /* stays set aside */ }
  };
  return (
    <TactileCard className="mt-4">
      <p className="qs-section-label">set aside</p>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
        Patterns you told me didn't fit. They're hidden from your sky — bring any back whenever you like.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {tags.map((t) => (
          <button key={t} type="button" onClick={() => restore(t)}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition hover:-translate-y-0.5"
            style={{ borderColor: "var(--border-subtle)", background: "color-mix(in oklab, var(--card) 45%, transparent)", color: "var(--text-secondary)" }}>
            {t} <span className="text-[11px] text-muted-foreground">restore</span>
          </button>
        ))}
      </div>
    </TactileCard>
  );
}

/* ── Closing row ── */

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

function ClosingRow({ periodMoods, topEmotion }: { periodMoods: Mood[]; topEmotion?: string }) {
  const qc = useQueryClient();
  const keepFn = useServerFn(keepIntention);
  const stateFn = useServerFn(getIntentionState);
  const outcomeFn = useServerFn(recordIntentionOutcome);
  const { data: intent } = useQuery({ queryKey: ["intention"], queryFn: () => stateFn() });
  const [keeping, setKeeping] = useState(false);
  const [answered, setAnswered] = useState(false);

  const heavyPeak = peakTod(timeOfDayFor(periodMoods.filter((mm) => mm.mood_score <= 4)));
  const evenings = heavyPeak?.label === "Evening" || heavyPeak?.label === "Night";
  const step = evenings
    ? { title: "A night reset", body: "The late hours keep appearing in your sky. Three slow breaths before bed can soften their edges.", to: "/wind-down" as const, icon: MoonStar, cta: "Begin a night reset" }
    : periodMoods.some((mm) => (mm.trigger_tags ?? []).includes("Work"))
      ? { title: "A pause before action", body: "Work has been a bright signal lately. Try meeting the next wave with a small pause instead of a reply.", to: "/urge-shield" as const, icon: Hand, cta: "Practice the pause" }
      : { title: "A two-minute check-in", body: "The simplest way to add a star to this sky — pause, name the feeling, let it be seen.", to: null, icon: Feather, cta: "Check in gently" };
  const question = (topEmotion && DEEPER_QUESTIONS[topEmotion]) || "What would this week feel like if you were on your own side?";

  const keep = async () => {
    if (keeping) return;
    setKeeping(true);
    try {
      await keepFn({ data: { text: step.title } });
      await qc.invalidateQueries({ queryKey: ["intention"] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setKeeping(false); }
  };

  const answer = async (outcome: "yes" | "a_little" | "not_really") => {
    if (!intent?.open) return;
    try {
      await outcomeFn({ data: { id: intent.open.id, outcome } });
      setAnswered(true);
      qc.invalidateQueries({ queryKey: ["intention"] });
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <>
      {/* Yesterday's kept intention — the page follows up, gently */}
      {intent?.open && !answered && (
        <div className="glass mt-6 rounded-3xl p-5 fade-in">
          <p className="qs-section-label">the intention you kept</p>
          <p className="mt-2 font-serif text-[16.5px] italic leading-relaxed text-foreground/90">
            “{intent.open.comment}”
          </p>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">how did it go?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {([["yes", "it happened"], ["a_little", "partly"], ["not_really", "it didn't — that's okay"]] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => answer(k)} className="qs-chip">{label}</button>
            ))}
          </div>
        </div>
      )}
      {answered && (
        <p className="mt-6 text-[13px] italic text-muted-foreground fade-in">
          either way — you noticed. that counts.
        </p>
      )}

      {/* One small thing — the design's warm gradient invitation */}
      <div
        className="mt-6 rounded-[18px] border p-5"
        style={{
          background: "linear-gradient(160deg, color-mix(in oklab, var(--violet) 14%, transparent), color-mix(in oklab, var(--dawn) 8%, transparent))",
          borderColor: "color-mix(in oklab, var(--violet) 28%, transparent)",
        }}
      >
        <p className="qs-section-label" style={{ color: "var(--accent-secondary)" }}>one small thing</p>
        <p className="mt-2 font-serif text-[19px] font-normal leading-[1.3]">{step.title}?</p>
        <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-secondary-foreground">{step.body}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {step.to ? (
            <Link to={step.to} className="qs-pill-cta" style={{ padding: "0.6rem 1.15rem", fontSize: "13.5px" }}>
              {step.cta}
            </Link>
          ) : (
            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="qs-pill-cta" style={{ padding: "0.6rem 1.15rem", fontSize: "13.5px" }}>
              {step.cta}
            </button>
          )}
          {intent?.today ? (
            <span className="text-[13px]" style={{ color: "var(--dawn)" }}>
              ✦ kept as tonight's intention — it'll wait for you here tomorrow.
            </span>
          ) : (
            <button
              type="button"
              onClick={keep}
              disabled={keeping || !intent}
              className="rounded-full border px-4 py-2.5 text-[13px] transition hover:-translate-y-0.5 disabled:opacity-60"
              style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
            >
              {keeping ? "keeping…" : "keep as tonight's intention"}
            </button>
          )}
        </div>
      </div>

      <TactileCard tint="lavender" className="mt-4">
        <p className="qs-section-label">one deeper question</p>
        <p className="mt-4 font-serif text-lg italic leading-relaxed text-foreground/90">{question}</p>
        <p className="mt-3 text-[12px] text-muted-foreground">no need to answer today. let it orbit for a while.</p>
      </TactileCard>

      <div className="mt-10 flex flex-col items-center">
        <Link to="/home" className="qs-pill-cta">
          <Sparkles className="h-4 w-4" strokeWidth={1.7} />
          Open your letter from the moon cycle
        </Link>
        <p className="mt-3 text-center text-[12px] text-muted-foreground">your letter from the week waits on Home.</p>
      </div>

      {/* Transparency footer — the design's closing promise, with real doors */}
      <p className="mt-10 text-center text-[11.5px] leading-relaxed text-muted-foreground">
        Everything here is read only from what you've shared — nothing else.{" "}
        <Link to="/privacy" className="underline underline-offset-2 transition hover:text-foreground">how this works</Link>
        {" · "}
        <Link to="/settings" className="underline underline-offset-2 transition hover:text-foreground">manage what may be read</Link>
      </p>
      <p className="mt-4 text-center font-serif text-[13px] italic text-muted-foreground">
        a quiet week and a loud week both count.
      </p>
    </>
  );
}

