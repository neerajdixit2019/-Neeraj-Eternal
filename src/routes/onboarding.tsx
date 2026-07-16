import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { completeOnboarding } from "@/lib/data.functions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CompanionCloud } from "@/components/CompanionCloud";
import { toast } from "sonner";
import { ArrowLeft, CloudRain, Cloud, CloudSun, Sun, Sparkles, Lock } from "lucide-react";

/**
 * First-session onboarding — the first page being written: one Fraunces
 * question at a time, an acknowledgment after every answer, and everything
 * the user chooses to share accumulating as handwritten lines on a paper
 * sheet pinned below. The finale seals the page with a letterpress stamp.
 * The completeOnboarding contract (age/struggle/mood/need/tone/styles) is
 * unchanged, so downstream personalization keeps working.
 */
export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
  head: () => ({
    meta: [
      { title: "Welcome — set up your quiet space | My Quiet Space" },
      { name: "description", content: "A short, gentle first conversation — one question at a time, skip anything." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const STRUGGLES = ["Heartbreak", "Missing Someone", "Loneliness", "Overthinking", "Anxiety", "Social Media Comparison", "Career Pressure", "I Just Need to Write"];
const NEEDS = ["Calm down", "Write freely", "Understand my emotions", "Stop overthinking", "Sleep", "Feel less alone"];
const SPEAK_STYLES = ["Soft and gentle", "Direct and practical", "Deep and reflective"];
const EXTRA_STYLES = ["Use wisdom from Gita/scriptures only when helpful", "Avoid spiritual advice unless I ask"];
const AVOID_STYLES = ["Don't push positivity", "Don't give long lectures", "Don't use Hindi unless I choose it", "Don't mention my memories unless relevant"];
const TONE_MAP: Record<string, "gentle" | "practical" | "poetic"> = {
  "Soft and gentle": "gentle",
  "Direct and practical": "practical",
  "Deep and reflective": "poetic",
};

/* Acknowledgment after every answer — adapted to what they just said.
   Specific and warm, never "I see you" filler. */
const STRUGGLE_ACK: Record<string, string> = {
  "Heartbreak": "Heartbreak has real weight. Thank you for naming it.",
  "Missing Someone": "Missing someone can fill a whole day. It makes sense you came.",
  "Loneliness": "Loneliness is heavy to carry quietly. You just said it out loud, which matters.",
  "Overthinking": "A mind that won't stop is exhausting. We can slow it down together.",
  "Anxiety": "Anxiety makes everything louder. There's no rush here.",
  "Social Media Comparison": "Other people's highlight reels are a hard mirror. Good that you noticed what it does to you.",
  "Career Pressure": "Career pressure can sit on your chest. It's allowed to be heavy.",
  "I Just Need to Write": "Then this will be your page. No performance needed.",
};

const NEED_ACK: Record<string, string> = {
  "Calm down": "then we'll keep things slow and low-light.",
  "Write freely": "the page will always be ready first.",
  "Understand my emotions": "we'll name things gently, one at a time.",
  "Stop overthinking": "shorter loops, softer landings.",
  "Sleep": "evenings here will wind down with you.",
  "Feel less alone": "you won't be writing into a void.",
};

const MOODS = [
  { score: 2, word: "Heavy", icon: CloudRain, ack: "Heavy days deserve gentleness, not homework. We'll keep this light." },
  { score: 4, word: "Cloudy", icon: Cloud, ack: "A tender, unclear kind of day. That's okay to bring here." },
  { score: 6, word: "Settled", icon: CloudSun, ack: "Somewhere in the middle. That's a real answer too." },
  { score: 8, word: "Open", icon: Sun, ack: "A little ease today. Let's keep it." },
  { score: 10, word: "Bright", icon: Sparkles, ack: "Something's going well. Worth noticing on purpose." },
] as const;

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;
const TOTAL_STEPS = 7;

function Onboarding() {
  const navigate = useNavigate();
  const finish = useServerFn(completeOnboarding);
  const [step, setStep] = useState<Step>(0);
  const [age, setAge] = useState(false);
  const [struggle, setStruggle] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [need, setNeed] = useState("");
  const [speakStyle, setSpeakStyle] = useState("");
  const [extraStyles, setExtraStyles] = useState<string[]>([]);
  const [avoidStyles, setAvoidStyles] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Same DEV-only preview bypass as the app shell (compiled out in prod).
    if (import.meta.env.DEV && window.localStorage.getItem("mqs-dev-preview") === "1") return;
    supabase.auth.getSession().then(({ data }) => { if (!data.session) navigate({ to: "/login" }); });
  }, [navigate]);

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const moodEntry = MOODS.find((m) => m.score === mood) ?? null;

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await finish({ data: {
        age_gate_passed: true,
        primary_struggle: struggle || "Just exploring",
        initial_mood: mood ?? 5,
        initial_need: need || "Just exploring",
        companion_tone: TONE_MAP[speakStyle] ?? null,
        speaking_styles: [speakStyle, ...extraStyles].filter(Boolean),
        avoid_styles: avoidStyles,
      } });
      navigate({ to: "/home" });
    } catch (e) {
      toast.error((e as Error).message);
      setSaving(false);
    }
  };

  /* The first page — only what was actually shared becomes a written line. */
  const sheetLines = useMemo(() => {
    const lines: string[] = [];
    if (struggle) {
      lines.push(struggle === "I Just Need to Write" ? "i just need to write." : `i came carrying ${struggle.toLowerCase()}.`);
    }
    if (moodEntry) lines.push(`arriving ${moodEntry.word.toLowerCase()}.`);
    if (need) lines.push(`to begin: ${need.toLowerCase()}.`);
    if (speakStyle) lines.push(`speak to me ${speakStyle.toLowerCase()}.`);
    if (avoidStyles.length) {
      lines.push(`please don't ${avoidStyles.map((s) => s.toLowerCase().replace(/^don't /, "")).join(" · ")}.`);
    }
    return lines;
  }, [struggle, moodEntry, need, speakStyle, avoidStyles]);

  const back = () => setStep((s) => (s > 0 ? ((s - 1) as Step) : s));

  // Soft worded stages instead of a clinical "Question 4 of 12".
  const stageLabel = step <= 1 ? "Beginning" : step <= 3 ? "Understanding" : step === 4 ? "What you need" : "Your space";

  const inkFaint = "color-mix(in oklab, var(--ink) 66%, var(--paper))";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
      {/* Header: back + progress + skip-to-end (everything after age+consent is optional) */}
      <div className="flex items-center gap-3">
        {step > 0 && step < 6 ? (
          <button type="button" onClick={back} aria-label="Back" className="glass flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
          </button>
        ) : <span className="h-9 w-9" />}
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex gap-1.5" role="progressbar" aria-valuenow={step + 1} aria-valuemax={TOTAL_STEPS} aria-label={`Setup — ${stageLabel}`}>
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <span key={i} className="h-1 flex-1 rounded-full transition-colors duration-300"
                style={{ background: i <= step ? "var(--accent-primary)" : "oklch(1 0 0 / 0.12)" }} />
            ))}
          </div>
          <p className="text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">{stageLabel}</p>
        </div>
        {step >= 1 && step <= 4 && (
          <button type="button" onClick={() => setStep(5)} className="inline-flex min-h-11 items-center text-[12.5px] text-secondary-foreground transition hover:text-foreground">
            skip ahead
          </button>
        )}
      </div>

      {/* 0 · Welcome + the one required check */}
      {step === 0 && (
        <section className="flex flex-1 flex-col fade-in" aria-labelledby="ob-welcome">
          <div className="mt-10 flex justify-center"><CompanionCloud size={110} state="calm" /></div>
          <div className="mt-auto pt-8">
            <h1 id="ob-welcome" className="font-serif text-[1.9rem] font-light leading-[1.15] tracking-tight">
              I'll listen first,<br />and ask only what helps.
            </h1>
            <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
              A few small questions, one at a time. Skip anything. This is a quiet space for
              adults — a companion, not therapy or emergency support.
            </p>
            <label className="mt-6 flex cursor-pointer items-center gap-3 rounded-2xl border border-border/60 p-4">
              <Checkbox checked={age} onCheckedChange={(v) => setAge(!!v)} />
              <span className="text-[14px]">I'm 18 or older.</span>
            </label>
            <Button className="qs-pill-cta mt-6 h-12 w-full border-0" disabled={!age} onClick={() => setStep(1)}>
              Begin
            </Button>
          </div>
        </section>
      )}

      {/* 1 · What brought you here */}
      {step === 1 && (
        <section className="mt-8 fade-in" aria-labelledby="ob-why">
          <h1 id="ob-why" className="font-serif text-[1.65rem] font-light leading-snug">What brought you here today?</h1>
          <p className="mt-2 text-[13.5px] text-muted-foreground">There's no wrong door. One tap, or leave it blank.</p>
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            {STRUGGLES.map((s) => {
              const on = struggle === s;
              return (
                <button key={s} type="button" aria-pressed={on} onClick={() => setStruggle(on ? "" : s)}
                  className="rounded-2xl border px-3 py-3.5 text-left text-[13px] leading-snug transition"
                  style={on
                    ? { background: "var(--surface-selected)", borderColor: "var(--border-active)", color: "var(--text-primary)", fontWeight: 600 }
                    : { background: "color-mix(in oklab, var(--card) 55%, transparent)", borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}>
                  {s}
                </button>
              );
            })}
          </div>
          {struggle && <p className="margin-note mt-4 fade-in">{STRUGGLE_ACK[struggle]}</p>}
          <Button className="qs-pill-cta mt-6 h-12 w-full border-0" disabled={!struggle} onClick={() => setStep(2)}>Continue</Button>
          <button type="button" onClick={() => { setStruggle(""); setStep(2); }}
            className="mx-auto mt-2 flex min-h-11 w-full items-center justify-center text-[13.5px] text-secondary-foreground transition hover:text-foreground">
            leave this blank
          </button>
        </section>
      )}

      {/* 2 · How are you arriving (with acknowledgment of step 1) */}
      {step === 2 && (
        <section className="mt-8 fade-in" aria-labelledby="ob-mood">
          {struggle && (
            <div className="mb-5 flex items-start gap-3">
              <CompanionCloud size={38} state="listening" glow={false} />
              <p className="margin-note pt-1">{STRUGGLE_ACK[struggle]}</p>
            </div>
          )}
          <h1 id="ob-mood" className="font-serif text-[1.65rem] font-light leading-snug">How are you arriving right now?</h1>
          <p className="mt-2 text-[13.5px] text-muted-foreground">Not a test — just today's weather.</p>
          <div className="mt-5 grid grid-cols-5 gap-2">
            {MOODS.map((m) => {
              const on = mood === m.score;
              const Icon = m.icon;
              return (
                <button key={m.score} type="button" aria-pressed={on} aria-label={m.word} onClick={() => setMood(on ? null : m.score)}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-3 transition"
                  style={on
                    ? { background: "var(--surface-selected)", borderColor: "var(--border-active)" }
                    : { background: "color-mix(in oklab, var(--card) 45%, transparent)", borderColor: "var(--border-subtle)" }}>
                  <Icon className="h-4 w-4" strokeWidth={1.7} style={{ color: on ? "var(--accent-primary)" : "var(--text-secondary)" }} />
                  <span className="text-[10px] leading-none" style={{ color: on ? "var(--text-primary)" : "var(--text-secondary)" }}>{m.word}</span>
                </button>
              );
            })}
          </div>
          {moodEntry && <p className="margin-note mt-4 fade-in">{moodEntry.ack}</p>}
          <Button className="qs-pill-cta mt-6 h-12 w-full border-0" disabled={mood == null} onClick={() => setStep(3)}>Continue</Button>
          <button type="button" onClick={() => { setMood(null); setStep(3); }}
            className="mx-auto mt-2 flex min-h-11 w-full items-center justify-center text-[13.5px] text-secondary-foreground transition hover:text-foreground">
            leave this blank
          </button>
        </section>
      )}

      {/* 3 · What do you need */}
      {step === 3 && (
        <section className="mt-8 fade-in" aria-labelledby="ob-need">
          <h1 id="ob-need" className="font-serif text-[1.65rem] font-light leading-snug">What would help most, to begin with?</h1>
          <p className="mt-2 text-[13.5px] text-muted-foreground">This just shapes where we start. It can change any day.</p>
          <div className="mt-5 space-y-2">
            {NEEDS.map((n) => {
              const on = need === n;
              return (
                <button key={n} type="button" aria-pressed={on} onClick={() => setNeed(on ? "" : n)}
                  className="block w-full rounded-2xl border px-4 py-3.5 text-left text-[14px] transition"
                  style={on
                    ? { background: "var(--surface-selected)", borderColor: "var(--border-active)", color: "var(--text-primary)", fontWeight: 600 }
                    : { background: "color-mix(in oklab, var(--card) 55%, transparent)", borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}>
                  {n}
                </button>
              );
            })}
          </div>
          {need && <p className="margin-note mt-4 fade-in">{NEED_ACK[need]}</p>}
          <Button className="qs-pill-cta mt-6 h-12 w-full border-0" disabled={!need} onClick={() => setStep(4)}>Continue</Button>
          <button type="button" onClick={() => { setNeed(""); setStep(4); }}
            className="mx-auto mt-2 flex min-h-11 w-full items-center justify-center text-[13.5px] text-secondary-foreground transition hover:text-foreground">
            leave this blank
          </button>
        </section>
      )}

      {/* 4 · How should I speak with you */}
      {step === 4 && (
        <section className="mt-8 fade-in" aria-labelledby="ob-style">
          <h1 id="ob-style" className="font-serif text-[1.65rem] font-light leading-snug">How should I speak with you?</h1>
          <p className="mt-2 text-[13.5px] text-muted-foreground">Pick one. You can change it anytime in the Sanctuary.</p>
          <div className="mt-5 space-y-2">
            {SPEAK_STYLES.map((s) => {
              const on = speakStyle === s;
              return (
                <button key={s} type="button" aria-pressed={on} onClick={() => setSpeakStyle(on ? "" : s)}
                  className="block w-full rounded-2xl border px-4 py-3.5 text-left text-[14px] transition"
                  style={on
                    ? { background: "var(--surface-selected)", borderColor: "var(--border-active)", color: "var(--text-primary)", fontWeight: 600 }
                    : { background: "color-mix(in oklab, var(--card) 55%, transparent)", borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}>
                  {s}
                </button>
              );
            })}
          </div>
          {speakStyle && <p className="margin-note mt-4 fade-in">noted — {speakStyle.toLowerCase()}, then.</p>}
          <p className="qs-section-label mt-6">anything to avoid? <span className="normal-case tracking-normal">(optional)</span></p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {[...EXTRA_STYLES, ...AVOID_STYLES].map((s) => {
              const isExtra = EXTRA_STYLES.includes(s);
              const list = isExtra ? extraStyles : avoidStyles;
              const set = isExtra ? setExtraStyles : setAvoidStyles;
              const on = list.includes(s);
              return (
                <button key={s} type="button" aria-pressed={on} onClick={() => toggle(list, set, s)} className={`qs-chip ${on ? "qs-chip--active" : ""}`}>
                  {s}
                </button>
              );
            })}
          </div>
          <Button className="qs-pill-cta mt-6 h-12 w-full border-0" onClick={() => setStep(5)}>Continue</Button>
        </section>
      )}

      {/* 5 · Memory, in plain language (required consent, honestly framed) */}
      {step === 5 && (
        <section className="mt-8 fade-in" aria-labelledby="ob-memory">
          <h1 id="ob-memory" className="font-serif text-[1.65rem] font-light leading-snug">Before we begin: your words, your control.</h1>
          <div className="glass mt-5 space-y-3 rounded-2xl p-4 text-[13.5px] leading-relaxed text-muted-foreground">
            <p><Lock className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />Your check-ins, journal, and conversations are saved privately, scoped only to your account, so this space can remember with you.</p>
            <p>InnerMate only reads the pieces you explicitly allow, item by item — every entry has its own switch.</p>
            <p>You can export everything or delete everything, anytime, in the Sanctuary.</p>
          </div>
          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-border/60 p-4">
            <Checkbox className="mt-0.5" checked={consent} onCheckedChange={(v) => setConsent(!!v)} />
            <span className="text-[13.5px] leading-relaxed">
              I understand this is a companion, not therapy or emergency support, and I'm okay with my entries being stored privately for me.
            </span>
          </label>
          <Button className="qs-pill-cta mt-6 h-12 w-full border-0" disabled={!consent} onClick={() => setStep(6)}>Continue</Button>
        </section>
      )}

      {/* 6 · The first page, sealed — only what was actually shared is on it */}
      {step === 6 && (
        <section className="flex flex-1 flex-col fade-in" aria-labelledby="ob-page">
          <div
            className="relative mt-8 rounded-[4px] p-6 pb-16"
            role="group"
            aria-label={sheetLines.length ? `Your first page: ${sheetLines.join(" ")}` : "Your first page, left blank on purpose"}
            style={{ background: "var(--paper)", color: "var(--ink)", boxShadow: "0 16px 48px rgba(10, 8, 4, 0.5)" }}
          >
            <p className="font-serif text-[12px] italic" style={{ color: inkFaint }}>the first page</p>
            {sheetLines.length > 0 ? (
              <div className="mt-3 space-y-2">
                {sheetLines.map((l) => (
                  <p key={l} className="font-reading text-[15px] leading-relaxed" style={{ color: "color-mix(in oklab, var(--ink) 85%, var(--paper))" }}>{l}</p>
                ))}
              </div>
            ) : (
              <p className="font-reading mt-3 text-[14.5px] italic" style={{ color: inkFaint }}>
                left blank, on purpose. that's allowed here.
              </p>
            )}
            {/* the letterpress seal */}
            <span
              aria-hidden
              className="absolute bottom-4 right-5 -rotate-6 rounded-full border-2 px-3.5 py-2 font-serif text-[10px] font-semibold uppercase tracking-[0.28em]"
              style={{ borderColor: "color-mix(in oklab, var(--ink) 38%, transparent)", color: "color-mix(in oklab, var(--ink) 58%, transparent)" }}
            >
              begun
            </span>
          </div>
          <div className="mt-auto pt-8">
            <h1 id="ob-page" className="font-serif text-[1.7rem] font-light leading-snug">
              {sheetLines.length ? "Your first page is written." : "Your book is ready."}
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              {sheetLines.length
                ? "Only what you chose to share is on it — nothing more is assumed about you. The rest of the book is yours to fill."
                : "You shared what you wanted to. The rest can come whenever you're ready."}
            </p>
            <Button className="qs-pill-cta mt-6 h-12 w-full border-0" disabled={saving} onClick={submit}>
              {saving ? "Opening your space…" : "Enter my quiet space"}
            </Button>
          </div>
        </section>
      )}

      {/* the page so far — pinned below while it's being written */}
      {step >= 1 && step <= 5 && sheetLines.length > 0 && (
        <div
          className="mt-6 rounded-[3px] px-4 py-3"
          role="status"
          aria-label={`Your first page so far: ${sheetLines.join(" ")}`}
          style={{ background: "var(--paper)", color: "var(--ink)", boxShadow: "0 8px 24px rgba(5, 4, 2, 0.4)" }}
        >
          <p className="font-serif text-[11px] italic" style={{ color: inkFaint }}>your first page, so far</p>
          <div className="mt-1.5 space-y-1">
            {sheetLines.map((l) => (
              <p key={l} className="font-reading text-[13.5px] leading-relaxed" style={{ color: "color-mix(in oklab, var(--ink) 85%, var(--paper))" }}>{l}</p>
            ))}
          </div>
        </div>
      )}

      {/* the whisper line — help is present on every step, quietly */}
      {step < 6 && (
        <p className="mt-6 border-t pt-4 text-center text-[11.5px] leading-relaxed text-muted-foreground" style={{ borderColor: "var(--border-subtle)" }}>
          this space isn't for emergencies — in a hard moment, call{" "}
          <a href="tel:14416" className="-my-3 inline-block px-1 py-3 underline underline-offset-2" style={{ color: "var(--rose)" }}>Tele-MANAS 14416</a>.
        </p>
      )}
    </div>
  );
}
