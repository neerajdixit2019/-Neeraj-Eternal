/**
 * The check-in ritual — mood orbs, emotion + trigger chips, a line, save.
 * Extracted from the old /checkin route so it can live at the top of the
 * Insights page: check in above, watch the constellation shift below.
 * The logMood contract is unchanged; saving invalidates ["moods"] so the
 * patterns beneath refresh in place.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { logMood } from "@/lib/data.functions";
import { radioArrowNav } from "@/lib/a11y";
import { useLang, tagLabel } from "@/lib/i18n";
import { tx } from "@/lib/i18n-strings";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowRight, MessageCircle, PenLine } from "lucide-react";

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

export function CheckinRitual() {
  const lang = useLang();
  const qc = useQueryClient();
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
      // The constellation below is built from ["moods"] — refresh it so
      // the just-saved check-in appears in the sky immediately.
      qc.invalidateQueries({ queryKey: ["moods"] });
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
    <div className="tactile flex flex-col items-center px-6 py-10 text-center fade-in">
      <div className="relative mb-6 flex h-24 w-24 items-center justify-center" aria-hidden>
        <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_45%,color-mix(in_oklab,var(--dawn)_38%,transparent),transparent_72%)] blur-md" />
        <span className="qs-orb qs-orb--selected relative" style={{ width: "4rem", height: "4rem" }} />
      </div>
      <span className="qs-section-label">{tx(lang, "saved softly")}</span>
      <h2 className="mt-3 font-serif text-[1.6rem] font-light leading-snug tracking-tight">{tx(lang, "Noted gently.")}</h2>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
        {tx(lang, "It's in your sky now — the patterns below already know.")}
      </p>
      <div className="mt-7 flex w-full max-w-xs flex-col gap-3">
        <Link to="/companion" className="qs-pill-cta w-full">
          <MessageCircle className="h-4 w-4" strokeWidth={1.7} />
          {tx(lang, "talk about this with InnerMate")}
        </Link>
        <Link
          to="/journal"
          className="glass inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-[13.5px] text-muted-foreground transition hover:text-foreground"
        >
          <PenLine className="h-3.5 w-3.5" strokeWidth={1.7} />
          {tx(lang, "want to say more about this?")}
        </Link>
        <button type="button" onClick={reset} className="mt-1 text-[13px] text-muted-foreground transition hover:text-foreground">
          {tx(lang, "check in again")}
        </button>
      </div>
    </div>
  );

  return (
    <div>
      {/* Mood orbs — heaviest → lightest, same track as Home */}
      <section aria-labelledby="mood-h" className="tactile p-6 sm:p-7">
        <h2 id="mood-h" className="qs-section-label">{tx(lang, "your inner weather, right now")}</h2>
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
                aria-label={tx(lang, o.word)}
                tabIndex={on || (mood == null && o.score === ORBS[0].score) ? 0 : -1}
                onClick={() => setMood(o.score)}
                onKeyDown={radioArrowNav}
                className="flex flex-1 items-center justify-center rounded-full py-1 outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <span className={`qs-orb ${on ? "qs-orb--selected" : ""}`} />
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between px-1 text-[11px] text-muted-foreground">
          <span>{tx(lang, "heavy")}</span>
          <span>{tx(lang, "light")}</span>
        </div>
        {chosen && (
          <div className="mt-4 border-t border-white/10 pt-4 text-center fade-in">
            <p className="text-[13px] font-medium text-foreground">{tx(lang, chosen.word)}</p>
            <p className="mt-1 font-serif text-[13.5px] italic text-muted-foreground">{tx(lang, chosen.whisper)}</p>
          </div>
        )}
      </section>

      {/* Emotions */}
      <section aria-labelledby="emo-h" className="mt-7">
        <h3 id="emo-h" className="font-serif text-[16px] font-light text-foreground">{tx(lang, "What emotions are here?")}</h3>
        <p className="mt-1 text-[12.5px] text-muted-foreground">{tx(lang, "Pick any. They can hold hands.")}</p>
        <div className="mt-3.5 flex flex-wrap gap-2">
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
                {tagLabel(t, lang)}
              </button>
            );
          })}
        </div>
      </section>

      {/* Triggers */}
      <section aria-labelledby="trig-h" className="mt-7">
        <h3 id="trig-h" className="font-serif text-[16px] font-light text-foreground">{tx(lang, "What set it off, if anything?")}</h3>
        <p className="mt-1 text-[12.5px] text-muted-foreground">{tx(lang, "Optional. Skip if nothing fits.")}</p>
        <div className="mt-3.5 flex flex-wrap gap-2">
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
                {tagLabel(t, lang)}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-7">
        <label htmlFor="checkin-note" className="font-serif text-[16px] font-light text-foreground">{tx(lang, "A line, if there's one")}</label>
        <Textarea
          id="checkin-note"
          aria-label="Optional note about today"
          className="mt-3 min-h-24 rounded-2xl border-border/60 bg-card/50 text-[14.5px] leading-relaxed placeholder:text-muted-foreground"
          placeholder={tx(lang, "Whatever's here. Or leave it empty.")}
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </section>

      <button
        type="button"
        onClick={save}
        disabled={mood === null || saving}
        className="qs-pill-cta mt-8 w-full"
      >
        {tx(lang, "Save this moment")}
        <ArrowRight className="h-4 w-4" strokeWidth={1.7} />
      </button>
      {mood === null && (
        <p className="mt-3 text-center font-serif text-[12.5px] italic text-muted-foreground/80">
          {tx(lang, "choose an orb above, and this will wake up.")}
        </p>
      )}
    </div>
  );
}
