import { createFileRoute } from "@tanstack/react-router";
import { streamText, type ModelMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  createLovableAiGatewayProvider,
  COMPANION_SYSTEM_PROMPT,
} from "@/lib/ai-gateway.server";
import {
  AI_RATE_LIMITS,
  consumeAiRateLimit,
  rateLimitedResponse,
} from "@/lib/ai-rate-limit.server";
import {
  registerPromptVersion,
  logInvocation,
} from "@/lib/ai-prompt-registry.server";

// One companion, one mind: the facets (steadying, building, the page,
// deeper water) live inside the system prompt, not in separate sub-agents.
const COMPANION_MODEL = "openai/gpt-5.5";
const COMPANION_ROUTE = "companion.stream";

const CRISIS_KEYWORDS = [
  "kill myself", "suicide", "end my life", "want to die", "hurt myself",
  "self harm", "self-harm", "cutting myself", "end it all",
  "don't want to be here", "dont want to be here", "no reason to live",
  "no point in living", "can't go on", "cant go on", "better off without me",
  "want to disappear", "end everything", "give up on life", "take my own life",
  "overdose", "jump off",
  "marna chahta", "marna chahti", "jeena nahi", "khatam karna chahta", "zindagi khatam",
];

const SUPPORT_KEYWORDS = [
  "hopeless", "worthless", "nobody would care", "what's the point",
  "tired of everything", "can't take it anymore",
];

const CRISIS_REPLY = `I hear you, and I'm so glad you wrote those words instead of holding them alone. What you're feeling matters, and it deserves real, immediate care — more than I can give as a reflection guide.

Please reach out right now to someone who can be with you:

• India — Tele-MANAS: 14416 or 1-800-891-4416
• Or contact your local emergency services

You can also tap the SOS button in the app for a 60-second breath and grounding. You don't have to carry this minute by yourself.`;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAny(text: string, keywords: string[]): boolean {
  const n = normalize(text);
  return keywords.some((k) => n.includes(normalize(k)));
}

function detectCrisis(text: string): boolean {
  return matchesAny(text, CRISIS_KEYWORDS);
}

function detectSupport(text: string): boolean {
  return matchesAny(text, SUPPORT_KEYWORDS);
}

/**
 * Hash an arbitrary string into a stable hex digest. Used to build
 * idempotency keys for safety_events so the same crisis turn never logs
 * twice, even across retries.
 */
async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Insert a safety event using the service-role admin client.
 *
 * Why: RLS on public.safety_events only allows SELECT for the owner; there is
 * no INSERT policy for `authenticated`, so writes from the user-scoped client
 * fail silently. Safety logging must never be skipped, so we bypass RLS with
 * the admin client — but only after the caller is verified (this handler
 * already validated the bearer token before calling us).
 *
 * The admin client is imported dynamically inside this function so the
 * server-only module never enters the client bundle graph.
 *
 * Returns true on success, false if all retries failed. Failures are logged
 * but never thrown — a failed log must not block the crisis reply.
 */
async function logSafetyEventSafely(row: {
  user_id: string;
  event_type: string;
  severity?: string;
  risk_level?: string;
  resource_shown?: string | null;
  action_taken?: string;
  flagged_categories?: Record<string, string>;
  session_id?: string | null;
  idempotency_key?: string | null;
}): Promise<boolean> {
  let admin;
  try {
    ({ supabaseAdmin: admin } = await import("@/integrations/supabase/client.server"));
  } catch (err) {
    console.error("[safety_events] failed to load admin client", err);
    return false;
  }

  const payload = {
    user_id: row.user_id,
    event_type: row.event_type,
    severity: row.severity ?? "high",
    risk_level: row.risk_level ?? "elevated",
    resource_shown: row.resource_shown ?? null,
    action_taken: row.action_taken ?? "logged",
    flagged_categories: row.flagged_categories ?? {},
    session_id: row.session_id ?? null,
    idempotency_key: row.idempotency_key ?? null,
  };

  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      // Use upsert on (user_id, idempotency_key) so retries — whether from
      // our own backoff loop or from the client resending the same crisis
      // turn — never create duplicate safety log rows. Falls back to plain
      // insert when no idempotency key is provided.
      const query = payload.idempotency_key
        ? admin
            .from("safety_events")
            .upsert(payload, {
              onConflict: "user_id,idempotency_key",
              ignoreDuplicates: true,
            })
        : admin.from("safety_events").insert(payload);
      const { error } = await query;
      if (!error) return true;
      console.error(
        `[safety_events] insert failed (attempt ${attempt}/${MAX_ATTEMPTS})`,
        { code: error.code, message: error.message, user_id: row.user_id },
      );
    } catch (err) {
      console.error(
        `[safety_events] insert threw (attempt ${attempt}/${MAX_ATTEMPTS})`,
        err,
      );
    }
    if (attempt < MAX_ATTEMPTS) {
      // Small backoff — 100ms, 300ms. Bounded so we never delay the user.
      await new Promise((r) => setTimeout(r, attempt === 1 ? 100 : 300));
    }
  }
  return false;
}

