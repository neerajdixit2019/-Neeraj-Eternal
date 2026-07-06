import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { listMoods, listJournal, getProfile, listPaths, logMood, saveJournal } from "@/lib/data.functions";
import { getCurrentLetter, generateWeeklyLetter } from "@/lib/letters.functions";
import { currentWeekStartISO, isSundayLocal } from "@/lib/week";
import { Heart, Moon, Brain, MessageSquareOff, PenLine, Mail, Clock, ArrowRight, HeartHandshake, MessageCircle, Wind, X, AlertTriangle } from "lucide-react";
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

function greetingFor(hour: number) {
  if (hour < 5)  return { eyebrow: "Good late night", sub: "You're up late. Be tender with yourself." };
  if (hour < 12) return { eyebrow: "Good morning",    sub: "A quiet start. No rush today." };
  if (hour < 17) return { eyebrow: "Good afternoon",  sub: "However the day's gone — you're allowed a pause." };
  if (hour < 21) return { eyebrow: "Good evening",    sub: "The day is softening. So can you." };
  return            { eyebrow: "Good night",          sub: "Nothing more is required of you tonight." };
}

// 1..5 mood orbs (heavy → light) with a matching serif word + description.
const MOOD_ORBS = [
  { score: 2,  word: "Heavy",   desc: "Something is pressing on you today." },
  { score: 4,  word: "Cloudy",  desc: "Not clear yet. That's okay — arrive slowly." },
  { score: 6,  word: "Settled", desc: "A quiet middle. Neither pulled up nor down." },
  { score: 8,  word: "Open",    desc: "A little more room to breathe today." },
  { score: 10, word: "Bright",  desc: "Something inside is lighter — let it be noticed." },
] as const;

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

