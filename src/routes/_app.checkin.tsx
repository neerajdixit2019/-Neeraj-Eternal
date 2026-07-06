import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { logMood } from "@/lib/data.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { ArrowRight, MessageCircle, Home as HomeIcon } from "lucide-react";

export const Route = createFileRoute("/_app/checkin")({
  component: CheckIn,
  head: () => ({
    meta: [
      { title: "Daily mood check-in | My Quiet Space" },
      { name: "description", content: "Name what you're feeling in under a minute — mood, emotions, and what set it off. Private to you." },
      { property: "og:title", content: "Daily mood check-in" },
      { property: "og:description", content: "Name what you're feeling in under a minute — mood, emotions, and what set it off." },
      { property: "og:url", content: "https://neeraj2019.lovable.app/checkin" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://neeraj2019.lovable.app/checkin" }],
  }),
});

const EMOTIONS = [
  "Heavy","Anxious","Lonely","Numb","Confused",
  "Calm","Hopeful","Grateful","Angry","Overwhelmed",
];
const TRIGGERS = [
  "Work","Relationship","Family","Health",
  "Money","Memories","Sleep","Future",
];

// 5 mood orbs — heaviest → lightest (matches Home)
const ORBS: { score: number; label: string; hint: string; tint: string }[] = [
  { score: 2,  label: "Heavy",    hint: "carrying a lot",    tint: "from-[#8a7aa8]/70 to-[#5c4f78]/70" },
  { score: 4,  label: "Low",      hint: "a bit weighed",     tint: "from-[#9c94b8]/70 to-[#6f6693]/70" },
  { score: 6,  label: "Neutral",  hint: "somewhere between", tint: "from-[#b8b4c8]/70 to-[#8a86a3]/70" },
  { score: 8,  label: "Light",    hint: "some space today",  tint: "from-[#d4c4d8]/80 to-[#a894b8]/70" },
  { score: 10, label: "Peaceful", hint: "soft and open",     tint: "from-[#eadbdd]/85 to-[#c8b0d0]/70" },
];

function CheckIn() {
  const navigate = useNavigate();
  const log = useServerFn(logMood);
  const [mood, setMood] = useState(5);
  const [emotions, setEmotions] = useState<string[]>([]);
  const [triggers, setTriggers] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);

  const toggle = (arr: string[], set: (v: string[]) => void, t: string) =>
    set(arr.includes(t) ? arr.filter(x => x !== t) : [...arr, t]);

  const save = async () => {
    try {
      await log({ data: { mood_score: mood, emotion_tags: emotions, trigger_tags: triggers, note: note || undefined } });
      setDone(true);
    } catch (e) { toast.error((e as Error).message); }
  };

  if (done) return (
    <div className="mx-auto flex min-h-[80dvh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center fade-in">
      <span className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Saved quietly</span>
      <h1 className="mt-4 font-serif text-[2rem] font-light leading-snug">Noted gently.</h1>
      <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
        Your check-in is on your private shelf. Feelings become lighter when they're witnessed.
      </p>
      <div className="mt-9 flex w-full max-w-xs flex-col gap-3">
        <Link
          to="/companion"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-[14px] font-medium text-primary-foreground shadow-[0_14px_30px_-16px_color-mix(in_oklab,var(--primary)_70%,transparent)] transition hover:bg-primary/90"
        >
          <MessageCircle className="h-4 w-4" />
          Talk about this with InnerMate
        </Link>
        <button
          onClick={() => navigate({ to: "/home" })}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full text-[13.5px] text-muted-foreground transition hover:text-foreground"
        >
          <HomeIcon className="h-3.5 w-3.5" />
          Back home
        </button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8 sm:py-12">
      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">A quiet check-in</p>
      <h1 className="mt-3 font-serif text-[2rem] font-light leading-tight tracking-tight sm:text-[2.3rem]">
        How does today feel?
      </h1>
      <p className="mt-3 max-w-md text-[14.5px] leading-relaxed text-muted-foreground">
        Under a minute. Nothing's a wrong answer.
      </p>

      {/* Mood orbs — heaviest → lightest */}
      <section aria-labelledby="mood-h" className="tactile mt-8 p-6 sm:p-7">
        <div className="flex items-baseline justify-between">
          <h2 id="mood-h" className="text-[13px] font-medium text-foreground">Mood, right now</h2>
          <span className="font-serif text-[13px] italic text-muted-foreground">
            {ORBS.find(o => o.score === mood)?.label ?? "—"}
          </span>
        </div>
        <div
          role="radiogroup"
          aria-label="Choose the mood that fits closest"
          className="mt-6 grid grid-cols-5 gap-2 sm:gap-3"
        >
          {ORBS.map((o) => {
            const on = mood === o.score;
            return (
              <button
                key={o.score}
                role="radio"
                aria-checked={on}
                onClick={() => setMood(o.score)}
                className="group flex flex-col items-center gap-2 rounded-2xl p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <span
                  className={`qs-orb aspect-square w-full rounded-full bg-gradient-to-br ${o.tint} transition-transform duration-300 ${
                    on ? "scale-110 ring-2 ring-primary/50 shadow-[0_10px_28px_-10px_color-mix(in_oklab,var(--primary)_55%,transparent)]" : "opacity-80 group-hover:opacity-100 group-hover:scale-105"
                  }`}
                />
                <span className={`text-[11px] leading-none ${on ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {o.label}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-center text-[12px] italic text-muted-foreground">
          {ORBS.find(o => o.score === mood)?.hint}
        </p>
      </section>

      {/* Emotions */}
      <section aria-labelledby="emo-h" className="mt-8">
        <h2 id="emo-h" className="text-[13px] font-medium text-foreground">What emotions are here?</h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">Pick any. They can hold hands.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {EMOTIONS.map(t => {
            const on = emotions.includes(t);
            return (
              <button
                key={t}
                aria-pressed={on}
                onClick={() => toggle(emotions, setEmotions, t)}
                className={`min-h-9 rounded-full border px-4 py-1.5 text-[13px] transition ${
                  on
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/60 bg-card/40 text-muted-foreground hover:border-primary/25 hover:bg-card hover:text-foreground"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </section>

      {/* Triggers */}
      <section aria-labelledby="trig-h" className="mt-8">
        <h2 id="trig-h" className="text-[13px] font-medium text-foreground">What set it off, if anything?</h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">Optional. Skip if nothing fits.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {TRIGGERS.map(t => {
            const on = triggers.includes(t);
            return (
              <button
                key={t}
                aria-pressed={on}
                onClick={() => toggle(triggers, setTriggers, t)}
                className={`min-h-9 rounded-full border px-4 py-1.5 text-[13px] transition ${
                  on
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/60 bg-card/40 text-muted-foreground hover:border-primary/25 hover:bg-card hover:text-foreground"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <label htmlFor="note" className="text-[13px] font-medium text-foreground">A line, if there's one</label>
        <Textarea
          id="note"
          aria-label="Optional note about today"
          className="mt-3 min-h-28 rounded-2xl border-border/60 bg-card/50 text-[14.5px] leading-relaxed placeholder:text-muted-foreground/60"
          placeholder="Whatever's here. Or leave it empty."
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </section>

      <Button
        onClick={save}
        className="mt-8 h-13 w-full rounded-full text-[14.5px] font-medium shadow-[0_14px_30px_-16px_color-mix(in_oklab,var(--primary)_70%,transparent)]"
        style={{ height: "3.25rem" }}
      >
        Save this moment
        <ArrowRight className="ml-1.5 h-4 w-4" />
      </Button>
    </div>
  );
}