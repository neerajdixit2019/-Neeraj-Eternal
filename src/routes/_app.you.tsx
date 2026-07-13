import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { listMoods, listJournal, getProfile } from "@/lib/data.functions";
import { listMemories } from "@/lib/data.functions";
import { TactileCard } from "@/components/TactileCard";
import {
  Shield, Settings, BookHeart, Sparkles, HeartHandshake, Star, ArrowRight, Mail,
} from "lucide-react";

/**
 * You — the growth-journey tab from the reference boards, built on honest
 * numbers only: real week counts (days showed up, check-ins, journal pages),
 * never invented percentages. Growth-area bars from the mock are deliberately
 * omitted (no defensible calculation exists — see docs/redesign/audit.md).
 */
export const Route = createFileRoute("/_app/you")({
  component: YouPage,
  head: () => ({
    meta: [
      { title: "You | My Quiet Space" },
      { name: "description", content: "Your week at a glance, your saved things, and your controls." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type MoodRow = { created_at: string };
type JournalRow = { created_at?: string | null };

function weekCounts(moods: MoodRow[], journal: JournalRow[]) {
  const weekAgo = Date.now() - 7 * 86400000;
  const inWeek = (iso?: string | null) => !!iso && new Date(iso).getTime() >= weekAgo;
  const checkins = moods.filter((m) => inWeek(m.created_at)).length;
  const pages = journal.filter((j) => inWeek(j.created_at)).length;
  const days = new Set<string>();
  for (const m of moods) if (inWeek(m.created_at)) days.add(m.created_at.slice(0, 10));
  for (const j of journal) if (inWeek(j.created_at)) days.add((j.created_at as string).slice(0, 10));
  return { checkins, pages, daysShowedUp: days.size };
}

function YouPage() {
  const profileFn = useServerFn(getProfile);
  const moodsFn = useServerFn(listMoods);
  const journalFn = useServerFn(listJournal);
  const memoriesFn = useServerFn(listMemories);
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });
  const { data: moods } = useQuery({ queryKey: ["moods"], queryFn: () => moodsFn() });
  const { data: journal } = useQuery({ queryKey: ["journal"], queryFn: () => journalFn() });
  const { data: memories } = useQuery({ queryKey: ["memories"], queryFn: () => memoriesFn() });

  const name = (profile as { display_name?: string | null } | null | undefined)?.display_name;
  const initial = (name?.trim()?.[0] ?? "•").toUpperCase();
  const week = useMemo(
    () => weekCounts((moods ?? []) as MoodRow[], (journal ?? []) as JournalRow[]),
    [moods, journal],
  );
  const starCount = memories?.length ?? 0;

  const stats: { value: string; top: string; bottom: string }[] = [
    { value: `${week.daysShowedUp}/7`, top: "Days", bottom: "showed up" },
    { value: String(week.checkins), top: "Check-ins", bottom: "this week" },
    { value: String(week.pages), top: "Pages", bottom: "written" },
    { value: String(starCount), top: "Stars", bottom: "in your sky" },
  ];

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
      {/* Header — You, with a real initial, no stock avatar */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-[2rem] font-light leading-tight tracking-tight">You</h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">your growth journey</p>
        </div>
        <span
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-full font-serif text-lg"
          style={{
            background: "color-mix(in oklab, var(--accent-primary) 22%, var(--card))",
            border: "1px solid var(--border-active)",
            color: "var(--text-primary)",
          }}
        >
          {initial}
        </span>
      </div>

      {/* This week — real counts only */}
      <p className="qs-section-label mt-8">this week</p>
      <div className="mt-3 grid grid-cols-4 gap-2.5">
        {stats.map((s) => (
          <div
            key={s.top}
            className="rounded-2xl border px-2 py-3.5 text-center"
            style={{ borderColor: "var(--border-subtle)", background: "color-mix(in oklab, var(--card) 50%, transparent)" }}
          >
            <p className="font-serif text-[1.35rem] leading-none" style={{ color: "var(--accent-secondary)" }}>{s.value}</p>
            <p className="mt-1.5 text-[10.5px] leading-tight text-foreground/85">{s.top}</p>
            <p className="text-[10px] leading-tight text-muted-foreground">{s.bottom}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 px-1 text-[11px] italic text-muted-foreground">
        counts, not scores — showing up is the whole metric.
      </p>

      {/* Your places — everything that moved off the 4-tab bar stays one tap away */}
      <p className="qs-section-label mt-8">your places</p>
      <div className="mt-3 space-y-2">
        <PlaceRow to="/journal" icon={BookHeart} title="Journal" line="your private vault" />
        <PlaceRow to="/insights" icon={Sparkles} title="Insights & check-in" line="your pattern constellation" />
        <PlaceRow to="/heal" icon={HeartHandshake} title="Tools" line="practices & gentle paths" />
        <PlaceRow to="/memories" icon={Star} title="Memories" line="your night sky" />
        <PlaceRow to="/home" icon={Mail} title="Weekly letter" line="waits on Today when it arrives" />
      </div>

      {/* Privacy & Safety — honest wording, real controls behind it */}
      <Link to="/privacy" className="mt-8 block">
        <TactileCard tint="lavender" className="transition hover:-translate-y-0.5">
          <div className="flex items-center gap-4">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{ background: "color-mix(in oklab, var(--state-privacy) 22%, transparent)" }}
            >
              <Shield className="h-5 w-5" strokeWidth={1.6} style={{ color: "var(--accent-secondary)" }} />
            </span>
            <div className="min-w-0">
              <p className="font-serif text-lg leading-snug">Privacy & Safety</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                Your data stays in your account, and you control what InnerMate can read. Plain-language details inside.
              </p>
            </div>
            <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
        </TactileCard>
      </Link>

      {/* Settings door */}
      <Link
        to="/settings"
        className="glass mt-3 flex items-center gap-4 rounded-3xl p-4 transition hover:-translate-y-0.5"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-background/60">
          <Settings className="h-4.5 w-4.5 h-[18px] w-[18px]" strokeWidth={1.6} />
        </span>
        <div className="min-w-0">
          <p className="font-serif text-lg leading-snug">The Sanctuary</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">settings, memory controls, tone, export & delete</p>
        </div>
        <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>

      <p className="mt-10 text-center font-serif text-[13.5px] italic text-muted-foreground">
        growth here is quiet. it counts anyway.
      </p>
    </div>
  );
}

function PlaceRow({ to, icon: Icon, title, line }: {
  to: "/journal" | "/insights" | "/heal" | "/memories" | "/home";
  icon: typeof Shield; title: string; line: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3.5 rounded-2xl border px-4 py-3 transition hover:-translate-y-0.5"
      style={{ borderColor: "var(--border-subtle)", background: "color-mix(in oklab, var(--card) 45%, transparent)" }}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.7} style={{ color: "var(--text-secondary)" }} />
      <div className="min-w-0">
        <p className="text-[14px] text-foreground/90">{title}</p>
        <p className="text-[11.5px] text-muted-foreground">{line}</p>
      </div>
      <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
    </Link>
  );
}