const INTENTS = [
  {
    title: "I want to text or check someone",
    body: "Ten minutes with yourself first. No streaks, no shame.",
    to: "/urge-shield" as const,
    icon: MessageSquareOff,
    tint: "var(--amber)",
  },
  {
    title: "I am overthinking",
    body: "Untangle one loop with InnerMate. Slow, gentle, brief.",
    to: "/companion" as const,
    icon: Brain,
    tint: "var(--lavender)",
  },
  {
    title: "Calm me down now",
    body: "A 60-second breath, grounding, or the SOS toolbox.",
    to: "/sos" as const,
    icon: Wind,
    tint: "var(--sky)",
  },
] as const;

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
  const tod = hour == null ? null : greetingFor(hour);
  const isEvening = hour != null && (hour >= 20 || hour < 4);
  const firstName = p?.display_name?.split(" ")[0];
  const weekStart = currentWeekStartISO();
  const arc = m ? moodsToWeekArc(m as { created_at: string; mood_score: number | null }[], weekStart) : null;
  const arcHasAny = !!arc && arc.some((v) => v != null);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      {/* Eyebrow + SOS pill */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
          my quiet space
        </p>
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
      </div>

      {/* Hero */}
      <h1 className="mt-4 font-serif text-[2.05rem] font-light leading-[1.08] tracking-tight sm:text-[2.5rem]">
        Come here before<br className="hidden sm:inline" /> you react{firstName ? `, ${firstName}` : ""}.
      </h1>
      <p className="mt-3 max-w-[34ch] text-[15px] leading-relaxed text-muted-foreground">
        {tod?.sub ?? "A quiet place, ready when you are."} A quiet room for the moment between feeling something and doing something about it.
      </p>

      {/* How are you arriving today? */}
      <MoodOrbs alreadyLogged={!!todayMood} />

      {/* What is heavy on your mind — quick scratch to journal */}
      <HeavyOnMind />

      {/* Or begin from a feeling — deep-links into InnerMate */}
      <div className="mt-8">
        <p className="text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
          or begin from a feeling
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {FEELING_CHIPS.map((c) => (
            <Link
              key={c.label}
              to="/companion"
              search={{ seed: c.seed }}
              className="group flex items-center gap-2.5 rounded-2xl border border-white/10 bg-card/50 px-3.5 py-3 text-[13px] text-foreground/90 backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-white/20"
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: c.tint, boxShadow: `0 0 10px ${c.tint}` }}
              />
              <span className="leading-snug">{c.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Quiet secondary intents (kept from before) */}
      <p className="mt-10 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
        or a small ritual
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {INTENTS.map((it) => (
          <Link key={it.title} to={it.to} className="block">
            <TactileCard tint={tintName(it.tint)} className="h-full transition hover:-translate-y-0.5">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ background: `color-mix(in oklab, ${it.tint} 45%, transparent)` }}
              >
                <it.icon className="h-4 w-4" />
              </span>
              <p className="mt-3 font-serif text-[17px] leading-snug">{it.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{it.body}</p>
              <p className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
                Open <ArrowRight className="h-3 w-3" />
              </p>
            </TactileCard>
          </Link>
        ))}
      </div>

      {arcHasAny && (
        <div className="mt-10 flex flex-col items-start gap-2 text-foreground/70">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            How the week has moved
          </p>
          <WeekArc days={arc!} className="-ml-1 w-full max-w-xs" />
        </div>
      )}

      <OnThisDay />

      <DailyCheckinReminder />

      <ContinuePath />

      <TactileCard tint="lavender" className="hero-drift mt-9">
        <VerseQuote initial={dailyVerse()} rotate variant="plain" />
        <Link to="/reflect" className="mt-5 soft-arrow">
          Begin a quiet reflection <ArrowRight className="h-4 w-4" />
        </Link>
      </TactileCard>

      <LetterWaiting enabled={!!(p as { weekly_letter_enabled?: boolean } | null | undefined)?.weekly_letter_enabled} />

      {isEvening && (
        <Link to="/wind-down" className="mt-6 block">
          <TactileCard tint="lavender" className="transition hover:-translate-y-0.5">
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background/70">
                <Moon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="font-serif text-xl leading-snug">A wind-down before sleep.</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Three breaths, and one thing you'd like to set down. Under two minutes.
                </p>
              </div>
            </div>
          </TactileCard>
        </Link>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link to="/checkin" className="block">
          <TactileCard tint="sky" className="h-full transition hover:-translate-y-0.5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Today's check-in</p>
            <p className={`mt-2 font-serif text-2xl ${privacy ? "blur-sm select-none" : ""}`}>
              {todayMood ? `${todayMood.mood_score}/10` : "Not yet"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {todayMood ? "Add another, if something shifted." : "One minute. No right answer."}
            </p>
          </TactileCard>
        </Link>
        <Link to="/journal" className="block">
          <TactileCard tint="mint" className="h-full transition hover:-translate-y-0.5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Last journal</p>
            <p className={`mt-2 font-serif text-lg leading-snug line-clamp-2 ${privacy ? "blur-sm select-none" : ""}`}>
              {j?.[0]?.title || j?.[0]?.body?.slice(0,80) || "Your page is waiting."}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{j?.length ?? 0} entries · write whenever</p>
          </TactileCard>
        </Link>
      </div>

      <div className="mt-10 flex items-center gap-3">
        <p className="font-serif text-lg">Or something smaller</p>
        <div className="h-px flex-1 bg-border/60" />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SmallTile to="/journal" icon={Heart} label="I miss someone" tint="var(--rose)" />
        <SmallTile to="/heal" icon={HeartHandshake} label="A gentle path" tint="var(--sky)" />
        <SmallTile to="/sos" icon={Moon} label="Calm me down" tint="var(--sky)" />
      </div>

      <p className="mt-12 text-center text-[13px] italic text-muted-foreground">
        Whatever today is, you're allowed to meet it slowly.
      </p>
    </div>
  );
}

function tintName(v: string): "amber" | "lavender" | "mint" | "sky" | "rose" {
  if (v.includes("amber")) return "amber";
  if (v.includes("lavender")) return "lavender";
  if (v.includes("mint")) return "mint";
  if (v.includes("rose")) return "rose";
  return "sky";
}

function SmallTile({ to, icon: Icon, label, tint }: { to: "/journal"|"/heal"|"/sos"; icon: typeof Heart; label: string; tint: string }) {
  return (
    <Link to={to} className="tactile flex items-center gap-3 p-4 text-sm transition hover:-translate-y-0.5">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: `color-mix(in oklab, ${tint} 45%, transparent)` }}
      >
        <Icon className="h-4 w-4 text-foreground" />
      </span>
      {label}
    </Link>
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
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Continue · {path.title} · Day {step.day}
            </p>
            <p className="mt-1.5 font-serif text-xl leading-snug">{step.title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground line-clamp-2">{step.preview}</p>
            <p className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
              Open today's step <ArrowRight className="h-3 w-3" />
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
              <p className="font-serif text-xl leading-snug">Your weekly letter is ready.</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Open it when you have a quiet minute.
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
            <p className="font-serif text-xl leading-snug">Create your weekly letter.</p>
            {!expanded ? (
              <>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Turn this week's check-ins and reflections into a gentle letter. It's created when you open it.
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
    <div className="mt-6">
      <TactileCard tint="amber" className="relative">
        <button
          aria-label="Dismiss this memory card"
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
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{when}</p>
            <p className="mt-1.5 font-serif text-[17px] leading-snug italic text-foreground/85">
              {kindLabel} — {preview}
            </p>
            <Link to={to} className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              Visit it <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </TactileCard>
    </div>
  );
}

// ── New home widgets ────────────────────────────────────────────

function MoodOrbs({ alreadyLogged }: { alreadyLogged: boolean }) {
  const qc = useQueryClient();
  const logFn = useServerFn(logMood);
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const chosen = MOOD_ORBS.find((o) => o.score === selected) ?? null;

  const pick = async (score: number) => {
    if (saving || alreadyLogged) {
      setSelected(score);
      return;
    }
    setSelected(score);
    setSaving(true);
    try {
      await logFn({ data: { mood_score: score, emotion_tags: [], trigger_tags: [] } });
      qc.invalidateQueries({ queryKey: ["moods"] });
      toast.success("Kept.", { duration: 1500 });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="mt-6 rounded-3xl border border-white/10 bg-card/55 p-5 backdrop-blur-xl rise-in"
      style={{ boxShadow: "0 20px 54px -34px oklch(0 0 0 / 0.7)" }}
    >
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        how are you arriving today?
      </p>
      <div className="mt-4 flex items-center justify-between gap-1.5">
        {MOOD_ORBS.map((o) => (
          <button
            key={o.score}
            type="button"
            onClick={() => pick(o.score)}
            aria-label={o.word}
            aria-pressed={selected === o.score}
            className="flex flex-1 items-center justify-center bg-transparent py-1 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-full"
          >
            <span className={`qs-orb ${selected === o.score ? "qs-orb--selected" : ""}`} />
          </button>
        ))}
      </div>
      <div className="mt-2 flex justify-between px-1 text-[11px] text-muted-foreground">
        <span>heavy</span>
        <span>light</span>
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
            <p className="mt-0.5 text-[12px] text-muted-foreground leading-snug">{chosen.desc}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function HeavyOnMind() {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveJournal);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [kept, setKept] = useState(false);

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
      <div className="mt-3 flex items-center justify-between">
        {kept ? (
          <span className="quiet-kept text-[12px] italic text-muted-foreground">Kept in your journal.</span>
        ) : (
          <span className="text-[11px] text-muted-foreground">Saves quietly to your journal.</span>
        )}
        <Button
          type="button"
          onClick={save}
          disabled={saving || !value.trim()}
          className="rounded-full"
          size="sm"
        >
          <PenLine className="mr-1 h-3.5 w-3.5" />
          {saving ? "Keeping…" : "Keep this"}
        </Button>
      </div>
    </div>
  );
}