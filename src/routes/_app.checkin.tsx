import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { logMood } from "@/lib/data.functions";
import { Textarea } from "@/components/ui/textarea";
import { CompanionCloud } from "@/components/CompanionCloud";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, MessageCircle, Shield, Wind, PenLine, Sparkles } from "lucide-react";

/**
 * The guided check-in journey — the reference images' centerpiece, rebuilt
 * on the app's real contracts:
 *   · mood/emotions/triggers/note save through the SAME logMood call and tag
 *     vocabulary the Insights constellation reads (nothing new to persist)
 *   · "talk it out" hands the check-in to InnerMate through the existing
 *     sessionStorage reflect handoff
 *   · every destination on the personalized path is a real screen
 * Adaptive: light arrivals skip the dig-deeper step; everything is skippable.
 */
export const Route = createFileRoute("/_app/checkin")({
  component: CheckinJourney,
  head: () => ({
    meta: [
      { title: "Check-in | My Quiet Space" },
      { name: "description", content: "A few mindful steps to understand what's happening inside you. Private to you." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

/* Emotion vocabulary — identical to the constellation's tag map so every
   check-in keeps feeding the same patterns. Score = how heavy it lands. */
const STATES: { label: string; score: number; heavy: boolean }[] = [
  { label: "Overwhelmed", score: 2, heavy: true },
  { label: "Anxious", score: 3, heavy: true },
  { label: "Heavy", score: 3, heavy: true },
  { label: "Angry", score: 3, heavy: true },
  { label: "Lonely", score: 3, heavy: true },
  { label: "Numb", score: 4, heavy: true },
  { label: "Confused", score: 5, heavy: true },
  { label: "Calm", score: 8, heavy: false },
  { label: "Hopeful", score: 8, heavy: false },
  { label: "Grateful", score: 9, heavy: false },
];

const TRIGGERS = ["Work", "Relationship", "Family", "Health", "Money", "Memories", "Sleep", "Future"];

/* "At the heart of it" options, adapted to what was selected. */
const HEART_BY_EMOTION: Record<string, string[]> = {
  Anxious: ["Fear of failure", "Uncertainty", "Need for control"],
  Overwhelmed: ["Too much at once", "No room to rest", "Fear of failure"],
  Lonely: ["Feeling unseen", "Missing someone", "Need for reassurance"],
  Angry: ["Feeling ignored", "Something unfair", "A crossed boundary"],
  Heavy: ["Guilt or regret", "Past memories", "Low self-worth"],
  Numb: ["Running on empty", "Avoiding something", "Nothing feels mine"],
  Confused: ["Mixed feelings", "A decision I'm carrying", "Uncertainty"],
};
const HEART_DEFAULT = ["Uncertainty", "Guilt or regret", "Need for reassurance", "Fear of losing someone", "Low self-worth", "Something else"];

/* Core needs — each explains itself and routes somewhere real. */
const NEEDS: { key: string; label: string; line: string; icon: typeof Wind }[] = [
  { key: "calm", label: "Calm", line: "help my body settle first", icon: Wind },
  { key: "clarity", label: "Clarity", line: "help me think this through", icon: Sparkles },
  { key: "listen", label: "Just listen", line: "be here with me, no fixing", icon: MessageCircle },
  { key: "step", label: "A next step", line: "help me decide what to do", icon: ArrowRight },
  { key: "impulse", label: "Stop an impulse", line: "before I text or react", icon: Shield },
  { key: "space", label: "Just save this", line: "putting it down is enough", icon: PenLine },
];

type StepId = "mood" | "deeper" | "mind" | "need" | "summary" | "done";

function CheckinJourney() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const log = useServerFn(logMood);

  const [step, setStep] = useState<StepId>("mood");
  const [emotions, setEmotions] = useState<string[]>([]);
  const [triggers, setTriggers] = useState<string[]>([]);
  const [hearts, setHearts] = useState<string[]>([]);
  const [mind, setMind] = useState("");
  const [need, setNeed] = useState<string | null>(null);
  const [commitment, setCommitment] = useState("");
  const [saving, setSaving] = useState(false);

  const heavyArrival = emotions.some((e) => STATES.find((s) => s.label === e)?.heavy);
  // Adaptive path: light arrivals skip the dig-deeper step entirely.
  const path = useMemo<StepId[]>(
    () => (heavyArrival || emotions.length === 0
      ? ["mood", "deeper", "mind", "need", "summary"]
      : ["mood", "mind", "need", "summary"]),
    [heavyArrival, emotions.length],
  );
  const stepIndex = path.indexOf(step);

  const heartOptions = useMemo(() => {
    const opts = new Set<string>();
    for (const e of emotions) HEART_BY_EMOTION[e]?.forEach((h) => opts.add(h));
    if (opts.size === 0) HEART_DEFAULT.forEach((h) => opts.add(h));
    return [...opts].slice(0, 6);
  }, [emotions]);

  const toggle = (list: string[], set: (v: string[]) => void, item: string, max = 3) =>
    set(list.includes(item) ? list.filter((x) => x !== item) : list.length >= max ? list : [...list, item]);

  const goNext = () => { const i = path.indexOf(step); if (i < path.length - 1) setStep(path[i + 1]); };
  const goBack = () => { const i = path.indexOf(step); if (i > 0) setStep(path[i - 1]); };

  const moodScore = useMemo(() => {
    const scores = emotions.map((e) => STATES.find((s) => s.label === e)?.score ?? 5);
    return scores.length ? Math.min(...scores) : 5;
  }, [emotions]);

  const composedNote = useMemo(() => {
    const parts: string[] = [];
    if (mind.trim()) parts.push(mind.trim());
    if (hearts.length) parts.push(`at the heart: ${hearts.join(", ")}`);
    if (need) parts.push(`needed: ${NEEDS.find((n) => n.key === need)?.label ?? need}`);
    if (commitment.trim()) parts.push(`one small thing: ${commitment.trim()}`);
    return parts.join(" · ").slice(0, 500) || undefined;
  }, [mind, hearts, need, commitment]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await log({ data: {
        mood_score: moodScore,
        emotion_tags: emotions,
        trigger_tags: triggers,
        note: composedNote,
      }});
      qc.invalidateQueries({ queryKey: ["moods"] });
      setStep("done");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const talkItOut = () => {
    const feeling = emotions.length ? `Feeling: ${emotions.join(", ")}.` : "";
    const trig = triggers.length ? ` It seems connected to ${triggers.join(" and ")}.` : "";
    const heart = hearts.length ? ` At the heart of it: ${hearts.join(", ").toLowerCase()}.` : "";
    const mindPart = mind.trim() ? ` What's on my mind: ${mind.trim()}` : "";
    const needPart = need ? ` What I need right now is ${NEEDS.find((n) => n.key === need)?.line ?? need}.` : "";
    const text = `I just finished a check-in. ${feeling}${trig}${heart}${mindPart}${needPart}`.trim();
    try { sessionStorage.setItem("innermate.reflect", text); } catch { /* noop */ }
    navigate({ to: "/companion" });
  };

  /* ── Completion ── */
  if (step === "done") {
    const primary = (() => {
      switch (need) {
        case "calm": return { label: "Begin 60 seconds of calm", to: "/sos" as const };
        case "impulse": return { label: "Open the pause shield", to: "/urge-shield" as const };
        case "space": return { label: "Return to Today", to: "/home" as const };
        default: return null; // clarity / listen / step → talk it out below
      }
    })();
    return (
      <div className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-6 py-12 text-center fade-in">
        <CompanionCloud size={110} state="calm" />
        <p className="qs-section-label mt-6">check-in complete</p>
        <h1 className="mt-3 font-serif text-[1.7rem] font-light leading-snug">
          You showed up for yourself.
        </h1>
        <p className="mt-3 max-w-xs text-[14px] leading-relaxed text-muted-foreground">
          It's saved to your sky — the patterns on Insights already know.
          {commitment.trim() ? ` And you chose one small thing: “${commitment.trim()}”.` : ""}
        </p>
        <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
          {primary ? (
            <Link to={primary.to} className="qs-pill-cta w-full">{primary.label}</Link>
          ) : (
            <button type="button" onClick={talkItOut} className="qs-pill-cta w-full">
              <MessageCircle className="h-4 w-4" strokeWidth={1.7} />
              Talk it out with InnerMate
            </button>
          )}
          {!primary && need !== "space" && (
            <Link to="/home" className="glass inline-flex h-11 w-full items-center justify-center rounded-full text-[13.5px] text-muted-foreground transition hover:text-foreground">
              Return to Today
            </Link>
          )}
          {primary && primary.to !== "/home" && (
            <button type="button" onClick={talkItOut} className="glass inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-[13.5px] text-muted-foreground transition hover:text-foreground">
              <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.7} />
              or talk it out with InnerMate
            </button>
          )}
          <Link to="/insights" className="mt-1 text-[12.5px] text-muted-foreground transition hover:text-foreground">
            view my journey
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-5 py-8 sm:py-12">
      {/* Header: back + adaptive progress */}
      <div className="flex items-center gap-3">
        {stepIndex > 0 ? (
          <button type="button" onClick={goBack} aria-label="Back" className="glass flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
          </button>
        ) : (
          <Link to="/home" aria-label="Back to Today" className="glass flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
          </Link>
        )}
        <div className="flex flex-1 gap-1.5" role="progressbar" aria-valuenow={stepIndex + 1} aria-valuemax={path.length} aria-label="Check-in progress">
          {path.map((p, i) => (
            <span
              key={p}
              className="h-1 flex-1 rounded-full transition-colors duration-300"
              style={{ background: i <= stepIndex ? "var(--accent-primary)" : "oklch(1 0 0 / 0.12)" }}
            />
          ))}
        </div>
        <Link to="/home" className="text-[12px] text-muted-foreground transition hover:text-foreground">exit</Link>
      </div>

      {/* ── Step: mood ── */}
      {step === "mood" && (
        <section className="mt-8 fade-in" aria-labelledby="ci-mood">
          <h1 id="ci-mood" className="font-serif text-[1.65rem] font-light leading-snug">How are you feeling right now?</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
            There's no right or wrong way to feel. Pick up to three.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {STATES.map((s) => {
              const on = emotions.includes(s.label);
              return (
                <button
                  key={s.label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(emotions, setEmotions, s.label)}
                  className="rounded-2xl border px-3 py-3.5 text-[13.5px] transition"
                  style={on
                    ? { background: "var(--surface-selected)", borderColor: "var(--border-active)", color: "var(--text-primary)", fontWeight: 600 }
                    : { background: "color-mix(in oklab, var(--card) 55%, transparent)", borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          <div className="glass mt-5 flex items-center gap-3 rounded-2xl p-3.5">
            <CompanionCloud size={40} state="listening" glow={false} />
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              It's okay to not be okay. Naming it is the first step.
            </p>
          </div>
          <button type="button" onClick={goNext} disabled={emotions.length === 0} className="qs-pill-cta mt-6 w-full disabled:opacity-50">
            Continue
          </button>
          <button type="button" onClick={() => setStep("mind")} className="mt-3 w-full text-center text-[13px] text-muted-foreground transition hover:text-foreground">
            skip for now
          </button>
        </section>
      )}

      {/* ── Step: dig deeper (heavy arrivals only) ── */}
      {step === "deeper" && (
        <section className="mt-8 fade-in" aria-labelledby="ci-deeper">
          <h1 id="ci-deeper" className="font-serif text-[1.65rem] font-light leading-snug">Let's understand it better</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">Optional — pick what fits, skip what doesn't.</p>

          <p className="qs-section-label mt-6">what set it off?</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {TRIGGERS.map((t) => {
              const on = triggers.includes(t);
              return (
                <button key={t} type="button" aria-pressed={on} onClick={() => toggle(triggers, setTriggers, t)} className={`qs-chip ${on ? "qs-chip--active" : ""}`}>
                  {t}
                </button>
              );
            })}
          </div>

          <p className="qs-section-label mt-6">what's at the heart of it?</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {heartOptions.map((h) => {
              const on = hearts.includes(h);
              return (
                <button key={h} type="button" aria-pressed={on} onClick={() => toggle(hearts, setHearts, h, 2)} className={`qs-chip ${on ? "qs-chip--active" : ""}`}>
                  {h}
                </button>
              );
            })}
          </div>

          <button type="button" onClick={goNext} className="qs-pill-cta mt-7 w-full">Continue</button>
          <button type="button" onClick={goNext} className="mt-3 w-full text-center text-[13px] text-muted-foreground transition hover:text-foreground">
            skip this step
          </button>
        </section>
      )}

      {/* ── Step: what's on your mind ── */}
      {step === "mind" && (
        <section className="mt-8 fade-in" aria-labelledby="ci-mind">
          <h1 id="ci-mind" className="font-serif text-[1.65rem] font-light leading-snug">What's on your mind?</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">Write freely. No judgment here.</p>
          <Textarea
            aria-label="What's on your mind"
            value={mind}
            onChange={(e) => setMind(e.target.value)}
            maxLength={400}
            placeholder="Whatever's here. Or leave it empty."
            className="mt-4 min-h-36 rounded-2xl border-border/60 bg-card/50 text-[15px] leading-relaxed placeholder:text-muted-foreground/60"
          />
          <div className="mt-1.5 flex items-center justify-between px-1">
            <p className="text-[11px] text-muted-foreground">saves into this check-in · private to you</p>
            <p className="text-[11px] tabular-nums text-muted-foreground">{mind.length}/400</p>
          </div>
          <button type="button" onClick={goNext} className="qs-pill-cta mt-6 w-full">Continue</button>
        </section>
      )}

      {/* ── Step: core need ── */}
      {step === "need" && (
        <section className="mt-8 fade-in" aria-labelledby="ci-need">
          <h1 id="ci-need" className="font-serif text-[1.65rem] font-light leading-snug">What would help most right now?</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">Choose what feels right — this shapes where we go next.</p>
          <div className="mt-5 flex flex-col gap-2.5">
            {NEEDS.map((n) => {
              const on = need === n.key;
              const Icon = n.icon;
              return (
                <button
                  key={n.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setNeed(on ? null : n.key)}
                  className="flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition"
                  style={on
                    ? { background: "var(--surface-selected)", borderColor: "var(--border-active)" }
                    : { background: "color-mix(in oklab, var(--card) 55%, transparent)", borderColor: "var(--border-subtle)" }}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.7} style={{ color: on ? "var(--accent-primary)" : "var(--text-secondary)" }} />
                  <span className="min-w-0">
                    <span className="block text-[14.5px] font-medium" style={{ color: "var(--text-primary)" }}>{n.label}</span>
                    <span className="block text-[12px]" style={{ color: "var(--text-secondary)" }}>{n.line}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <button type="button" onClick={goNext} className="qs-pill-cta mt-6 w-full">Continue</button>
        </section>
      )}

      {/* ── Step: reflection summary + commitment + save ── */}
      {step === "summary" && (
        <section className="mt-8 fade-in" aria-labelledby="ci-summary">
          <h1 id="ci-summary" className="font-serif text-[1.65rem] font-light leading-snug">Your reflection</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
            Based on what you shared — correct anything that doesn't fit.
          </p>
          <div className="glass mt-5 space-y-3 rounded-2xl p-4">
            {emotions.length > 0 && (
              <SummaryRow label="you're feeling" onEdit={() => setStep("mood")}>{emotions.join(", ")}</SummaryRow>
            )}
            {(triggers.length > 0 || hearts.length > 0) && (
              <SummaryRow label="it may be connected to" onEdit={() => setStep("deeper")}>
                {[...triggers, ...hearts.map((h) => h.toLowerCase())].join(", ")}
              </SummaryRow>
            )}
            {mind.trim() && (
              <SummaryRow label="on your mind" onEdit={() => setStep("mind")}>{mind.trim()}</SummaryRow>
            )}
            {need && (
              <SummaryRow label="what may help" onEdit={() => setStep("need")}>
                {NEEDS.find((n) => n.key === need)?.label} — {NEEDS.find((n) => n.key === need)?.line}
              </SummaryRow>
            )}
            {emotions.length === 0 && !mind.trim() && !need && (
              <p className="text-[13.5px] italic text-muted-foreground">A quiet check-in — just marking that you came. That counts too.</p>
            )}
          </div>

          <p className="qs-section-label mt-6">one small thing for yourself? <span className="normal-case tracking-normal">(optional)</span></p>
          <Textarea
            aria-label="One small thing you'll do for yourself"
            value={commitment}
            onChange={(e) => setCommitment(e.target.value)}
            maxLength={120}
            placeholder="e.g. a ten-minute walk · not texting tonight · one page of notes"
            className="mt-2 min-h-16 rounded-2xl border-border/60 bg-card/50 text-[14px] leading-relaxed placeholder:text-muted-foreground/60"
          />

          <button type="button" onClick={save} disabled={saving} className="qs-pill-cta mt-6 w-full disabled:opacity-60">
            {saving ? "Saving…" : "This feels right"}
          </button>
        </section>
      )}
    </div>
  );
}

function SummaryRow({ label, children, onEdit }: { label: string; children: React.ReactNode; onEdit: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/30 pb-3 last:border-0 last:pb-0">
      <div className="min-w-0">
        <p className="qs-section-label">{label}</p>
        <p className="mt-1 text-[14px] leading-relaxed text-foreground/90">{children}</p>
      </div>
      <button type="button" onClick={onEdit} className="shrink-0 text-[12px] text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline">
        edit
      </button>
    </div>
  );
}
