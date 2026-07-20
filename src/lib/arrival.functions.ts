/**
 * AI-generated arrival questions — after a mood check-in on Home, the
 * gateway model writes two short, personalized questions (and, after
 * the answers, one warm closing read) tuned to how the user arrived.
 *
 * Design rules:
 * - Fast + cheap: flash model, tiny prompts, strict JSON out.
 * - NEVER load-bearing: any failure (no key, rate limit, bad JSON,
 *   timeout) returns null and the client falls back to the hand-written
 *   set. The ritual must never break because the AI hiccuped.
 * - Same audit discipline as every AI call: prompt-version registry +
 *   invocation log.
 * - Voice rules apply: no em-dashes, no clinical language, no drama.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { AI_RATE_LIMITS, consumeAiRateLimit } from "@/lib/ai-rate-limit.server";
import { istTimeOfDay } from "@/lib/ist";
import { registerPromptVersion, logInvocation } from "@/lib/ai-prompt-registry.server";
import { parseArrivalQuestions, parseArrivalRead, type ArrivalQuestion } from "@/lib/arrival-schema";
import { classifyAiError, logAiKeyIssue } from "@/lib/ai-error";

// Direct Google AI Studio call (bypasses Lovable AI Gateway).
const ARRIVAL_MODEL = "gemini-3-flash-preview";
const ARRIVAL_ROUTE = "arrival.generate";

const QUESTIONS_SYSTEM = `You write two tiny check-in questions for a calm mental-wellness app, shown right after the user picked a mood word. Your questions help them (and their companion) understand how they are arriving today.

RULES
- Exactly 2 questions. Each has a short title (a real question, under 12 words) and exactly 4 answer options (2 to 4 words each, lowercase, plain).
- Personal, not generic: shape the questions around the mood word and context you are given. A "heavy" morning asks different things than a "bright" evening.
- Warm and light-handed. Never clinical (no "symptoms", "anxiety levels", "triggers"), never dark, never leading toward distress. No questions about self-harm (the app handles safety elsewhere).
- One question may be about their inner state; one should look gently outward (the day ahead, energy, what would help).
- No em-dashes anywhere. No emojis. No exclamation points.
- Reply with ONLY this JSON, nothing else:
{"questions":[{"title":"...","options":["...","...","...","..."]},{"title":"...","options":["...","...","...","..."]}]}`;

const READ_SYSTEM = `You write ONE warm closing line for a calm mental-wellness app, after the user answered two small check-in questions. Reflect their answers back with care, in second person, so they feel quietly understood.

RULES
- One or two short sentences, 35 words max total.
- Plain, warm, specific to their answers. No advice unless one tiny nudge fits naturally. No questions back.
- Never clinical, never dramatic, no "you are not alone", no "this too shall pass".
- No em-dashes. No emojis. No exclamation points.
- Reply with ONLY the line itself, no quotes, no JSON.`;

export const generateArrivalQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      mood_word: z.string().min(2).max(24),
      mood_score: z.number().int().min(1).max(10),
    }).parse(i),
  )
  .handler(async ({ data, context }): Promise<{ questions: ArrivalQuestion[] | null }> => {
    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!key) {
      logAiKeyIssue(ARRIVAL_ROUTE, "missing");
      await logInvocation({
        userId: context.userId, route: ARRIVAL_ROUTE, promptVersionId: null,
        model: ARRIVAL_MODEL, status: "no_key", metadata: { phase: "questions" },
      });
      return { questions: null };
    }

    const rl = await consumeAiRateLimit(context.userId, ARRIVAL_ROUTE, AI_RATE_LIMITS[ARRIVAL_ROUTE]);
    if (!rl.allowed) {
      await logInvocation({
        userId: context.userId, route: ARRIVAL_ROUTE, promptVersionId: null,
        model: ARRIVAL_MODEL, status: "rate_limited", metadata: { phase: "questions" },
      });
      return { questions: null };
    }

    // Light context: recent mood words and one shared journal title.
    const [moodsRes, journalRes] = await Promise.all([
      context.supabase.from("mood_logs").select("mood_score, note").order("created_at", { ascending: false }).limit(4),
      context.supabase.from("journal_entries").select("title").eq("is_ai_readable", true)
        .order("created_at", { ascending: false }).limit(1),
    ]);
    const timeOfDay = istTimeOfDay(); // the reader's time of day in India, not the UTC server's
    const recentScores = (moodsRes.data ?? []).map((m) => m.mood_score).join(", ");
    const lastNote = (moodsRes.data ?? []).find((m) => m.note)?.note?.slice(0, 100) ?? "";
    const journalTitle = journalRes.data?.[0]?.title?.slice(0, 60) ?? "";

    const brief = [
      `Mood word just chosen: "${data.mood_word}" (${data.mood_score}/10).`,
      `Time: ${timeOfDay}.`,
      recentScores ? `Recent mood scores, newest first: ${recentScores}.` : "",
      lastNote ? `Their previous arrival note: "${lastNote}".` : "",
      journalTitle ? `A recent journal title they chose to share: "${journalTitle}".` : "",
    ].filter(Boolean).join(" ");

    const promptVersionId = await registerPromptVersion({
      promptName: "arrival.questions", model: ARRIVAL_MODEL, systemText: QUESTIONS_SYSTEM,
    });
    const startedAt = Date.now();
    try {
      const google = createGoogleGenerativeAI({ apiKey: key });
      const result = await generateText({
        model: google(ARRIVAL_MODEL),
        system: QUESTIONS_SYSTEM,
        messages: [{ role: "user", content: brief }],
      });
      const questions = parseArrivalQuestions(result.text);
      await logInvocation({
        userId: context.userId, route: ARRIVAL_ROUTE, promptVersionId,
        model: ARRIVAL_MODEL, status: questions ? "ok" : "error",
        errorCode: questions ? null : "unparseable_questions",
        latencyMs: Date.now() - startedAt,
        outputChars: result.text.length,
        metadata: { phase: "questions" },
      });
      return { questions };
    } catch (err) {
      const kind = classifyAiError(err);
      if (kind === "invalid_key") logAiKeyIssue(ARRIVAL_ROUTE, "invalid", err);
      await logInvocation({
        userId: context.userId, route: ARRIVAL_ROUTE, promptVersionId,
        model: ARRIVAL_MODEL, status: "error",
        errorCode: kind === "invalid_key"
          ? "invalid_api_key"
          : String((err as { name?: string })?.name ?? "generate_error"),
        latencyMs: Date.now() - startedAt, metadata: { phase: "questions" },
      });
      return { questions: null };
    }
  });

export const generateArrivalRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      mood_word: z.string().min(2).max(24),
      qa: z.array(z.object({ q: z.string().max(120), a: z.string().max(48) })).length(2),
    }).parse(i),
  )
  .handler(async ({ data, context }): Promise<{ read: string | null }> => {
    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!key) {
      logAiKeyIssue(ARRIVAL_ROUTE, "missing");
      return { read: null };
    }

    const rl = await consumeAiRateLimit(context.userId, ARRIVAL_ROUTE, AI_RATE_LIMITS[ARRIVAL_ROUTE]);
    if (!rl.allowed) return { read: null };

    const brief = `Mood word: "${data.mood_word}". ${data.qa
      .map((p) => `Q: ${p.q} A: ${p.a}.`)
      .join(" ")}`;

    const promptVersionId = await registerPromptVersion({
      promptName: "arrival.read", model: ARRIVAL_MODEL, systemText: READ_SYSTEM,
    });
    const startedAt = Date.now();
    try {
      const google = createGoogleGenerativeAI({ apiKey: key });
      const result = await generateText({
        model: google(ARRIVAL_MODEL),
        system: READ_SYSTEM,
        messages: [{ role: "user", content: brief }],
      });
      const read = parseArrivalRead(result.text);
      await logInvocation({
        userId: context.userId, route: ARRIVAL_ROUTE, promptVersionId,
        model: ARRIVAL_MODEL, status: read ? "ok" : "error",
        errorCode: read ? null : "unparseable_read",
        latencyMs: Date.now() - startedAt,
        outputChars: result.text.length,
        metadata: { phase: "read" },
      });
      return { read };
    } catch (err) {
      const kind = classifyAiError(err);
      if (kind === "invalid_key") logAiKeyIssue(ARRIVAL_ROUTE, "invalid", err);
      await logInvocation({
        userId: context.userId, route: ARRIVAL_ROUTE, promptVersionId,
        model: ARRIVAL_MODEL, status: "error",
        errorCode: kind === "invalid_key"
          ? "invalid_api_key"
          : String((err as { name?: string })?.name ?? "generate_error"),
        latencyMs: Date.now() - startedAt, metadata: { phase: "read" },
      });
      return { read: null };
    }
  });
