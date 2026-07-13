import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { listMoods, listJournal, getProfile, listPaths, logMood, annotateMood, saveJournal } from "@/lib/data.functions";
import { generateArrivalQuestions, generateArrivalRead } from "@/lib/arrival.functions";
import { FALLBACK_QUESTIONS, fallbackRead, type ArrivalQuestion, type ArrivalOption } from "@/lib/arrival-schema";
import { getCurrentLetter, generateWeeklyLetter } from "@/lib/letters.functions";
import { currentWeekStartISO, isSundayLocal } from "@/lib/week";
import {
  Heart, PenLine, Mail, Clock, ArrowRight, MessageCircle, HeartHandshake,
  Wind, X, AlertTriangle, Settings, Shield, Sparkles, Lightbulb,
  CloudRain, Cloud, CloudSun, Sun,
} from "lucide-react";

// Mood word → icon, matching the reference boards' labeled icon tiles.
const MOOD_ICONS: Record<string, typeof Cloud> = {
  Heavy: CloudRain,
  Cloudy: Cloud,
  Settled: CloudSun,
  Open: Sun,
  Bright: Sparkles,
};
import { listConversations } from "@/lib/companion.functions";
import { CompanionCloud } from "@/components/CompanionCloud";
import { toast } from "sonner";
import { VerseQuote } from "@/components/VerseQuote";
import { dailyVerse } from "@/lib/verses";
import { usePrivacyMode } from "@/hooks/use-privacy";
import { TactileCard } from "@/components/TactileCard";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { WeekArc, moodsToWeekArc } from "@/components/WeekArc";
import { getOnThisDay } from "@/lib/memories.functions";
import { DailyCheckinReminder } from "@/components/DailyCheckinReminder";

export const Route = createFileRoute("/_app/home")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Home | My Quiet Space" },
      { name: "description", content: "Your quiet dashboard — pause an urge, untangle a thought, or understand your week." },
      { property: "og:title", content: "Home — My Quiet Space" },
      { property: "og:description", content: "Pause an urge, untangle a thought, or understand your week." },
      { property: "og:url", content: "https://neeraj2019.lovable.app/home" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://neeraj2019.lovable.app/home" }],
  }),
});

