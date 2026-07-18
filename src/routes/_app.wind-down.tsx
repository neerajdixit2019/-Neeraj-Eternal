import { createFileRoute, Link } from "@tanstack/react-router";
import { BreathPacer } from "@/components/BreathPacer";
import { useLang } from "@/lib/i18n";
import { tx } from "@/lib/i18n-strings";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { saveWindDown } from "@/lib/memories.functions";
import { parkingLineFor, parkedEntry } from "@/lib/wind-down";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/wind-down")({
  component: WindDown,
  head: () => ({
    meta: [
      { title: "Wind down | My Quiet Space" },
      { name: "description", content: "A short, gentle wind-down before sleep — a few breaths, and one thing set down or a worry parked till morning." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Phase = "breath" | "write" | "worry" | "rest";
/** Which door was taken, so the closing speaks to it. */
type Path = "release" | "worry";

function WindDown() {
  const lang = useLang();
  const [phase, setPhase] = useState<Phase>("breath");
  const [path, setPath] = useState<Path>("release");
  const [line, setLine] = useState("");
  const [worry, setWorry] = useState("");
  const [parkedLine, setParkedLine] = useState("");
  const [saving, setSaving] = useState(false);
  const save = useServerFn(saveWindDown);

  // Auto-advance breathing after ~45s (4 in / 6 out × ~4.5 cycles).
  useEffect(() => {
    if (phase !== "breath") return;
    const t = setTimeout(() => setPhase("write"), 45000);
    return () => clearTimeout(t);
  }, [phase]);

  const submitLine = async () => {
    const v = line.trim();
    setPath("release");
    if (!v) { setPhase("rest"); return; }
    setSaving(true);
    try {
      await save({ data: { line: v } });
      setPhase("rest");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const parkWorry = async () => {
    const v = worry.trim();
    // Nothing named → nothing parked; the generic release closing is right.
    if (!v) { setPath("release"); setPhase("rest"); return; }
    setPath("worry");
    // The reframe is chosen before any network work, so the room can settle
    // even if saving fails — parking the worry is the point, not the record.
    setParkedLine(parkingLineFor(v));
    setSaving(true);
    try {
      // A parked worry is NOT AI-readable: you chose to stop holding it, so it
      // must not come back as something InnerMate raises later.
      await save({ data: { line: parkedEntry(v), aiReadable: false } });
    } catch {
      /* the worry is parked in the moment regardless of the save */
    } finally {
      setSaving(false);
      setPhase("rest");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6 text-center">
      {/* the drawn window at night — no photograph, no third sky: the same
          nightwall the whole study lives in, with one dawnline horizon */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 112%, color-mix(in oklab, var(--dawnline) 14%, transparent) 0%, transparent 55%)," +
            "linear-gradient(185deg, var(--background-deep) 10%, oklch(0.155 0.03 274) 60%, oklch(0.18 0.028 280) 100%)",
        }}
      />
      <Link to="/home" className="absolute right-5 top-5 inline-flex min-h-11 items-center text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
        {tx(lang, "close")}
      </Link>

      {/* the steady door stays reachable in EVERY phase — the room is a
          fullscreen overlay, and /sos is never blocked, least of all at 2am */}
      <Link
        to="/sos"
        className="absolute inset-x-0 bottom-6 mx-auto inline-flex min-h-11 w-fit items-center text-[13px] underline underline-offset-4 hover:brightness-110"
        style={{ color: "color-mix(in oklab, var(--clay) 60%, var(--muted-foreground))" }}
      >
        {tx(lang, "if it's heavier than a worry — the steady room")}
      </Link>
      <div className="pointer-events-none absolute inset-x-0 top-7 px-16">
        <p className="qs-section-label">{tx(lang, "the anchor · for the end of the day")}</p>
        <h1 className="mt-1.5 font-serif text-lg font-light text-foreground/80">{tx(lang, "Night reset")}</h1>
      </div>

      {phase === "breath" && (
        <div className="flex flex-col items-center">
          <BreathPacer />
          <p className="mt-4 text-sm text-muted-foreground">{tx(lang, "Four in, six out. A few rounds is enough.")}</p>
          <button
            onClick={() => setPhase("write")}
            className="mt-10 min-h-11 text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
          >
            {tx(lang, "Continue")}
          </button>
        </div>
      )}

      {phase === "write" && (
        <div className="w-full max-w-md">
          <p className="font-serif text-2xl leading-snug text-foreground/90">
            {tx(lang, "What's one thing you want to set down before sleep?")}
          </p>
          <Textarea
            value={line}
            onChange={(e) => setLine(e.target.value)}
            aria-label={tx(lang, "One thing to set down before sleep")}
            placeholder={tx(lang, "A sentence. Or none — that's allowed.")}
            maxLength={500}
            rows={3}
            className="mt-6 rounded-2xl border-border/60 bg-background/60 font-serif text-[16px] leading-relaxed"
            disabled={saving}
            autoFocus
          />
          <div className="mt-5 flex items-center justify-center gap-3">
            <Button variant="ghost" className="min-h-11 rounded-full text-muted-foreground" disabled={saving} onClick={() => { setPath("release"); setPhase("rest"); }}>
              {tx(lang, "Nothing tonight")}
            </Button>
            <Button variant="outline" className="min-h-11 rounded-full" disabled={saving} onClick={submitLine}>
              {saving ? tx(lang, "Setting it down…") : tx(lang, "Set it down")}
            </Button>
          </div>
          {/* the other door — for a mind that won't quiet, not just a thought to release */}
          <button
            onClick={() => setPhase("worry")}
            className="mt-7 min-h-11 text-[13px] italic text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            {tx(lang, "the mind won't quiet down?")}
          </button>
        </div>
      )}

      {phase === "worry" && (
        <div className="w-full max-w-md">
          <p className="font-serif text-2xl leading-snug text-foreground/90">
            {tx(lang, "What keeps circling?")}
          </p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
            {tx(lang, "Nothing here has to be solved tonight. Name it, and let it wait for morning.")}
          </p>
          <Textarea
            value={worry}
            onChange={(e) => setWorry(e.target.value)}
            aria-label={tx(lang, "What keeps circling")}
            placeholder={tx(lang, "The thought that won't sit still…")}
            maxLength={500}
            rows={3}
            className="mt-5 rounded-2xl border-border/60 bg-background/60 font-serif text-[16px] leading-relaxed"
            disabled={saving}
            autoFocus
          />
          <div className="mt-5 flex items-center justify-center gap-3">
            <Button variant="ghost" className="min-h-11 rounded-full text-muted-foreground" disabled={saving} onClick={() => setPhase("write")}>
              {tx(lang, "back")}
            </Button>
            <Button variant="outline" className="min-h-11 rounded-full" disabled={saving} onClick={parkWorry}>
              {saving ? tx(lang, "Parking it…") : tx(lang, "Park it till morning")}
            </Button>
          </div>
        </div>
      )}

      {phase === "rest" && (
        <div className="flex flex-col items-center">
          {path === "worry" && parkedLine ? (
            <p className="max-w-md font-serif text-2xl leading-snug text-foreground/90">{tx(lang, parkedLine)}</p>
          ) : (
            <p className="font-serif text-3xl leading-snug text-foreground/90">{tx(lang, "It's held.")}</p>
          )}
          <p className="mt-3 font-serif text-lg italic text-muted-foreground">{tx(lang, "Rest now.")}</p>
          <Link
            to="/home"
            className="mt-12 inline-flex min-h-11 items-center text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
          >
            {tx(lang, "back home")}
          </Link>
        </div>
      )}
    </div>
  );
}
