import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitReflectionFeedback } from "@/lib/reflect.functions";
import { Check, X } from "lucide-react";

/**
 * A subtle, opt-in "Was this helpful?" — the real feedback loop from the
 * research spec. It persists through the SAME server function the guided
 * Reflection uses, on the anonymous "ephemeral" path: only the rating,
 * optional reasons, and (when valid) the response mode are stored — never the
 * conversation text, never a link back to a stored message. Fully covered by
 * the Sanctuary's export & delete.
 *
 * Deliberately never rendered on crisis/safety replies — rating a moment of
 * distress would be the wrong thing to ask.
 */

type Rating = "yes" | "a_little" | "not_really";
type ReasonId =
  | "felt_too_generic"
  | "too_much_advice"
  | "did_not_understand_me"
  | "too_long"
  | "too_clinical"
  | "too_emotional"
  | "repetitive";

const REASONS: { id: ReasonId; label: string }[] = [
  { id: "did_not_understand_me", label: "didn't get me" },
  { id: "felt_too_generic", label: "too generic" },
  { id: "too_much_advice", label: "too much advice" },
  { id: "too_long", label: "too long" },
  { id: "too_clinical", label: "too clinical" },
  { id: "repetitive", label: "repetitive" },
];

// The DB column accepts only these five modes; anything else is stored as null.
const ALLOWED_MODES = new Set(["listen", "clarity", "grounding", "decision", "celebration"]);

export function HelpfulnessPrompt({
  category,
  responseMode,
  onDone,
  className = "",
}: {
  /** where this signal came from, e.g. "companion" or "checkin" */
  category: string;
  /** the reply's mode, if known — only stored when it's one the DB allows */
  responseMode?: string | null;
  /** called after answer or dismiss, so the parent can stop showing it */
  onDone?: () => void;
  className?: string;
}) {
  const send = useServerFn(submitReflectionFeedback);
  const [rating, setRating] = useState<Rating | null>(null);
  const [reasons, setReasons] = useState<ReasonId[]>([]);
  const [sent, setSent] = useState(false);

  const persist = (r: Rating, why: ReasonId[]) => {
    // Fire-and-forget: feedback should never block or interrupt the moment.
    void send({ data: {
      rating: r,
      reasons: why,
      save_mode: "ephemeral",
      category,
      response_mode: responseMode && ALLOWED_MODES.has(responseMode) ? (responseMode as "listen") : undefined,
    } }).catch(() => { /* stay silent — a lost rating is not the user's problem */ });
  };

  const choose = (r: Rating) => {
    setRating(r);
    if (r === "yes") {
      persist(r, []);
      setSent(true);
      onDone?.();
    }
  };

  const toggle = (id: ReasonId) =>
    setReasons((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const finish = () => {
    if (!rating) return;
    persist(rating, reasons);
    setSent(true);
    onDone?.();
  };

  const dismiss = () => { setSent(true); onDone?.(); };

  if (sent) {
    return (
      <p className={`flex items-center gap-1.5 text-[11px] text-muted-foreground/80 ${className}`}>
        <Check className="h-3 w-3" strokeWidth={2} /> thank you.
      </p>
    );
  }

  return (
    <div className={`fade-in ${className}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="text-[11px] text-muted-foreground">was this helpful?</span>
        {([
          { id: "yes", label: "yes" },
          { id: "a_little", label: "a little" },
          { id: "not_really", label: "not really" },
        ] as { id: Rating; label: string }[]).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => choose(opt.id)}
            className="rounded-full border px-2.5 py-0.5 text-[11px] transition"
            style={rating === opt.id
              ? { background: "var(--surface-selected)", borderColor: "var(--border-active)", color: "var(--text-primary)" }
              : { background: "transparent", borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
          >
            {opt.label}
          </button>
        ))}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="ml-auto text-muted-foreground/60 transition hover:text-muted-foreground"
        >
          <X className="h-3 w-3" strokeWidth={2} />
        </button>
      </div>

      {rating && rating !== "yes" && (
        <div className="fade-in mt-2.5">
          <p className="text-[10.5px] text-muted-foreground/80">optional — what made it feel that way?</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {REASONS.map((r) => {
              const on = reasons.includes(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggle(r.id)}
                  className="rounded-full border px-2.5 py-0.5 text-[10.5px] transition"
                  style={on
                    ? { background: "var(--surface-selected)", borderColor: "var(--border-active)", color: "var(--text-primary)" }
                    : { background: "transparent", borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={finish}
            className="mt-2.5 rounded-full px-3 py-1 text-[11px] transition"
            style={{ background: "color-mix(in oklab, var(--accent-primary) 20%, transparent)", color: "var(--text-primary)" }}
          >
            send
          </button>
        </div>
      )}
    </div>
  );
}
