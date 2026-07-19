import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { listMoods, listJournal, getProfile } from "@/lib/data.functions";
import { listMemories } from "@/lib/data.functions";
import { useLang } from "@/lib/i18n";
import { tx } from "@/lib/i18n-strings";
import { weekSentence } from "@/lib/week-sentence";
import {
  Shield, Settings, BookHeart, Sparkles, HeartHandshake, Star, ArrowRight, Mail,
} from "lucide-react";

/**
 * You — the book's flyleaf: the reader's name inscribed, the honest week as
 * one prose sentence (real counts as margin tallies, never invented
 * percentages), and every doorway as a single table of contents.
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
  const lang = useLang();
  const profileFn = useServerFn(getProfile);
  const moodsFn = useServerFn(listMoods);
  const journalFn = useServerFn(listJournal);
  const memoriesFn = useServerFn(listMemories);
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });
  const { data: moods } = useQuery({ queryKey: ["moods"], queryFn: () => moodsFn() });
  const { data: journal } = useQuery({ queryKey: ["journal"], queryFn: () => journalFn() });
  const { data: memories } = useQuery({ queryKey: ["memories"], queryFn: () => memoriesFn() });

  const name = (profile as { display_name?: string | null } | null | undefined)?.display_name?.trim();
  const week = useMemo(
    () => weekCounts((moods ?? []) as MoodRow[], (journal ?? []) as JournalRow[]),
    [moods, journal],
  );
  const starCount = memories?.length ?? 0;
  const sentence = weekSentence(week, lang);

  const tallies: { value: string; label: string }[] = [
    { value: `${week.daysShowedUp}/7`, label: "days" },
    { value: String(week.checkins), label: "check-ins" },
    { value: String(week.pages), label: "pages" },
    { value: String(starCount), label: "stars" },
  ];

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
      {/* The flyleaf — the reader's name, inscribed */}
      <p className="qs-section-label">{tx(lang, "the flyleaf")}</p>
      <h1 className="mt-3 font-serif text-[2.6rem] font-light leading-[1.08] tracking-tight sm:text-[3.1rem]" style={{ textWrap: "balance" }}>
        {name || tx(lang, "This is your book.")}
      </h1>
      <p className="mt-2 font-serif text-[14px] italic text-muted-foreground">
        {name ? tx(lang, "this book is yours alone.") : tx(lang, "it will learn your name when you offer it.")}
      </p>

      {/* The honest week — one sentence, with the numbers as margin tallies */}
      <p className="font-reading mt-8 max-w-md text-[16.5px] leading-relaxed text-foreground/90">{sentence}</p>
      <div className="mt-4 flex gap-7 border-t pt-3" style={{ borderColor: "var(--border-subtle)" }}>
        {tallies.map((t) => (
          <p key={t.label} className="text-[11px] text-muted-foreground">
            <span className="font-serif text-[15px] not-italic" style={{ color: "var(--accent-secondary)" }}>{t.value}</span>
            <span className="ml-1.5 lowercase tracking-[0.08em]">{tx(lang, t.label)}</span>
          </p>
        ))}
      </div>
      <p className="mt-2 text-[11px] italic text-muted-foreground">
        {tx(lang, "counts, not scores — showing up is the whole metric.")}
      </p>

      {/* Table of contents — every doorway, one ruled list */}
      <p className="qs-section-label mt-10">{tx(lang, "contents")}</p>
      <div className="mt-2">
        <TocRow to="/journal" icon={BookHeart} title={tx(lang, "journal")} line={tx(lang, "your private vault")} />
        <TocRow to="/insights" icon={Sparkles} title={tx(lang, "insights & check-in")} line={tx(lang, "your pattern constellation")} />
        <TocRow to="/heal" icon={HeartHandshake} title={tx(lang, "tools")} line={tx(lang, "practices & gentle paths")} />
        <TocRow to="/memories" icon={Star} title={tx(lang, "memories")} line={tx(lang, "your night sky")} />
        <TocRow to="/home" icon={Mail} title={tx(lang, "weekly letter")} line={tx(lang, "waits on Today when it arrives")} />
      </div>

      {/* The keeping of this place — controls, same ledger */}
      <p className="qs-section-label mt-9">{tx(lang, "the keeping of this place")}</p>
      <div className="mt-2">
        <TocRow
          to="/trusted-letter"
          icon={Mail}
          title={tx(lang, "a letter for someone you trust")}
          line={tx(lang, "a consent-first summary you download and hand over yourself")}
        />
        <TocRow
          to="/privacy"
          icon={Shield}
          title={tx(lang, "privacy & safety")}
          line={tx(lang, "what InnerMate can read, and what delete keeps — in plain language")}
        />
        <TocRow
          to="/settings"
          icon={Settings}
          title={tx(lang, "the sanctuary")}
          line={tx(lang, "settings, memory controls, tone, export & delete")}
        />
      </div>

      <p className="mt-10 text-center font-serif text-[13.5px] italic text-muted-foreground">
        {tx(lang, "growth here is quiet. it counts anyway.")}
      </p>
    </div>
  );
}

function TocRow({ to, icon: Icon, title, line }: {
  to: "/journal" | "/insights" | "/heal" | "/memories" | "/home" | "/privacy" | "/settings" | "/trusted-letter";
  icon: typeof Shield; title: string; line: string;
}) {
  return (
    <Link
      to={to}
      className="group flex min-h-11 items-center gap-3.5 border-t px-1 py-3 transition"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.7} style={{ color: "var(--text-secondary)" }} />
      <div className="min-w-0">
        <p className="text-[14.5px] text-foreground/90 transition group-hover:text-foreground">{title}</p>
        <p className="text-[11.5px] text-muted-foreground">{line}</p>
      </div>
      <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition group-hover:translate-x-0.5" />
    </Link>
  );
}
