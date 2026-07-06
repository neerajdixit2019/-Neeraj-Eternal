import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPaths } from "@/lib/data.functions";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_app/heal")({
  component: HealList,
  head: () => ({
    meta: [
      { title: "Healing paths — gentle daily steps | My Quiet Space" },
      { name: "description", content: "Short, structured paths for heartbreak, overthinking, social comparison, night calm, and loneliness. One quiet step a day." },
      { property: "og:title", content: "Healing paths — gentle daily steps" },
      { property: "og:description", content: "Short paths for heartbreak, overthinking, loneliness, and more — one quiet step a day." },
      { property: "og:url", content: "https://neeraj2019.lovable.app/heal" },
    ],
    links: [{ rel: "canonical", href: "https://neeraj2019.lovable.app/heal" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Healing paths",
          description: "Short structured paths to help with heartbreak, overthinking, comparison, night calm, and loneliness.",
          url: "https://neeraj2019.lovable.app/heal",
        }),
      },
    ],
  }),
});

type Mood = {
  teaser: string;
  forWhom: string;
  minutes: string;
  tint: string;
  ring: string;
  dotOn: string;
  dotOff: string;
  glyph: React.ReactNode;
};

const MOODS: Record<string, Mood> = {
  heartbreak: {
    teaser: "for the days the missing comes in waves.",
    forWhom: "for when you're ready to feel it, not fix it",
    minutes: "~5 min a day",
    tint: "linear-gradient(140deg, color-mix(in oklab, var(--rose) 22%, var(--card)) 0%, color-mix(in oklab, var(--sand) 14%, var(--card)) 60%, var(--card) 100%)",
    ring: "color-mix(in oklab, var(--rose) 35%, transparent)",
    dotOn: "var(--rose)",
    dotOff: "color-mix(in oklab, var(--rose) 22%, transparent)",
    glyph: (
      <svg viewBox="0 0 48 48" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M24 38c-7-4.5-13-9.5-13-17a7 7 0 0 1 13-3.7A7 7 0 0 1 37 21c0 7.5-6 12.5-13 17z" />
      </svg>
    ),
  },
  overthinking: {
    teaser: "for the 2am loop you can't switch off.",
    forWhom: "for when your mind keeps writing scripts you didn't ask for",
    minutes: "~6 min a day",
    tint: "linear-gradient(140deg, color-mix(in oklab, var(--mint) 22%, var(--card)) 0%, color-mix(in oklab, var(--sand) 12%, var(--card)) 60%, var(--card) 100%)",
    ring: "color-mix(in oklab, var(--mint) 40%, transparent)",
    dotOn: "var(--mint)",
    dotOff: "color-mix(in oklab, var(--mint) 22%, transparent)",
    glyph: (
      <svg viewBox="0 0 48 48" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M10 28c4-3 6 3 10 0s6 3 10 0 6 3 10 0" />
        <path d="M10 20c4-3 6 3 10 0s6 3 10 0 6 3 10 0" />
      </svg>
    ),
  },
  social: {
    teaser: "for the scroll that quietly drains you.",
    forWhom: "for when your feed has started feeling louder than your life",
    minutes: "~4 min a day",
    tint: "linear-gradient(140deg, color-mix(in oklab, var(--lavender) 22%, var(--card)) 0%, color-mix(in oklab, var(--sky) 14%, var(--card)) 60%, var(--card) 100%)",
    ring: "color-mix(in oklab, var(--lavender) 40%, transparent)",
    dotOn: "var(--lavender)",
    dotOff: "color-mix(in oklab, var(--lavender) 22%, transparent)",
    glyph: (
      <svg viewBox="0 0 48 48" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="24" cy="24" r="14" />
        <circle cx="24" cy="24" r="7" />
        <circle cx="24" cy="24" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  night: {
    teaser: "for restless evenings and a too-loud head.",
    forWhom: "for the hour before sleep",
    minutes: "~7 min a day",
    tint: "linear-gradient(140deg, color-mix(in oklab, var(--sky) 28%, var(--card)) 0%, color-mix(in oklab, var(--lavender) 18%, var(--card)) 60%, var(--card) 100%)",
    ring: "color-mix(in oklab, var(--sky) 45%, transparent)",
    dotOn: "var(--sky)",
    dotOff: "color-mix(in oklab, var(--sky) 22%, transparent)",
    glyph: (
      <svg viewBox="0 0 48 48" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M34 30a12 12 0 1 1-16-16 10 10 0 0 0 16 16z" />
      </svg>
    ),
  },
  loneliness: {
    teaser: "for the kind of quiet that aches.",
    forWhom: "for when connection feels far away — starting with yourself",
    minutes: "~5 min a day",
    tint: "linear-gradient(140deg, color-mix(in oklab, var(--amber) 22%, var(--card)) 0%, color-mix(in oklab, var(--rose) 12%, var(--card)) 60%, var(--card) 100%)",
    ring: "color-mix(in oklab, var(--amber) 40%, transparent)",
    dotOn: "var(--amber)",
    dotOff: "color-mix(in oklab, var(--amber) 22%, transparent)",
    glyph: (
      <svg viewBox="0 0 48 48" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 30c0-4 4-7 10-7s10 3 10 7" />
        <circle cx="18" cy="18" r="3.5" />
        <circle cx="30" cy="18" r="3.5" />
      </svg>
    ),
  },
};

const FALLBACK: Mood = {
  teaser: "a small, kind practice.",
  forWhom: "for when you need a soft place to begin",
  minutes: "~5 min a day",
  tint: "linear-gradient(140deg, color-mix(in oklab, var(--lavender) 18%, var(--card)) 0%, var(--card) 100%)",
  ring: "color-mix(in oklab, var(--lavender) 35%, transparent)",
  dotOn: "var(--primary)",
  dotOff: "color-mix(in oklab, var(--primary) 20%, transparent)",
  glyph: null,
};

function moodFor(theme: string): Mood {
  return MOODS[theme] ?? FALLBACK;
}

function HealList() {
  const fn = useServerFn(listPaths);
  const { data } = useQuery({ queryKey: ["paths"], queryFn: () => fn() });

  const inProgress = data?.paths
    .map(p => {
      const prog = data.progress.find(x => x.path_id === p.id);
      const done = prog?.completed_steps.length ?? 0;
      if (!prog || done === 0 || done >= p.duration_days) return null;
      const current = data.currentSteps?.[p.id] ?? null;
      return { path: p, done, current };
    })
    .filter((x): x is { path: typeof data.paths[number]; done: number; current: { day: number; title: string; preview: string } | null } => x !== null)
    .sort((a, b) => b.done - a.done)[0] ?? null;

  return (
    <div className="motion-calm mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">For the tender days</p>
      <h1 className="mt-3 font-serif text-3xl leading-tight sm:text-[2.6rem]">Take it slow. You're allowed.</h1>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
        These aren't programs or fixes — just small, kind things to try, one
        quiet day at a time. Start one, pause it, come back later. Your pace.
      </p>

      {inProgress && (
        <div
          className="mt-10 overflow-hidden rounded-[28px] border p-7 sm:p-8"
          style={{
            background: moodFor(inProgress.path.theme).tint,
            borderColor: moodFor(inProgress.path.theme).ring,
            boxShadow: "0 20px 50px -28px color-mix(in oklab, var(--foreground) 22%, transparent)",
          }}
        >
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Where you left off</p>
          <h2 className="mt-2 font-serif text-2xl sm:text-[1.7rem]">{inProgress.path.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Day {inProgress.current?.day ?? inProgress.done + 1} of {inProgress.path.duration_days}
            {inProgress.current ? ` · ${inProgress.current.title}` : ""}
          </p>
          {inProgress.current && (
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed">
              {inProgress.current.preview}
            </p>
          )}
          <Link
            to="/heal/$slug"
            params={{ slug: inProgress.path.slug }}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
          >
            Continue today's step <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {!inProgress && (
        <p className="mt-8 rounded-2xl border border-dashed border-border/70 px-5 py-4 text-sm text-muted-foreground">
          Nothing started yet — these are here whenever you need them.
        </p>
      )}

      <div className="mt-10 flex items-center gap-3">
        <p className="font-serif text-lg">A few quiet paths</p>
        <div className="h-px flex-1 bg-border/60" />
      </div>

      <div className="mt-6 grid gap-5">
        {data?.paths.map(p => {
          const mood = moodFor(p.theme);
          const prog = data.progress.find(x => x.path_id === p.id);
          const done = prog?.completed_steps.length ?? 0;
          const started = done > 0;
          const finished = done >= p.duration_days;
          const first = data.firstSteps?.[p.id];
          const stateLine = finished
            ? "You finished this. Revisit anytime."
            : started
              ? `Continue — day ${done + 1} of ${p.duration_days}`
              : "Begin when you're ready";

          return (
            <Link
              key={p.id}
              to="/heal/$slug"
              params={{ slug: p.slug }}
              className="group relative block overflow-hidden rounded-[28px] border p-7 transition hover:-translate-y-0.5 sm:p-8"
              style={{
                background: mood.tint,
                borderColor: mood.ring,
                boxShadow: "0 16px 40px -30px color-mix(in oklab, var(--foreground) 30%, transparent)",
              }}
            >
              <div className="absolute right-6 top-6 text-foreground/55 transition group-hover:text-foreground/80">
                {mood.glyph}
              </div>

              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{p.theme}</p>
              <p className="mt-2 max-w-[22rem] text-sm italic text-foreground/70">{mood.teaser}</p>

              <h3 className="mt-3 font-serif text-2xl sm:text-[1.6rem]">{p.title}</h3>
              <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-muted-foreground">
                {p.description}
              </p>

              {first && (
                <div
                  className="mt-5 rounded-2xl border px-4 py-3.5"
                  style={{
                    background: "color-mix(in oklab, var(--card) 70%, transparent)",
                    borderColor: "color-mix(in oklab, var(--border) 60%, transparent)",
                  }}
                >
                  <p className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
                    Day 1 begins with
                  </p>
                  <p className="mt-1.5 font-serif text-[17px] leading-snug">{first.title}</p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{first.preview}</p>
                </div>
              )}

              <p className="mt-5 text-[12px] text-muted-foreground">
                {mood.minutes} · {p.duration_days} gentle days · {mood.forWhom}
              </p>

              <div className="mt-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: p.duration_days }).map((_, i) => {
                    const filled = i < done;
                    return (
                      <span
                        key={i}
                        className="h-2 w-2 rounded-full transition"
                        style={{ background: filled ? mood.dotOn : mood.dotOff }}
                      />
                    );
                  })}
                </div>
                <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground/80 transition group-hover:text-foreground">
                  {stateLine}
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <p className="mt-12 text-center text-[13px] italic text-muted-foreground">
        Missing a day is part of healing too. Nothing here keeps score.
      </p>
    </div>
  );
}