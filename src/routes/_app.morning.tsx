import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sunrise, ArrowRight } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { istDayOfMonth } from "@/lib/ist";
import { tx } from "@/lib/i18n-strings";
import { MORNING_POSTURES, morningLineFor, saveMorningPosture } from "@/lib/morning";
import { Input } from "@/components/ui/input";

/**
 * THE MORNING, GENTLY BEGUN — the dawn bookend to /wind-down. You choose a
 * tone for the day (not a task); it's saved device-local for today only and
 * carried quietly on Home, then it clears. Nothing tracked, nothing scored.
 */
export const Route = createFileRoute("/_app/morning")({
  component: Morning,
  head: () => ({
    meta: [
      { title: "A gentle start | My Quiet Space" },
      { name: "description", content: "Before the day asks anything of you — choose how you want to meet it. A tone, not a task." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function Morning() {
  const lang = useLang();
  const [line, setLine] = useState("");
  const [own, setOwn] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);

  // Client-only: the opening line is deterministic per calendar day, and
  // Date is read in an effect so SSR never disagrees with hydration.
  useEffect(() => {
    setLine(morningLineFor(istDayOfMonth()));
  }, []);

  const choose = (echo: string) => {
    saveMorningPosture(echo, new Date());
    setChosen(echo);
  };
  const chooseOwn = () => {
    const v = own.trim();
    if (!v) return;
    saveMorningPosture(v, new Date());
    setChosen(v);
  };

  const hair = { borderColor: "var(--border-subtle)" } as const;

  if (chosen) {
    return (
      <div
        ref={(el) => el?.focus()}
        tabIndex={-1}
        role="status"
        className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-5 py-14 text-center outline-none"
      >
        <Sunrise className="h-6 w-6" strokeWidth={1.6} style={{ color: "var(--lamp)" }} aria-hidden="true" />
        <p className="mt-5 max-w-md font-serif text-[26px] font-light leading-snug">{tx(lang, chosen)}</p>
        <p className="mt-4 max-w-sm text-[13.5px] leading-relaxed text-muted-foreground">
          {tx(lang, "Carried. It'll wait quietly on Today, just for you, and let go by tomorrow.")}
        </p>
        <Link to="/home" className="qs-pill-cta mt-9 inline-flex items-center gap-2">
          {tx(lang, "into the day")}
          <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-12 sm:py-16">
      <Link to="/home" className="inline-flex min-h-11 items-center gap-1.5 text-[13px] text-muted-foreground transition hover:text-foreground">
        {tx(lang, "not now")}
      </Link>

      <p className="qs-section-label mt-8">{tx(lang, "the first light · a gentle start")}</p>
      <h1 className="mt-3 font-serif text-[2rem] font-light leading-tight tracking-tight">
        {tx(lang, "How do you want to meet today?")}
      </h1>
      {line && (
        <p className="font-reading mt-4 max-w-md text-[16px] italic leading-relaxed text-foreground/80">
          {tx(lang, line)}
        </p>
      )}
      <p className="mt-3 max-w-md text-[13px] leading-relaxed text-muted-foreground">
        {tx(lang, "Pick a way, or write your own. It's a tone, not a task — nothing to keep or prove.")}
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {MORNING_POSTURES.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => choose(p.echo)}
            className="qs-chip min-h-11"
          >
            {tx(lang, p.key)}
          </button>
        ))}
      </div>

      <div className="mt-8 border-t pt-6" style={hair}>
        <label htmlFor="morning-own" className="text-[13px] text-muted-foreground">{tx(lang, "in my own words")}</label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input
            id="morning-own"
            value={own}
            onChange={(e) => setOwn(e.target.value)}
            maxLength={80}
            placeholder={tx(lang, "today, I want to be…")}
            className="h-11 max-w-xs rounded-xl"
            onKeyDown={(e) => { if (e.key === "Enter") chooseOwn(); }}
          />
          <button
            type="button"
            onClick={chooseOwn}
            disabled={!own.trim()}
            className="inline-flex min-h-11 items-center rounded-full border px-4 text-[13.5px] transition hover:brightness-110 disabled:opacity-50"
            style={hair}
          >
            {tx(lang, "carry it")}
          </button>
        </div>
      </div>
    </div>
  );
}