// Client-only hour to avoid SSR/client mismatch.
function useLocalHour() {
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => {
    setHour(new Date().getHours());
    const id = setInterval(() => setHour(new Date().getHours()), 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return hour;
}

// Time-of-day subline for the inner sky.
function skyFor(hour: number) {
  if (hour < 5)  return "A quiet room for the hour when everything feels louder than it is.";
  if (hour < 12) return "The sky is still deciding what it will be today. So are you — no rush.";
  if (hour < 17) return "However the day is moving, there is a pause here with your name on it.";
  if (hour < 21) return "The light is lowering. Whatever the day held, it can be set down here.";
  return            "A quiet room for the hour when everything feels louder than it is.";
}

// 1..5 mood orbs (heavy → light): a serif word + today's emotional weather line.
const MOOD_ORBS = [
  { score: 2,  word: "Heavy",   weather: "today is asking a lot of you. that's allowed." },
  { score: 4,  word: "Cloudy",  weather: "a tender day. be gentle with the hours." },
  { score: 6,  word: "Settled", weather: "somewhere in the middle. just here." },
  { score: 8,  word: "Open",    weather: "a little ease today. let it be." },
  { score: 10, word: "Bright",  weather: "a softness you can rest in. notice it." },
] as const;

// One reflection star per day — rotated by day-of-year (computed client-side).
const REFLECTION_STARS = [
  "What am I still holding that I'm ready to release?",
  "What is true today — not what fear is telling me?",
  "What softened me today, even for a second?",
  "What does the tired part of me actually want?",
  "If this feeling could speak, what would it ask for?",
  "What would I say to someone I love, if they were carrying this?",
  "What small thing went unnoticed today that deserved a moment?",
];

// Feeling chips → deep-link into InnerMate with a pre-seeded opening line.
const FEELING_CHIPS: { label: string; seed: string; tint: string }[] = [
  { label: "I'm overwhelmed",       seed: "I'm overwhelmed right now. Just sit with me for a moment.", tint: "var(--dawn)" },
  { label: "I feel anxious",        seed: "I feel anxious. My chest is tight and I can't slow my thoughts down.", tint: "var(--sky)" },
  { label: "I miss someone",        seed: "I miss someone I can't be with right now. Help me sit with it.", tint: "var(--rose)" },
  { label: "I feel hurt",           seed: "Something has hurt me. I don't want to react yet — I want to understand it.", tint: "var(--dawn)" },
  { label: "I feel guilty",         seed: "I feel guilty about something. Help me look at it kindly and honestly.", tint: "var(--dawn)" },
  { label: "I need clarity",        seed: "I feel confused. Help me sort what's real from what I'm assuming.", tint: "var(--lavender)" },
  { label: "I need to decide",      seed: "I'm sitting with a decision. I don't want to act from urgency. Help me slow it down.", tint: "var(--sky)" },
  { label: "I need discipline",     seed: "I want to build a small habit again after slipping. Help me start tiny.", tint: "var(--mint)" },
  { label: "I just want to write",  seed: "I don't want advice — I just want to write. Give me a gentle opening line.", tint: "var(--mint)" },
  { label: "I want deeper wisdom",  seed: "Offer me one small piece of quiet wisdom that fits how I feel today.", tint: "var(--lavender)" },
];

function Home() {
  const profile = useServerFn(getProfile);
  const moods = useServerFn(listMoods);
  const journal = useServerFn(listJournal);
  const { data: p } = useQuery({ queryKey: ["profile"], queryFn: () => profile() });
  const { data: m } = useQuery({ queryKey: ["moods"], queryFn: () => moods() });
  const { data: j } = useQuery({ queryKey: ["journal"], queryFn: () => journal() });
  const todayMood = m?.[0];
  const { enabled: privacy } = usePrivacyMode();
  const hour = useLocalHour();
  const skyLine = hour == null ? null : skyFor(hour);
  const isEvening = hour != null && (hour >= 20 || hour < 4);
  const firstName = p?.display_name?.split(" ")[0];
  const weekStart = currentWeekStartISO();
  const arc = m ? moodsToWeekArc(m as { created_at: string; mood_score: number | null }[], weekStart) : null;
  const arcHasAny = !!arc && arc.some((v) => v != null);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      {/* 1 · Header row — brand eyebrow, SOS pill, sanctuary door */}
      <div className="flex items-center justify-between gap-3">
        <p className="qs-section-label">my quiet space</p>
        <div className="flex items-center gap-2">
          <Link
            to="/sos"
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px]"
            style={{
              borderColor: "color-mix(in oklab, var(--rose) 45%, transparent)",
              background: "color-mix(in oklab, var(--rose) 14%, transparent)",
              color: "color-mix(in oklab, var(--rose) 85%, var(--foreground))",
            }}
          >
            <AlertTriangle className="h-3 w-3" /> I'm not safe
          </Link>
          <Link
            to="/settings"
            aria-label="The sanctuary — settings"
            className="glass flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground"
          >
            <Settings className="h-3.5 w-3.5" strokeWidth={1.7} />
          </Link>
        </div>
      </div>

      {/* 2 · Hero — today's inner sky */}
      <div className="relative mt-7">
        <span aria-hidden="true" className="qs-firefly pointer-events-none" style={{ top: "4%", left: "76%" }} />
        <span aria-hidden="true" className="qs-firefly pointer-events-none" style={{ top: "48%", left: "91%", animationDelay: "-4.5s" }} />
        <span aria-hidden="true" className="qs-firefly pointer-events-none" style={{ top: "78%", left: "58%", animationDelay: "-9s" }} />
        <p className="qs-section-label">today's inner sky</p>
        <h1 className="mt-3 font-serif text-[2.05rem] font-light leading-[1.08] tracking-tight sm:text-[2.5rem]">
          {hour == null
            ? <>Welcome{firstName ? `, ${firstName}` : ""}.</>
            : hour < 5 ? <>Still up{firstName ? `, ${firstName}` : ""}?</>
            : hour < 12 ? <>Good morning{firstName ? `, ${firstName}` : ""}.</>
            : hour < 17 ? <>Good afternoon{firstName ? `, ${firstName}` : ""}.</>
            : hour < 21 ? <>Good evening{firstName ? `, ${firstName}` : ""}.</>
            : <>Winding down{firstName ? `, ${firstName}` : ""}?</>}
        </h1>
        <p className="mt-2 font-serif text-[17px] font-light text-foreground/85">
          How are you arriving today?
        </p>
        <p className="mt-2 max-w-[38ch] text-[13.5px] leading-relaxed text-muted-foreground">
          {skyLine ?? "A quiet place, ready when you are."}
        </p>
      </div>

      {/* 3 · Emotional weather */}
      <MoodOrbs alreadyLogged={!!todayMood} />

      {/* 4 · One reflection star */}
      <ReflectionStar />

      {/* 5 · Journal gateway — what is heavy on your mind */}
      <HeavyOnMind />

      {/* 6 · Or begin from a feeling — deep-links into InnerMate */}
      <div className="mt-8">
        <p className="qs-section-label">or begin from a feeling</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {FEELING_CHIPS.map((c) => (
            <Link key={c.label} to="/companion" search={{ seed: c.seed }} className="qs-chip">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: c.tint, boxShadow: `0 0 8px ${c.tint}` }}
              />
              {c.label}
            </Link>
          ))}
        </div>
      </div>

      {/* 7 · Continue with InnerMate — the real last thread, or meet it fresh */}
      <ContinueWithInnerMate />

      {/* 8 · Quick support — three doors, with honest durations */}
      <div className="mt-8">
        <p className="qs-section-label">quick support</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">choose what you need right now</p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Link to="/sos" className="glass block rounded-3xl p-4 transition hover:-translate-y-0.5">
            <Wind className="h-4 w-4" strokeWidth={1.7} style={{ color: "var(--emotion-calm)" }} />
            <p className="mt-2.5 font-serif text-[14.5px] leading-snug">Calm me now</p>
            <p className="mt-1 text-[11px] text-muted-foreground">2 min · breathing</p>
          </Link>
          <Link to="/checkin" className="glass block rounded-3xl p-4 transition hover:-translate-y-0.5">
            <Lightbulb className="h-4 w-4" strokeWidth={1.7} style={{ color: "var(--emotion-clarity)" }} />
            <p className="mt-2.5 font-serif text-[14.5px] leading-snug">Think this through</p>
            <p className="mt-1 text-[11px] text-muted-foreground">3–5 min · check-in</p>
          </Link>
          <Link to="/urge-shield" className="glass block rounded-3xl p-4 transition hover:-translate-y-0.5">
            <Shield className="h-4 w-4" strokeWidth={1.7} style={{ color: "oklch(0.72 0.11 45)" }} />
            <p className="mt-2.5 font-serif text-[14.5px] leading-snug">Stop an impulse</p>
            <p className="mt-1 text-[11px] text-muted-foreground">2 min · pause first</p>
          </Link>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[12px] text-muted-foreground">
          {isEvening && (
            <Link to="/wind-down" className="transition hover:text-foreground">night reset →</Link>
          )}
          <Link to="/reflect" className="transition hover:text-foreground">see a thought clearly →</Link>
          {!isEvening && (
            <Link to="/wind-down" className="transition hover:text-foreground">night reset →</Link>
          )}
        </div>
      </div>

      {/* 9 · Your week's constellation — the shape plus one honest pattern line */}
      {arcHasAny && (
        <div className="sky-panel mt-8 p-5">
          <p className="qs-section-label">your constellation</p>
          <ConstellationLine moods={(m ?? []) as MoodRow[]} />
          <WeekArc days={arc!} className="-ml-1 mt-3 w-full max-w-xs" label="Your week's constellation" />
          <Link
            to="/insights"
            className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
          >
            reveal this week's patterns <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* 10 · One recommendation, with its reason */}
      <RecommendedForYou moods={(m ?? []) as MoodRow[]} />

      <OnThisDay />

      <DailyCheckinReminder />

      <LetterWaiting enabled={!!(p as { weekly_letter_enabled?: boolean } | null | undefined)?.weekly_letter_enabled} />

      <ContinuePath />

      <TactileCard tint="lavender" className="hero-drift mt-9">
        <p className="qs-section-label">a small light for today</p>
        <div className="mt-2">
          <VerseQuote initial={dailyVerse()} rotate variant="plain" />
        </div>
        <Link
          to="/reflect"
          className="mt-4 inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
        >
          sit with it a while longer <ArrowRight className="h-3 w-3" />
        </Link>
      </TactileCard>

      {/* 11 · Closing */}
      <p className="mt-12 text-center font-serif text-[15px] italic text-muted-foreground">
        the pause is the practice.
      </p>
    </div>
  );
}