type ReqBody = { conversationId: string | null; message: string; tone?: "gentle" | "poetic" | "practical" };

export const Route = createFileRoute("/api/companion")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice(7);

        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
        if (claimsErr || !claimsData?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }
        const userId = claimsData.claims.sub;

        const body = (await request.json()) as ReqBody;
        if (!body?.message || typeof body.message !== "string") {
          return new Response("Bad Request", { status: 400 });
        }

        // Ensure conversation
        let conversationId = body.conversationId;
        if (!conversationId) {
          const { data: conv, error } = await supabase
            .from("ai_conversations")
            .insert({ user_id: userId, mode: "reflection", title: body.message.slice(0, 60) })
            .select("id")
            .single();
          if (error || !conv) return new Response("Failed to create conversation", { status: 500 });
          conversationId = conv.id;
        }

        // Look at recent user history so a crisis disclosure followed by
        // "never mind" still keeps the careful tone.
        const { data: recentUserMsgs } = await supabase
          .from("ai_messages")
          .select("content")
          .eq("conversation_id", conversationId)
          .eq("role", "user")
          .order("created_at", { ascending: false })
          .limit(2);
        const recentUserText = [body.message, ...(recentUserMsgs ?? []).map((m) => m.content)];
        const isCrisis = recentUserText.some(detectCrisis);
        const isSupport = !isCrisis && detectSupport(body.message);

        // Save user message
        await supabase.from("ai_messages").insert({
          conversation_id: conversationId,
          user_id: userId,
          role: "user",
          content: body.message,
          risk_label: isCrisis ? "crisis" : isSupport ? "support" : null,
        });

        const encoder = new TextEncoder();
        const convId = conversationId;

        // Helper to build an SSE-ish framed stream: lines prefixed with event types
        const writeFrame = (controller: ReadableStreamDefaultController, type: string, data: string) => {
          controller.enqueue(encoder.encode(`${type}:${data}\n`));
        };

        if (isCrisis) {
          // Stable key for this crisis turn: same user + conversation + message
          // content always produces the same key, so any retry (network blip,
          // client resend, internal backoff) collapses into one row.
          const idempotencyKey = await sha256Hex(
            `crisis:${convId}:${body.message}`,
          );
          // Log the safety event with retries via the admin client.
          // We don't block the reply on this — if it fails after retries the
          // user still gets the crisis resources immediately.
          await logSafetyEventSafely({
            user_id: userId,
            event_type: "crisis_keyword_detected",
            severity: "high",
            risk_level: "crisis",
            resource_shown: "tele_manas",
            action_taken: "crisis_reply_shown",
            flagged_categories: { source: "companion_api", matched: "crisis_keyword" },
            session_id: convId,
            idempotency_key: idempotencyKey,
          });
          await supabase.from("ai_messages").insert({
            conversation_id: convId,
            user_id: userId,
            role: "assistant",
            content: CRISIS_REPLY,
            risk_label: "crisis",
          });
          const stream = new ReadableStream({
            async start(controller) {
              writeFrame(controller, "meta", JSON.stringify({ conversationId: convId, crisis: true }));
              writeFrame(controller, "phase", "crisis");
              // Stream char-by-char with calm pacing
              for (const ch of CRISIS_REPLY) {
                writeFrame(controller, "token", JSON.stringify(ch));
                await new Promise((r) => setTimeout(r, 8));
              }
              writeFrame(controller, "done", "1");
              controller.close();
            },
          });
          return new Response(stream, {
            headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
          });
        }

        // Rate limit AFTER the crisis branch — safety responses must never
        // be gated by abuse protection. Logged as a separate invocation row
        // so we can see who's being throttled and why.
        const rl = await consumeAiRateLimit(userId, COMPANION_ROUTE, AI_RATE_LIMITS[COMPANION_ROUTE]);
        if (!rl.allowed) {
          await logInvocation({
            userId,
            route: COMPANION_ROUTE,
            promptVersionId: null,
            model: COMPANION_MODEL,
            status: "rate_limited",
            metadata: { conversation_id: convId, retry_after_seconds: rl.retryAfterSeconds },
          });
          return rateLimitedResponse(rl);
        }

        // Load context: latest 20 messages (descending, then reversed so the
        // model sees them in chronological order). Previously this loaded the
        // EARLIEST 20 messages, so long conversations lost recent context.
        const { data: historyDesc } = await supabase
          .from("ai_messages")
          .select("role, content, created_at")
          .eq("conversation_id", convId)
          .order("created_at", { ascending: false })
          .limit(20);
        const history = (historyDesc ?? []).slice().reverse();

        const [moodsRes, journalRes, profileRes, prevConvRes] = await Promise.all([
          supabase.from("mood_logs").select("mood_score, emotion_tags, note, created_at").order("created_at", { ascending: false }).limit(6),
          supabase.from("journal_entries").select("title, body, created_at, is_ai_readable").eq("is_ai_readable", true).order("created_at", { ascending: false }).limit(2),
          supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
          supabase
            .from("ai_conversations")
            .select("id, updated_at")
            .neq("id", convId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        const [storyRes, memoriesRes, prevMsgsRes] = await Promise.all([
          supabase.from("user_story").select("*").eq("user_id", userId).maybeSingle(),
          supabase
            .from("memories")
            .select("title, story, memory_date, feeling_tag, is_ai_readable")
            .eq("is_ai_readable", true)
            .order("memory_date", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false })
            .limit(3),
          prevConvRes.data?.id
            ? supabase
                .from("ai_messages")
                .select("role, content, created_at")
                .eq("conversation_id", prevConvRes.data.id)
                .order("created_at", { ascending: false })
                .limit(4)
            : Promise.resolve({ data: null }),
        ]);

        const moods = moodsRes.data ?? [];
        const moodLine = moods
          .slice(0, 3)
          .map((m) => {
            const tags = (m.emotion_tags ?? []).slice(0, 3).join("/");
            return `${m.mood_score}/10${tags ? ` (${tags})` : ""}`;
          })
          .join(", ");
        // Trajectory reads more human than raw numbers: compare the newest
        // check-ins against the ones before them.
        let moodTrend = "";
        if (moods.length >= 4) {
          const recent = moods.slice(0, 3).reduce((s, m) => s + m.mood_score, 0) / 3;
          const before = moods.slice(3).reduce((s, m) => s + m.mood_score, 0) / (moods.length - 3);
          moodTrend = recent - before > 0.8 ? "lifting lately" : before - recent > 0.8 ? "heavier lately" : "holding steady";
        }
        const journalSnippets = (journalRes.data ?? [])
          .map((j) => `${j.title ?? ""}${j.title ? " — " : ""}${(j.body ?? "").slice(0, 140)}`.trim())
          .filter(Boolean);

        const displayName = (profileRes.data?.display_name ?? "").trim();

        // A short tail of their previous conversation, so a new chat can
        // gently pick the thread back up instead of starting cold.
        const prevMsgs = (prevMsgsRes.data ?? []).slice().reverse();
        const prevAgeDays = prevConvRes.data?.updated_at
          ? Math.max(0, Math.round((Date.now() - new Date(prevConvRes.data.updated_at).getTime()) / 86_400_000))
          : null;
        const prevThreadLines = prevMsgs.map((m) => {
          const who = m.role === "user" ? "them" : "you";
          return `${who}: ${(m.content ?? "").replace(/\s+/g, " ").slice(0, 110)}`;
        });

        const now = new Date();
        const hour = now.getHours();
        const timeOfDay =
          hour < 5 ? "late night" : hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "night";
        const weekday = now.toLocaleDateString("en-US", { weekday: "long" });

        const contextBrief = [
          `It is ${weekday} ${timeOfDay}.`,
          displayName ? `Their name: ${displayName} (use sparingly, never in every reply).` : "",
          moodLine ? `Recent moods on a 1–10 scale (1–2 very low, 3–4 heavy, 5–6 neutral, 7–8 steady, 9–10 peaceful), newest first: ${moodLine}${moodTrend ? ` — overall ${moodTrend}` : ""}.` : "",
          journalSnippets.length ? `Recent journal notes: ${journalSnippets.map((s) => `"${s}"`).join(" · ")}.` : "",
        ].filter(Boolean).join(" ");

        // What the user has shared about themselves
        const story = storyRes.data;
        const storyLines: string[] = [];
        if (story?.is_ai_readable) {
          if (story.roots) storyLines.push(`Roots: ${story.roots}`);
          if (story.current_chapter) storyLines.push(`Current chapter: ${story.current_chapter}`);
          if (story.people) storyLines.push(`People who matter: ${story.people}`);
          if (story.healing_from) storyLines.push(`Healing from: ${story.healing_from}`);
          if (story.speaking_preference) storyLines.push(`How they like to be spoken to: ${story.speaking_preference}`);
        }
        const storyBlock = storyLines.length
          ? `\n\nWHAT THE USER HAS SHARED ABOUT THEMSELVES (use silently to understand them; never recite back as a list; reference at most one detail per reply, and only when genuinely relevant): ${storyLines.join(" | ")}`
          : "";

        const memoryLines = (memoriesRes.data ?? []).map((m) => {
          const date = m.memory_date ?? "undated";
          const title = (m.title ?? "untitled").trim();
          const snippet = (m.story ?? "").slice(0, 100).trim();
          return `[${date}] — ${title}: ${snippet}`;
        });
        const memoryBlock = memoryLines.length
          ? `\n\nMemories they chose to share: ${memoryLines.join(" / ")}`
          : "";

        const prevThreadBlock = prevThreadLines.length
          ? `\n\nTHREAD FROM THEIR LAST CONVERSATION (${prevAgeDays === 0 ? "earlier today" : prevAgeDays === 1 ? "yesterday" : `${prevAgeDays} days ago`} — silent background only; acknowledge at most once, only if clearly relevant to what they bring up now; never recite it):\n${prevThreadLines.join("\n")}`
          : "";

        const honorRules = (storyLines.length || memoryLines.length)
          ? "\n\nRULES: If they shared 'how I like to be spoken to', honor it in every reply. Never pretend to remember anything they did not write here. Never speak AS or FOR any person they mentioned — you may acknowledge that someone matters to them, but you must never simulate that person's voice, imagine their thoughts, or compose messages from them."
          : "";

        const toneModifier = (() => {
          switch (body.tone) {
            case "gentle":
              return "\n\nTONE FOR THIS REPLY: Use an especially gentle, warm, and patient tone — like a trusted friend sitting beside the user in soft light. Soften your language, allow pauses, and offer comfort without rushing.";
            case "poetic":
              return "\n\nTONE FOR THIS REPLY: Use a lyrical, metaphorical, and spacious tone. Let imagery and rhythm carry the feeling. Allow silence between thoughts, and use natural metaphors that evoke warmth and depth.";
            case "practical":
              return "\n\nTONE FOR THIS REPLY: Use a grounded, direct, and practical tone. Offer concrete steps, clear framing, and actionable clarity. Be kind but focused on what the user can do or understand right now.";
            default:
              return "";
          }
        })();

        const baseContext = contextBrief
          ? `${COMPANION_SYSTEM_PROMPT}\n\nCONTEXT (silent; do not quote unless asked): ${contextBrief}`
          : COMPANION_SYSTEM_PROMPT;
        const systemWithContext = `${baseContext}${storyBlock}${memoryBlock}${prevThreadBlock}${honorRules}${toneModifier}`;

        const supportModifier = isSupport
          ? "\n\nThe user may be in elevated distress. Be extra gentle, do not problem-solve, and end your reply with one soft line reminding them that Tele-MANAS 14416 exists if things feel too heavy."
          : "";
        const systemFinal = systemWithContext + supportModifier;

        if (isSupport) {
          const supportKey = await sha256Hex(
            `support:${convId}:${body.message}`,
          );
          await logSafetyEventSafely({
            user_id: userId,
            event_type: "support_keyword_detected",
            severity: "medium",
            risk_level: "elevated",
            resource_shown: "tele_manas",
            action_taken: "support_reminder_shown",
            flagged_categories: { source: "companion_api", matched: "support_keyword" },
            session_id: convId,
            idempotency_key: supportKey,
          });
        }

        const messages: ModelMessage[] = [
          ...(history ?? []).map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ];

        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          await logInvocation({
            userId,
            route: COMPANION_ROUTE,
            promptVersionId: null,
            model: COMPANION_MODEL,
            status: "no_key",
            metadata: { conversation_id: convId },
          });
          const stream = new ReadableStream({
            async start(controller) {
              writeFrame(controller, "meta", JSON.stringify({ conversationId: convId, crisis: false }));
              writeFrame(controller, "phase", "ready");
              const msg = "I'm here, quietly. (AI is not configured yet — your words are safely saved.)";
              for (const ch of msg) {
                writeFrame(controller, "token", JSON.stringify(ch));
                await new Promise((r) => setTimeout(r, 10));
              }
              writeFrame(controller, "done", "1");
              controller.close();
            },
          });
          return new Response(stream, {
            headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
          });
        }

        const gateway = createLovableAiGatewayProvider(key);

        // Register the exact system prompt + model combo we're about to use,
        // so the invocation log can point back to a stable version row.
        const promptVersionId = await registerPromptVersion({
          promptName: "companion.system",
          model: COMPANION_MODEL,
          systemText: systemFinal,
          metadata: { tone: body.tone ?? null, support: isSupport },
        });
        const invocationStart = Date.now();

        const result = streamText({
          model: gateway(COMPANION_MODEL),
          system: systemFinal,
          messages,
        });

        const stream = new ReadableStream({
          async start(controller) {
            writeFrame(controller, "meta", JSON.stringify({ conversationId: convId, crisis: false }));
            // Calming phase cues before tokens arrive
            writeFrame(controller, "phase", "listening");
            await new Promise((r) => setTimeout(r, 350));
            writeFrame(controller, "phase", "grounding");
            await new Promise((r) => setTimeout(r, 450));
            writeFrame(controller, "phase", "ready");

            let full = "";
            let streamError: unknown = null;
            try {
              for await (const delta of result.textStream) {
                full += delta;
                writeFrame(controller, "token", JSON.stringify(delta));
              }
            } catch (err) {
              console.error("Companion stream error:", err);
              streamError = err;
              const fallback = "I'm here with you, but I'm having trouble finding my words right now. Try again in a moment.";
              if (!full) {
                full = fallback;
                writeFrame(controller, "token", JSON.stringify(fallback));
              }
            }

            // Infer which facet of InnerMate this turn leaned into, so the UI
            // can surface mode-appropriate follow-up chips and the live facet
            // line. One companion — the mode is a reading of the moment, not
            // a separate helper.
            let mode:
              | "listen" | "reset" | "habit" | "journal"
              | "wisdom" | "decision" | "grounding" = "listen";
            const lower = body.message.toLowerCase();
            const decisionHints = [
              "should i", "shall i", "what should", "do i ", "decide",
              "decision", "tell them", "say to them", "block them",
              "text them", "message them", "confront",
            ];
            const groundingHints = [
              "panic", "panicking", "can't breathe", "cant breathe",
              "shaking", "overwhelmed", "freaking out", "ground me",
              "calm me", "calm down", "anxiety attack", "racing heart",
              "spiraling", "spiralling",
            ];
            const resetHints = [
              "urge", "impulse", "stop myself", "before i do something",
              "keep checking", "her profile", "his profile", "their profile",
              "delete the chat", "unblock", "stalking", "one more text",
            ];
            const habitHints = [
              "habit", "routine", "discipline", "consistent", "every day",
              "sleep schedule", "wake up early", "focus", "gym", "start again",
              "restart", "get back on track", "how do i start",
            ];
            const journalHints = [
              "journal", "write it", "writing", "write about", "unsent letter",
              "on paper", "put into words", "facts from feelings",
            ];
            const wisdomHints = [
              "meaning", "purpose", "wisdom", "perspective on", "attachment",
              "let go of", "letting go", "karma", "a quote", "gita",
              "why does life", "what's the point of it all",
            ];
            if (decisionHints.some((k) => lower.includes(k))) mode = "decision";
            else if (groundingHints.some((k) => lower.includes(k))) mode = "grounding";
            else if (resetHints.some((k) => lower.includes(k))) mode = "reset";
            else if (habitHints.some((k) => lower.includes(k))) mode = "habit";
            else if (journalHints.some((k) => lower.includes(k))) mode = "journal";
            else if (wisdomHints.some((k) => lower.includes(k))) mode = "wisdom";
            writeFrame(controller, "mode", mode);

            // Persist assistant message
            try {
              await supabase.from("ai_messages").insert({
                conversation_id: convId,
                user_id: userId,
                role: "assistant",
                content: full || "(no response)",
              });
            } catch (e) {
              console.error("Failed to persist assistant message", e);
            }

            writeFrame(controller, "done", "1");
            controller.close();

            // Log this invocation last — never throws; never blocks the user.
            await logInvocation({
              userId,
              route: COMPANION_ROUTE,
              promptVersionId,
              model: COMPANION_MODEL,
              status: streamError ? "error" : "ok",
              errorCode: streamError ? String((streamError as { name?: string })?.name ?? "stream_error") : null,
              latencyMs: Date.now() - invocationStart,
              inputChars: body.message.length,
              outputChars: full.length,
              metadata: { conversation_id: convId, mode, tone: body.tone ?? null, support: isSupport },
            });
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});