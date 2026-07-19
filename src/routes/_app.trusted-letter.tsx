import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listLetterWindow, getProfile } from "@/lib/data.functions";
import { buildTrustedLetterPdf, type TrustedLetterInput, type TrustedMoodOverview } from "@/lib/trusted-letter";
import { FairCopySheet } from "@/components/FairCopySheet";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, FileDown, Printer } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { tx } from "@/lib/i18n-strings";

/**
 * THE LETTER YOU HAND SOMEONE — a consent-first export for a therapist or
 * trusted person. Everything is opt-IN and defaults to off; journal pages
 * are picked one by one; AI conversations and memories cannot be included
 * (the builder has no field for them, and the page says so). The result is
 * a PDF the user downloads and hands over themselves — the app sends
 * nothing and keeps no copy.
 */
export const Route = createFileRoute("/_app/trusted-letter")({
  component: TrustedLetter,
  head: () => ({
    meta: [
      { title: "A letter for someone you trust | My Quiet Space" },
      { name: "description", content: "Compose a consent-first summary — chosen piece by piece — to hand to a therapist or trusted person yourself." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type MoodRow = {
  created_at: string;
  mood_score: number | null;
  emotion_tags?: string[] | null;
  trigger_tags?: string[] | null;
};
type JournalRow = {
  id: string;
  title: string | null;
  body: string | null;
  created_at: string;
};

const WINDOWS = [
  { key: "2w", days: 14, label: "the last two weeks" },
  { key: "1m", days: 30, label: "the last month" },
  { key: "3m", days: 90, label: "the last three months" },
] as const;
type WindowKey = (typeof WINDOWS)[number]["key"];

function topCounts(rows: MoodRow[], field: "emotion_tags" | "trigger_tags", n: number): [string, number][] {
  const counts = new Map<string, number>();
  for (const r of rows) for (const t of r[field] ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

function TrustedLetter() {
  const lang = useLang();
  const profileFn = useServerFn(getProfile);
  const windowFn = useServerFn(listLetterWindow);
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });

  const [forName, setForName] = useState("");
  const [windowKey, setWindowKey] = useState<WindowKey>("2w");
  const [includeMood, setIncludeMood] = useState(false);
  const [includePatterns, setIncludePatterns] = useState(false);
  const [chosenIds, setChosenIds] = useState<Set<string>>(new Set());
  const [personalNote, setPersonalNote] = useState("");
  const [signedAs, setSignedAs] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [printInput, setPrintInput] = useState<TrustedLetterInput | null>(null);

  const windowDef = WINDOWS.find((w) => w.key === windowKey)!;
  const { data: win } = useQuery({
    queryKey: ["letter-window", windowKey],
    queryFn: () => windowFn({ data: { days: windowDef.days } }),
  });

  const windowMoods = (win?.moods ?? []) as MoodRow[];
  const windowJournal = useMemo(
    () => ((win?.journal ?? []) as JournalRow[]).filter((j) => (j.body ?? "").trim()),
    [win],
  );

  // The letter is signed only with a name the user can see and change here —
  // the app-stored display name never reaches it unseen.
  const profileName = ((profile as { display_name?: string | null } | null | undefined)?.display_name ?? "").trim();
  const signedValue = signedAs ?? profileName;

  const toggleEntry = (id: string) =>
    setChosenIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Ticks survive window switches, but only pages inside the current window
  // count — on screen and in the letter alike.
  const chosenInWindow = useMemo(
    () => windowJournal.filter((j) => chosenIds.has(j.id)),
    [windowJournal, chosenIds],
  );

  const anythingChosen =
    includeMood || includePatterns || chosenInWindow.length > 0 || personalNote.trim().length > 0;

  // Honesty about Hindi in PDFs: the embedded font makes Devanagari legible,
  // but jsPDF has no Indic shaping, so matras can sit slightly off.
  const hasHindiContent = /[ऀ-ॿ]/.test(
    signedValue + forName + personalNote + chosenInWindow.map((j) => `${j.title ?? ""}${j.body ?? ""}`).join(""),
  );

  // One composition for both renderings: the downloaded PDF and the
  // browser-typeset fair copy carry exactly the same chosen pieces.
  const composeInput = (): TrustedLetterInput => {
    const scored = windowMoods.filter((m) => typeof m.mood_score === "number");
    const overview: TrustedMoodOverview | null = includeMood
      ? {
          count: windowMoods.length,
          avg: scored.length
            ? scored.reduce((a, m) => a + (m.mood_score as number), 0) / scored.length
            : null,
          topEmotions: topCounts(windowMoods, "emotion_tags", 4),
          topTriggers: topCounts(windowMoods, "trigger_tags", 4),
        }
      : null;
    const patterns = includePatterns
      ? [...topCounts(windowMoods, "emotion_tags", 3), ...topCounts(windowMoods, "trigger_tags", 3)]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([label, count]) => ({ label, count }))
      : null;
    const entries = chosenInWindow
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((j) => ({ created_at: j.created_at, title: j.title, body: (j.body ?? "").trim() }));
    return {
      preparedBy: signedValue.trim() || null,
      forName,
      windowLabel: tx(lang, windowDef.label),
      personalNote,
      moodOverview: overview,
      patterns: patterns && patterns.length ? patterns : null,
      journalEntries: entries,
    };
  };

  // The fair copy: mount the print sheet, open the print dialog once the
  // commit has landed, and unmount when the dialog closes. A timer, not
  // rAF: rAF is throttled to zero in hidden documents and would strand
  // the sheet; print rendering only needs the DOM committed, not painted.
  useEffect(() => {
    if (!printInput) return;
    // afterprint is the clean signal, but some mobile browsers skip it when
    // the dialog is cancelled — regaining focus is the belt-and-braces so
    // the print button can never wedge disabled. Both just clear the sheet.
    const done = () => setPrintInput(null);
    window.addEventListener("afterprint", done);
    window.addEventListener("focus", done);
    const t = window.setTimeout(() => window.print(), 50);
    return () => {
      window.removeEventListener("afterprint", done);
      window.removeEventListener("focus", done);
      window.clearTimeout(t);
    };
  }, [printInput]);

  const printFairCopy = () => {
    if (!anythingChosen || printInput) return;
    setPrintInput(composeInput());
  };

  const prepare = () => {
    if (!anythingChosen || preparing) return;
    setPreparing(true);
    try {
      const blob = buildTrustedLetterPdf(composeInput(), lang);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `a-letter-about-how-ive-been-${stamp}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(tx(lang, "Prepared. It downloaded to your device — you choose who holds it."));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPreparing(false);
    }
  };

  const hair = { borderColor: "var(--border-subtle)" } as const;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
      <Link to="/you" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition hover:text-foreground">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.7} /> {tx(lang, "back to you")}
      </Link>

      <p className="qs-section-label mt-8">{tx(lang, "the keeping of this place")}</p>
      <h1 className="mt-3 font-serif text-[2rem] font-light leading-tight tracking-tight">
        {tx(lang, "A letter you hand over yourself.")}
      </h1>
      <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-muted-foreground">
        {tx(lang, "For a therapist, a parent, someone who asked how you've really been. You choose every piece that goes in. The app sends nothing and keeps no copy — the letter downloads to your device, and handing it over is yours to do.")}
      </p>

      {/* who it's for */}
      <div className="mt-8 border-t pt-6" style={hair}>
        <label htmlFor="tl-for" className="font-serif text-[16px] font-light">{tx(lang, "Who is it for?")}</label>
        <p className="mt-1 text-[12.5px] text-muted-foreground">{tx(lang, "Optional — a name makes it a letter, not a report.")}</p>
        <Input
          id="tl-for"
          value={forName}
          onChange={(e) => setForName(e.target.value)}
          maxLength={80}
          placeholder={tx(lang, "Dr. Mehta, Maa, a friend…")}
          className="mt-2.5 h-11 max-w-sm rounded-xl"
        />
      </div>

      {/* the name it carries */}
      <div className="mt-6 border-t pt-6" style={hair}>
        <label htmlFor="tl-signed" className="font-serif text-[16px] font-light">{tx(lang, "The name it carries")}</label>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          {tx(lang, "Prefilled from your name here, so nothing goes in unseen. Change it, or clear it to leave the letter unsigned.")}
        </p>
        <Input
          id="tl-signed"
          value={signedValue}
          onChange={(e) => setSignedAs(e.target.value)}
          maxLength={80}
          placeholder={tx(lang, "left empty, the letter stays unsigned")}
          className="mt-2.5 h-11 max-w-sm rounded-xl"
        />
      </div>

      {/* the window */}
      <div className="mt-6 border-t pt-6" style={hair}>
        <p className="font-serif text-[16px] font-light">{tx(lang, "Which stretch of time?")}</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              type="button"
              aria-pressed={windowKey === w.key}
              onClick={() => setWindowKey(w.key)}
              className={`qs-chip min-h-11 ${windowKey === w.key ? "qs-chip--active" : ""}`}
            >
              {tx(lang, w.label)}
            </button>
          ))}
        </div>
      </div>

      {/* opt-in slices */}
      <div className="mt-6 border-t pt-6" style={hair}>
        <p className="font-serif text-[16px] font-light">{tx(lang, "What may go in?")}</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">{tx(lang, "Everything starts unticked. Only what you choose leaves this page.")}</p>
        <div className="mt-3 space-y-2">
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-4 py-3" style={hair}>
            <input type="checkbox" className="mt-1" checked={includeMood} onChange={(e) => setIncludeMood(e.target.checked)} />
            <span className="text-[14px]">
              <span className="font-medium">{tx(lang, "How my days have felt")}</span>
              <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted-foreground">
                {windowMoods.length} {tx(lang, "check-ins in this window — count, average, the feelings you named most, and what they tended to arrive with. No clinical scores.")}
              </span>
            </span>
          </label>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-4 py-3" style={hair}>
            <input type="checkbox" className="mt-1" checked={includePatterns} onChange={(e) => setIncludePatterns(e.target.checked)} />
            <span className="text-[14px]">
              <span className="font-medium">{tx(lang, "Patterns I've noticed")}</span>
              <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted-foreground">
                {tx(lang, "The handful of feelings and situations that came up most — as observations to talk about, never verdicts.")}
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* journal pages, picked one by one */}
      <div className="mt-6 border-t pt-6" style={hair}>
        <p className="font-serif text-[16px] font-light">{tx(lang, "Journal pages, picked one by one")}</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          {tx(lang, "Your journal stays private by default. Tick only the pages you want this person to read.")}
        </p>
        {windowJournal.length === 0 ? (
          <p className="mt-3 text-[13px] italic text-muted-foreground">{tx(lang, "no pages in this stretch of time.")}</p>
        ) : (
          <div className="mt-3 space-y-1.5">
            {windowJournal.map((j) => {
              const on = chosenIds.has(j.id);
              const firstLine = (j.body ?? "").split("\n")[0].slice(0, 90);
              return (
                <label key={j.id} className="flex min-h-11 cursor-pointer items-start gap-3 border-t px-1 py-3" style={hair}>
                  <input type="checkbox" className="mt-1" checked={on} onChange={() => toggleEntry(j.id)} />
                  <span className="min-w-0 text-[13.5px]">
                    <span className="block text-[11px] text-muted-foreground">
                      {new Date(j.created_at).toLocaleDateString(lang === "hi" ? "hi-IN" : undefined, { month: "short", day: "numeric" })}
                      {j.title?.trim() ? ` · ${j.title.trim()}` : ""}
                    </span>
                    <span className="mt-0.5 block truncate font-serif italic text-foreground/80">{firstLine}</span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
        {chosenInWindow.length > 0 && (
          <p className="mt-2 text-[12px] text-muted-foreground">
            {chosenInWindow.length} {tx(lang, "chosen")}
          </p>
        )}
      </div>

      {/* a note in your own words */}
      <div className="mt-6 border-t pt-6" style={hair}>
        <label htmlFor="tl-note" className="font-serif text-[16px] font-light">{tx(lang, "A note in your own words")}</label>
        <p className="mt-1 text-[12.5px] text-muted-foreground">{tx(lang, "Optional — it opens the letter. What do you want them to understand?")}</p>
        <Textarea
          id="tl-note"
          value={personalNote}
          onChange={(e) => setPersonalNote(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder={tx(lang, "I've been wanting to tell you…")}
          className="font-reading mt-2.5 rounded-xl text-[15px] leading-relaxed"
        />
      </div>

      {/* the never-included note, on paper */}
      <div
        className="mt-7 rounded-[4px] p-5"
        style={{ background: "var(--paper)", color: "var(--ink)", boxShadow: "0 12px 36px rgba(10, 8, 4, 0.45)" }}
      >
        <p className="font-serif text-[13px] italic" style={{ color: "color-mix(in oklab, var(--ink) 66%, var(--paper))" }}>
          {tx(lang, "never in this letter")}
        </p>
        <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "color-mix(in oklab, var(--ink) 80%, var(--paper))" }}>
          {tx(lang, "Your conversations with InnerMate. Your memories. Anything you didn't tick. The letter also says, on its own cover, that every piece was chosen by you.")}
        </p>
      </div>

      {/* the one brass action */}
      <div className="mt-7 flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={prepare}
          disabled={!anythingChosen || preparing}
          className="qs-pill-cta inline-flex items-center gap-2"
        >
          <FileDown className="h-4 w-4" strokeWidth={1.8} />
          {preparing ? tx(lang, "preparing…") : tx(lang, "prepare the letter")}
        </button>
        {!anythingChosen && (
          <p className="text-[12px] italic text-muted-foreground">{tx(lang, "choose at least one piece above, and this will wake up.")}</p>
        )}
        <button
          type="button"
          onClick={printFairCopy}
          disabled={!anythingChosen || !!printInput}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border px-5 py-2 text-[13.5px] transition hover:brightness-110 disabled:opacity-50"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <Printer className="h-4 w-4" strokeWidth={1.7} />
          {tx(lang, "print the fair copy")}
        </button>
        {hasHindiContent && (
          <p className="max-w-md text-[12px] italic leading-relaxed text-muted-foreground">
            {tx(lang, "Hindi in the downloaded PDF is legible but not perfectly typeset — a matra may sit slightly off. For flawless Hindi, print the fair copy: your browser typesets it, and the print dialog can save it as a PDF too.")}
          </p>
        )}
        {printInput && <FairCopySheet input={printInput} />}
      </div>
    </div>
  );
}