type MoodRow = {
  created_at: string;
  mood_score: number | null;
  emotion_tags?: string[] | null;
  trigger_tags?: string[] | null;
};

/** Count tag occurrences across the last 7 days of check-ins. */
function weekTagCounts(moods: MoodRow[]) {
  const weekAgo = Date.now() - 7 * 86400000;
  const emo = new Map<string, number>();
  const trig = new Map<string, number>();
  let both = 0;
  for (const row of moods) {
    if (new Date(row.created_at).getTime() < weekAgo) continue;
    row.emotion_tags?.forEach((t) => emo.set(t, (emo.get(t) ?? 0) + 1));
    row.trigger_tags?.forEach((t) => trig.set(t, (trig.get(t) ?? 0) + 1));
    if (row.emotion_tags?.length && row.trigger_tags?.length) both += 1;
  }
  const top = (map: Map<string, number>) =>
    [...map.entries()].sort((a, b) => b[1] - a[1])[0] as [string, number] | undefined;
  return { topEmotion: top(emo), topTrigger: top(trig), both };
}

/** One honest pattern sentence from real check-in tags; falls back gently. */
function ConstellationLine({ moods }: { moods: MoodRow[] }) {
  const { topEmotion, topTrigger, both } = weekTagCounts(moods);
  let line: string;
  if (topEmotion && topTrigger && both >= 2) {
    line = `${topEmotion[0]} and ${topTrigger[0]} appeared together ${both} times this week.`;
  } else if (topEmotion && topEmotion[1] >= 2) {
    line = `${topEmotion[0]} was named ${topEmotion[1]} times this week.`;
  } else {
    line = "Seven days, becoming a shape.";
  }
  return <p className="mt-2 font-serif text-[17px] font-light leading-snug">{line}</p>;
}

