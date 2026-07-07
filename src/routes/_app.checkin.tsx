import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { logMood } from "@/lib/data.functions";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { ArrowRight, MessageCircle, PenLine, Home as HomeIcon } from "lucide-react";

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
const ORBS: { score: number; word: string; whisper: string }[] = [
  { score: 2,  word: "Heavy",    whisper: "today is asking a lot of you. that's allowed." },
  { score: 4,  word: "Low",      whisper: "a tender day. be gentle with the hours." },
  { score: 6,  word: "Neutral",  whisper: "somewhere in the middle. just here." },
  { score: 8,  word: "Light",    whisper: "a little ease today. let it be." },
  { score: 10, word: "Peaceful", whisper: "a softness you can rest in. notice it." },
];

function CheckIn() {
  const navigate = useNavigate();
  const log = useServerFn(logMood);
  const [mood, setMood] = useState<number | null>(null);
  const [emotions, setEmotions] = useState<string[]>([]);
  const [triggers, setTriggers] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const chosen = mood === null ? undefined : ORBS.find(o => o.score === mood);

  const toggle = (arr: string[], set: (v: string[]) => void, t: string) =>
    set(arr.includes(t) ? arr.filter(x => x !== t) : [...arr, t]);

  const save = async () => {
    if (mood === null || saving) return;
    setSaving(true);
    try {
      await log({ data: { mood_score: mood, emotion_tags: emotions, trigger_tags: triggers, note: note || undefined } });
      setDone(true);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  const reset = () => {
    setDone(false);
    setMood(null);
    setEmotions([]);
    setTriggers([]);
    setNote("");
  };

  if (done) return (
    <div className="mx-auto flex min-h-[80dvh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center fade-in">
      {/* Glowing breathing orb — dawn held in the dark */}
      <div className="relative mb-8 flex h-28 w-28 items-center justify-center" aria-hidden>
        <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_45%,color-mix(in_oklab,var(--dawn)_38%,transparent),transparent_72%)] blur-md" />
        <span className="qs-orb qs-orb--selected relative" style={{ width: "4.5rem", height: "4.5rem" }} />
      </div>
      <span className="qs-section-label">saved softly</span>
      <h1 className="mt-4 font-serif text-[2rem] font-light leading-snug tracking-tight">Noted gently.</h1>
      <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
        It's on your private shelf now. Feelings grow lighter when they're witnessed.
      </p>
      <div className="mt-9 flex w-full max-w-xs flex-col gap-3">
        <Link to="/companion" className="qs-pill-cta w-full">
          <MessageCircle className="h-4 w-4" strokeWidth={1.7} />
          talk about this with InnerMate
        </Link>
        <Link
          to="/journal"
          className="glass inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-[13.5px] text-muted-foreground transition hover:text-foreground"
        >
          <PenLine className="h-3.5 w-3.5" strokeWidth={1.7} />
          want to say more about this?
        </Link>
        <div className="mt-1 flex items-center justify-center gap-4 text-[13px] text-muted-foreground">
          <button type="button" onClick={reset} className="transition hover:text-foreground">
            check in again
          </button>
          <span aria-hidden className="opacity-40">·</span>
          <button
            type="button"
            onClick={() => navigate({ to: "/home" })}
            className="inline-flex items-center gap-1.5 transition hover:text-foreground"
          >
            <HomeIcon className="h-3.5 w-3.5" strokeWidth={1.7} />
            back home
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8 sm:py-12">
      <p className="qs-section-label">a moment to check in</p>
      <h1 className="mt-3 font-serif text-[2rem] font-light leading-tight tracking-tight sm:text-[2.3rem]">
        How does today feel?
      </h1>
      <p className="mt-3 max-w-md text-[14.5px] leading-relaxed text-muted-foreground">
        Under a minute. Nothing here is a wrong answer.
      </p>

      {/* Mood orbs — heaviest → lightest, same track as Home */}
      <section aria-labelledby="mood-h" className="tactile mt-8 p-6 sm:p-7">
        <h2 id="mood-h" className="qs-section-label">your inner weather, right now</h2>
        <div
          role="radiogroup"
          aria-label="Choose the mood that fits closest"
          className="mt-5 flex items-center justify-between gap-1.5"
        >
          {ORBS.map((o) => {
            const on = mood === o.score;
            return (
              <button
                key={o.score}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={o.word}
                onClick={() => setMood(o.score)}
                className="flex flex-1 items-center justify-center rounded-full py-1 outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <span className={`qs-orb ${on ? "qs-orb--selected" : ""}`} />
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between px-1 text-[11px] text-muted-foreground">
          <span>heavy</span>
          <span>light</span>
        </div>
        {chosen && (
          <div className="mt-4 border-t border-white/10 pt-4 text-center fade-in">
            <p className="text-[13px] font-medium text-foreground">{chosen.word}</p>
            <p className="mt-1 font-serif text-[13.5px] italic text-muted-foreground">{chosen.whisper}</p>
          </div>
        )}
      </section>

      {/* Emotions */}
      <section aria-labelledby="emo-h" className="mt-8">
        <h2 id="emo-h" className="font-serif text-[17px] font-light text-foreground">What emotions are here?</h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">Pick any. They can hold hands.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {EMOTIONS.map(t => {
            const on = emotions.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(emotions, setEmotions, t)}
                className={`qs-chip ${on ? "qs-chip--active" : ""}`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </section>

      {/* Triggers */}
      <section aria-labelledby="trig-h" className="mt-8">
        <h2 id="trig-h" className="font-serif text-[17px] font-light text-foreground">What set it off, if anything?</h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">Optional. Skip if nothing fits.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {TRIGGERS.map(t => {
            const on = triggers.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(triggers, setTriggers, t)}
                className={`qs-chip ${on ? "qs-chip--active" : ""}`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <label htmlFor="note" className="font-serif text-[17px] font-light text-foreground">A line, if there's one</label>
        <Textarea
          id="note"
          aria-label="Optional note about today"
          className="mt-3 min-h-28 rounded-2xl border-border/60 bg-card/50 text-[14.5px] leading-relaxed placeholder:text-muted-foreground/60"
          placeholder="Whatever's here. Or leave it empty."
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </section>

      <button
        type="button"
        onClick={save}
        disabled={mood === null || saving}
        className="qs-pill-cta mt-9 w-full"
      >
        Save this moment
        <ArrowRight className="h-4 w-4" strokeWidth={1.7} />
      </button>
      {mood === null && (
        <p className="mt-3 text-center font-serif text-[12.5px] italic text-muted-foreground/80">
          choose an orb above, and this will wake up.
        </p>
      )}
    </div>
  );
}
