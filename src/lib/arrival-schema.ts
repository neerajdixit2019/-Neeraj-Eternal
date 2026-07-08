/**
 * Arrival-questions contract — pure and dependency-light so both the
 * server generator and the Home screen (and tests) share one shape.
 *
 * The AI (via the Lovable gateway) generates two personalized questions
 * after a mood check-in. This module validates whatever the model
 * returns; anything malformed falls back to the hand-written set so the
 * ritual never breaks.
 */
import { z } from "zod";

export type ArrivalOption = { l: string; r?: string };
export type ArrivalQuestion = { title: string; opts: ArrivalOption[] };

/** Hand-written fallback — also the SSR/dev/no-key experience. */
export const FALLBACK_QUESTIONS: ArrivalQuestion[] = [
  {
    title: "Where is your mind right now?",
    opts: [
      { l: "racing ahead", r: "Your mind is racing ahead" },
      { l: "circling one thing", r: "Your mind keeps circling one thing" },
      { l: "scattered everywhere", r: "Your attention is pulled in many directions" },
      { l: "fairly quiet", r: "Your mind is fairly quiet" },
    ],
  },
  {
    title: "What do you need most?",
    opts: [
      { l: "to be heard", r: "being heard matters most today. InnerMate is close" },
      { l: "to see clearly", r: "clarity matters most. Bring it to the page when you're ready" },
      { l: "a gentle push", r: "one small step counts today" },
      { l: "rest", r: "rest is the wisest thing on your list" },
    ],
  },
];

/** Compose the fallback read from fallback answers (both carry `r`). */
export function fallbackRead(answers: ArrivalOption[]): string {
  const parts = answers.map((a) => a.r).filter(Boolean);
  if (parts.length < 2) return "Thank you for telling me. InnerMate will keep this close today.";
  return `${parts[0]}, and ${parts[1]}.`;
}

const aiQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        title: z.string().min(6).max(90),
        options: z.array(z.string().min(2).max(34)).length(4),
      }),
    )
    .length(2),
});

/** Strip chatbot tells and stray formatting from model text. */
function clean(s: string): string {
  return s
    .replace(/—/g, ",")
    .replace(/\s+-\s+/g, ", ")
    .replace(/["“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pull the first JSON object out of a model reply (handles ``` fences). */
function extractJson(raw: string): unknown | null {
  const text = raw.replace(/```(?:json)?/gi, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Validate an AI questions reply. Returns null on ANY problem — the
 * caller falls back to FALLBACK_QUESTIONS.
 */
export function parseArrivalQuestions(raw: string): ArrivalQuestion[] | null {
  const json = extractJson(raw);
  if (!json) return null;
  const parsed = aiQuestionsSchema.safeParse(json);
  if (!parsed.success) return null;
  return parsed.data.questions.map((q) => ({
    title: clean(q.title),
    opts: q.options.map((o) => ({ l: clean(o).toLowerCase() })),
  }));
}

/**
 * Validate an AI closing read: one warm line, clamped, tell-free.
 * Returns null on any problem.
 */
export function parseArrivalRead(raw: string): string | null {
  const cleaned = clean(raw.replace(/```/g, ""));
  if (cleaned.length < 12) return null;
  return cleaned.length > 220 ? `${cleaned.slice(0, 217).trimEnd()}…` : cleaned;
}