/** One recommendation with a real reason, driven by the week's top trigger. */
function RecommendedForYou({ moods }: { moods: MoodRow[] }) {
  const { topTrigger } = weekTagCounts(moods);
  const pick = (() => {
    switch (topTrigger?.[0]) {
      case "Sleep":
        return { to: "/wind-down" as const, title: "Night reset", meta: "3 min · guided wind-down",
          why: `because Sleep kept appearing in your check-ins this week` };
      case "Work":
        return { to: "/urge-shield" as const, title: "A pause before reacting", meta: "2 min · steadying",
          why: `because Work has been a loud signal this week` };
      case "Relationship":
      case "Memories":
        return { to: "/journal" as const, title: "The unsent letter", meta: "write it, keep it",
          why: `because ${topTrigger![0]} kept surfacing this week` };
      default:
        return { to: "/heal" as const, title: "A two-minute grounding", meta: "2 min · gentle path",
          why: topTrigger ? `because ${topTrigger[0]} kept appearing this week` : "a gentle way to begin" };
    }
  })();
  return (
    <div className="mt-8">
      <p className="qs-section-label">recommended for you</p>
      <Link to={pick.to} className="glass mt-3 block rounded-3xl p-5 transition hover:-translate-y-0.5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-serif text-[17px] font-light leading-snug">{pick.title}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">{pick.meta}</p>
            <p className="mt-2 text-[12.5px] italic leading-relaxed text-muted-foreground/90">{pick.why}</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </Link>
    </div>
  );
}

/** The most recent real conversation, resumable — or a first meeting. */
function ContinueWithInnerMate() {
  const listFn = useServerFn(listConversations);
  const { data: convs } = useQuery({ queryKey: ["convs"], queryFn: () => listFn() });
  const last = convs?.[0] as { id: string; title: string | null; updated_at?: string | null } | undefined;

  return (
    <div className="glass mt-8 rounded-3xl p-5 rise-in">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="qs-section-label">{last ? "continue with innermate" : "the companion"}</p>
          {last ? (
            <>
              <p className="mt-2 font-serif text-[19px] font-light leading-snug line-clamp-2">
                {last.title || "Your last conversation"}
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                shown because it's your most recent thread — pick it up or begin clean.
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 font-serif text-[19px] font-light leading-snug">
                Someone to think alongside — never to judge.
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                Whatever arrived with you today, you don't have to sort it alone.
              </p>
            </>
          )}
        </div>
        <CompanionCloud size={64} state={last ? "listening" : "calm"} className="mt-1 shrink-0" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2.5">
        {last ? (
          <>
            <Link to="/companion" search={{ open: last.id }} className="qs-pill-cta" style={{ padding: "0.6rem 1.1rem", fontSize: "13px" }}>
              Continue
            </Link>
            <Link
              to="/companion"
              className="glass inline-flex items-center rounded-full px-4 py-2.5 text-[13px] text-muted-foreground transition hover:text-foreground"
            >
              Start fresh
            </Link>
          </>
        ) : (
          <Link to="/companion" className="qs-pill-cta" style={{ padding: "0.6rem 1.1rem", fontSize: "13px" }}>
            <MessageCircle className="h-4 w-4" strokeWidth={1.7} /> Meet InnerMate
          </Link>
        )}
      </div>
    </div>
  );
}

function ContinuePath() {
  const fn = useServerFn(listPaths);
  const { data } = useQuery({ queryKey: ["paths"], queryFn: () => fn() });
  if (!data) return null;
  type Path = { id: string; slug: string; title: string };
  type Progress = { path_id: string; last_active_at?: string | null };
  const paths = (data.paths ?? []) as Path[];
  const progress = (data.progress ?? []) as Progress[];
  const currentSteps = (data.currentSteps ?? {}) as Record<string, { day: number; title: string; preview: string } | null>;
  // Pick the most recently active path that still has a next step.
  const active = [...progress]
    .sort((a, b) => (b.last_active_at ?? "").localeCompare(a.last_active_at ?? ""))
    .find((p) => currentSteps[p.path_id]);
  if (!active) return null;
  const path = paths.find((x) => x.id === active.path_id);
  const step = currentSteps[active.path_id];
  if (!path || !step) return null;
  return (
    <Link to="/heal/$slug" params={{ slug: path.slug }} className="mt-6 block">
      <TactileCard tint="mint" className="transition hover:-translate-y-0.5">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background/70">
            <HeartHandshake className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="qs-section-label">
              a path you're walking · {path.title} · day {step.day}
            </p>
            <p className="mt-1.5 font-serif text-xl leading-snug">{step.title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground line-clamp-2">{step.preview}</p>
            <p className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
              take today's step <ArrowRight className="h-3 w-3" />
            </p>
          </div>
        </div>
      </TactileCard>
    </Link>
  );
}

function LetterWaiting({ enabled }: { enabled: boolean }) {
  const navigate = useNavigate();
  const weekStartISO = currentWeekStartISO();
  const getFn = useServerFn(getCurrentLetter);
  const genFn = useServerFn(generateWeeklyLetter);
  const [opening, setOpening] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [checkIn, setCheckIn] = useState("");
  const [isSunday, setIsSunday] = useState(false);
  useEffect(() => { setIsSunday(isSundayLocal()); }, []);

  const { data: existing } = useQuery({
    queryKey: ["weekly-letter", weekStartISO],
    queryFn: () => getFn({ data: { weekStartISO } }) as Promise<{ id: string } | null>,
    enabled,
  });

  if (!enabled) return null;
  if (!existing && !isSunday) return null;

  const openExisting = () => {
    if (existing?.id) navigate({ to: "/letter/$id", params: { id: existing.id } });
  };

  const writeLetter = async () => {
    setOpening(true);
    try {
      const letter = await genFn({
        data: { weekStartISO, checkIn: checkIn.trim() || undefined },
      }) as { id: string };
      navigate({ to: "/letter/$id", params: { id: letter.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOpening(false);
    }
  };

  if (existing) {
    return (
      <button onClick={openExisting} className="mt-6 block w-full text-left">
        <TactileCard tint="amber" className="transition hover:-translate-y-0.5">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background/70">
              <Mail className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="qs-section-label">the moon cycle</p>
              <p className="mt-1.5 font-serif text-xl leading-snug">
                A letter from your week, written back to you.
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                It's ready. Open it when you have a quiet minute.
              </p>
            </div>
          </div>
        </TactileCard>
      </button>
    );
  }

  return (
    <div className="mt-6">
      <TactileCard tint="amber">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background/70">
            <Mail className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="qs-section-label">the moon cycle</p>
            <p className="mt-1.5 font-serif text-xl leading-snug">
              A letter from your week, written back to you.
            </p>
            {!expanded ? (
              <>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Woven from this week's check-ins and reflections. It's written the moment you open it.
                </p>
                <button onClick={() => setExpanded(true)} className="mt-4 soft-arrow">
                  Begin the check-in <ArrowRight className="h-4 w-4" />
                </button>
              </>
            ) : (
              <div className="mt-3">
                <label className="font-serif text-[15px] italic text-foreground/80">
                  What's on your heart this week?
                </label>
                <Textarea
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  placeholder="A sentence or two. Or leave it empty — that's allowed."
                  maxLength={500}
                  rows={3}
                  className="mt-2 rounded-2xl border-border/60 bg-background/60 font-serif text-[15px] leading-relaxed"
                  disabled={opening}
                />
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                  <Button variant="ghost" className="rounded-full text-muted-foreground" disabled={opening} onClick={writeLetter}>
                    Skip and open
                  </Button>
                  <Button variant="outline" className="rounded-full" disabled={opening} onClick={writeLetter}>
                    {opening ? "Writing your letter…" : "Write the letter"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </TactileCard>
    </div>
  );
}

function OnThisDay() {
  const fn = useServerFn(getOnThisDay);
  const [todayKey, setTodayKey] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const k = new Date().toISOString().slice(0, 10);
    setTodayKey(k);
    try { setDismissed(localStorage.getItem("onthisday-dismissed") === k); } catch { /* ignore */ }
  }, []);
  const { data } = useQuery({
    queryKey: ["on-this-day", todayKey],
    queryFn: () => fn(),
    enabled: !!todayKey && !dismissed,
  });
  if (dismissed || !data) return null;
  const yearsAgo = (data as { years_ago?: number }).years_ago ?? 0;
  const monthsAgo = (data as { months_ago?: number }).months_ago ?? 0;
  const kind = (data as { kind?: string }).kind;
  const preview = (data as { preview?: string }).preview;
  const when = yearsAgo >= 1
    ? `${yearsAgo} year${yearsAgo > 1 ? "s" : ""} ago today`
    : monthsAgo >= 1
      ? `${monthsAgo} month${monthsAgo > 1 ? "s" : ""} ago today`
      : "earlier today, in another week";
  const kindLabel = kind === "journal" ? "you wrote"
                  : kind === "memory" ? "you kept a memory"
                  : "you checked in";
  const dismiss = () => {
    try { if (todayKey) localStorage.setItem("onthisday-dismissed", todayKey); } catch { /* ignore */ }
    setDismissed(true);
  };
  const to = kind === "memory" ? "/memories" : kind === "journal" ? "/journal" : "/insights";
  return (
    <div className="mt-8">
      <TactileCard tint="amber" className="relative">
        <button
          aria-label="Let this star rest for today"
          onClick={dismiss}
          className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-background/60 hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-start gap-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background/70">
            <Clock className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="qs-section-label">a star from your sky · {when}</p>
            <p className="mt-1.5 font-serif text-[17px] leading-snug italic text-foreground/85">
              {kindLabel} — {preview}
            </p>
            <Link to={to} className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              revisit it <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </TactileCard>
    </div>
  );
}

// ── Inner-sky widgets ───────────────────────────────────────────

// After the orb, two soft questions — generated fresh by the AI for how
// this user is arriving today, with the hand-written set as an instant
// fallback. The answers are stitched into the mood log's note, which
// flows into InnerMate's silent context.
const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p, new Promise<null>((res) => setTimeout(() => res(null), ms))]);

function MoodOrbs({ alreadyLogged }: { alreadyLogged: boolean }) {
  const qc = useQueryClient();
  const logFn = useServerFn(logMood);
  const annotateFn = useServerFn(annotateMood);
  const genQsFn = useServerFn(generateArrivalQuestions);
  const genReadFn = useServerFn(generateArrivalRead);
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [moodLogId, setMoodLogId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ArrivalQuestion[]>(FALLBACK_QUESTIONS);
  const [aiQs, setAiQs] = useState(false);
  const [qLoading, setQLoading] = useState(false);
  const [qStep, setQStep] = useState<number>(-1); // -1 hidden, 0/1 asking, 2 done
  const [answers, setAnswers] = useState<ArrivalOption[]>([]);
  const [read, setRead] = useState<string | null>(null);
  const [readLoading, setReadLoading] = useState(false);
  const chosen = MOOD_ORBS.find((o) => o.score === selected) ?? null;

  const pick = async (score: number) => {
    const orb = MOOD_ORBS.find((o) => o.score === score);
    setSelected(score);
    setAnswers([]);
    setRead(null);
    setQStep(-1);
    setQLoading(true);

    // Ask the AI for personalized questions while the mood saves —
    // 6 seconds max, then the hand-written set carries the ritual.
    const qsPromise = orb
      ? withTimeout(
          genQsFn({ data: { mood_word: orb.word, mood_score: score } })
            .then((r) => (r as { questions: ArrivalQuestion[] | null })?.questions ?? null)
            .catch(() => null),
          6000,
        )
      : Promise.resolve(null);

    if (!saving && !alreadyLogged) {
      setSaving(true);
      try {
        const res = (await logFn({ data: { mood_score: score, emotion_tags: [], trigger_tags: [] } })) as
          | { id?: string | null }
          | undefined;
        setMoodLogId(res?.id ?? null);
        qc.invalidateQueries({ queryKey: ["moods"] });
        toast.success("Kept.", { duration: 1500 });
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setSaving(false);
      }
    }

    const ai = await qsPromise;
    setQuestions(ai && ai.length === 2 ? ai : FALLBACK_QUESTIONS);
    setAiQs(!!ai);
    setQLoading(false);
    setQStep(0);
  };

  const answer = async (opt: ArrivalOption) => {
    const next = [...answers, opt];
    setAnswers(next);
    if (qStep < questions.length - 1) {
      setQStep(qStep + 1);
      return;
    }
    setQStep(questions.length);

    // Quietly attach the answers to the mood entry (best-effort).
    if (moodLogId && chosen) {
      const note = `arriving: ${chosen.word.toLowerCase()} · ${questions
        .map((q, i) => `${q.title.toLowerCase().replace(/\?$/, "")}: ${next[i]?.l ?? ""}`)
        .join(" · ")}`;
      annotateFn({ data: { id: moodLogId, note: note.slice(0, 500) } })
        .then(() => qc.invalidateQueries({ queryKey: ["moods"] }))
        .catch(() => { /* silent */ });
    }

    // Closing read: AI-personalized when the questions were AI-made,
    // hand-written synthesis otherwise. Never blocks longer than 6s.
    if (aiQs && chosen) {
      setReadLoading(true);
      const aiRead = await withTimeout(
        genReadFn({
          data: {
            mood_word: chosen.word,
            qa: questions.map((q, i) => ({ q: q.title, a: next[i]?.l ?? "" })),
          },
        })
          .then((r) => (r as { read: string | null })?.read ?? null)
          .catch(() => null),
        6000,
      );
      setRead(aiRead ?? fallbackRead(next));
      setReadLoading(false);
    } else {
      setRead(fallbackRead(next));
    }
  };

  const mindsetRead = qStep >= questions.length ? read : null;

  return (
    <div
      className="mt-7 rounded-3xl border border-white/10 bg-card/55 p-5 backdrop-blur-xl rise-in"
      style={{ boxShadow: "0 20px 54px -34px oklch(0 0 0 / 0.7)" }}
    >
      <p className="qs-section-label">how are you arriving today?</p>
      <div className="mt-4 grid grid-cols-5 gap-2">
        {MOOD_ORBS.map((o) => {
          const on = selected === o.score;
          const Icon = MOOD_ICONS[o.word] ?? Cloud;
          return (
            <button
              key={o.score}
              type="button"
              onClick={() => pick(o.score)}
              aria-label={o.word}
              aria-pressed={on}
              className="flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-2.5 outline-none transition focus-visible:ring-2 focus-visible:ring-primary/50"
              style={on
                ? { background: "var(--surface-selected)", borderColor: "var(--border-active)" }
                : { background: "color-mix(in oklab, var(--card) 40%, transparent)", borderColor: "var(--border-subtle)" }}
            >
              <Icon className="h-4 w-4" strokeWidth={1.7} style={{ color: on ? "var(--accent-primary)" : "var(--text-secondary)" }} />
              <span className="text-[10.5px] leading-none" style={{ color: on ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: on ? 600 : 400 }}>
                {o.word}
              </span>
            </button>
          );
        })}
      </div>
      {chosen && (
        <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4 fade-in">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: "color-mix(in oklab, var(--dawn) 30%, transparent)" }}
          >
            <MessageCircle className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="font-serif text-[17px] leading-tight">{chosen.word}</p>
            <p className="mt-0.5 font-serif text-[13px] italic leading-snug text-muted-foreground">{chosen.weather}</p>
          </div>
        </div>
      )}

      {/* While the AI shapes today's questions */}
      {chosen && qLoading && (
        <div className="mt-4 flex items-center gap-2 fade-in" aria-live="polite">
          <span className="qs-typing-dot" />
          <span className="qs-typing-dot" style={{ animationDelay: "0.18s" }} />
          <span className="qs-typing-dot" style={{ animationDelay: "0.36s" }} />
          <span className="font-serif text-[12px] italic text-muted-foreground">
            finding today's questions…
          </span>
        </div>
      )}

      {/* Two soft follow-up questions — AI-shaped for today, and the
          answers quietly deepen what InnerMate understands. */}
      {chosen && qStep >= 0 && qStep < questions.length && (
        <div className="mt-4 fade-in" key={qStep}>
          <div className="flex items-center justify-between gap-2">
            <p className="font-serif text-[14px] leading-snug">{questions[qStep].title}</p>
            <span className="flex shrink-0 gap-1" aria-hidden>
              {questions.map((_, i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: i <= qStep ? "var(--dawn)" : "oklch(1 0 0 / 0.18)" }}
                />
              ))}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {questions[qStep].opts.map((o) => (
              <button
                key={o.l}
                type="button"
                onClick={() => void answer(o)}
                className="rounded-xl border border-white/10 bg-card/50 px-3 py-2.5 text-left text-[12.5px] leading-snug text-foreground transition hover:border-[color-mix(in_oklab,var(--dawn)_45%,transparent)] hover:bg-[color-mix(in_oklab,var(--dawn)_8%,transparent)]"
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>
      )}

      {readLoading && (
        <div className="mt-4 flex items-center gap-2 fade-in" aria-live="polite">
          <span className="qs-typing-dot" />
          <span className="qs-typing-dot" style={{ animationDelay: "0.18s" }} />
          <span className="qs-typing-dot" style={{ animationDelay: "0.36s" }} />
          <span className="font-serif text-[12px] italic text-muted-foreground">
            taking that in…
          </span>
        </div>
      )}

      {mindsetRead && (
        <div
          className="mt-4 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 fade-in"
          style={{
            background: "color-mix(in oklab, var(--dawn) 8%, transparent)",
            borderColor: "color-mix(in oklab, var(--dawn) 20%, transparent)",
          }}
        >
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.7} />
          <div className="min-w-0">
            <p className="text-[12.5px] leading-relaxed text-foreground/90">{mindsetRead}</p>
            <button
              type="button"
              onClick={() => { setQStep(0); setAnswers([]); setRead(null); }}
              className="mt-1.5 font-serif text-[11px] italic text-muted-foreground transition hover:text-foreground"
            >
              ask me again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReflectionStar() {
  // Day-of-year computed client-side, mirroring the todayKey pattern, so SSR and client agree.
  const [idx, setIdx] = useState<number | null>(null);
  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
    setIdx(((dayOfYear % REFLECTION_STARS.length) + REFLECTION_STARS.length) % REFLECTION_STARS.length);
  }, []);
  if (idx == null) return null;
  return (
    <div
      className="mt-4 rounded-3xl border p-5 backdrop-blur-xl fade-in"
      style={{
        borderColor: "color-mix(in oklab, var(--dawn) 26%, transparent)",
        background:
          "linear-gradient(150deg, color-mix(in oklab, var(--dawn) 12%, color-mix(in oklab, var(--card) 60%, transparent)), color-mix(in oklab, var(--card) 60%, transparent))",
      }}
    >
      <p className="qs-section-label flex items-center gap-1.5">
        <Sparkles className="h-3 w-3" strokeWidth={1.7} /> one reflection star
      </p>
      <p className="mt-2.5 font-serif text-[19px] font-light leading-snug">
        {REFLECTION_STARS[idx]}
      </p>
      <Link to="/journal" className="qs-chip mt-4">
        write from this <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function HeavyOnMind() {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveJournal);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [kept, setKept] = useState(false);
  const hasText = value.trim().length > 0;

  const save = async () => {
    const body = value.trim();
    if (!body || saving) return;
    setSaving(true);
    try {
      await saveFn({ data: { id: null, body, emotion_tags: [], entry_type: "heavy" } });
      qc.invalidateQueries({ queryKey: ["journal"] });
      setValue("");
      setKept(true);
      setTimeout(() => setKept(false), 2200);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="mt-4 rounded-3xl border border-white/10 p-5 backdrop-blur-xl rise-in"
      style={{
        background:
          "linear-gradient(150deg, color-mix(in oklab, var(--dawn) 14%, color-mix(in oklab, var(--card) 62%, transparent)), color-mix(in oklab, var(--card) 62%, transparent))",
      }}
    >
      <p className="font-serif text-[19px] leading-snug">What is heavy on your mind?</p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Say it plainly — no one is reading but you…"
        rows={3}
        maxLength={2000}
        className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-background/40 px-4 py-3 font-serif text-[15px] italic leading-relaxed text-foreground/90 placeholder:text-muted-foreground/70 focus:border-white/25 focus:outline-none"
      />
      <div className="mt-3">
        {kept ? (
          <span className="quiet-kept text-[12px] italic text-muted-foreground">Kept in your journal.</span>
        ) : hasText ? (
          <div className="fade-in">
            <p className="qs-section-label">how would you like to be met?</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Link
                to="/companion"
                search={{ seed: value.trim().slice(0, 500) }}
                className="qs-chip"
              >
                <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.7} /> talk it through with InnerMate
              </Link>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="qs-chip disabled:cursor-not-allowed disabled:opacity-55"
              >
                <PenLine className="h-3.5 w-3.5" strokeWidth={1.7} /> {saving ? "keeping…" : "just keep it here"}
              </button>
            </div>
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground">Saves quietly to your journal, whenever you're ready.</span>
        )}
      </div>
    </div>
  );
}
