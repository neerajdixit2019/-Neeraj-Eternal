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
import { classifyInnerMateMessage, toWireMode } from "@/lib/companion-risk";
import { buildActiveDangerReply, buildSafetyCheckFallback } from "@/lib/crisis-resources";
import { wisdomGroundingBlock } from "@/lib/wisdom";

// One companion, one mind: the facets (steadying, building, the page,
// deeper water) live inside the system prompt, not in separate sub-agents.
const COMPANION_MODEL = "openai/gpt-5.5";
const COMPANION_ROUTE = "companion.stream";

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
  // Some @tanstack/react-start versions don't type the `server` route
  // option even though the runtime supports it — this IS the live streaming
  // endpoint. ts-ignore (not expect-error) so the suppression is a no-op on
  // environments whose typings already declare it (e.g. Lovable's newer
  // version). Type-only; behaviour unchanged.
  // @ts-ignore server handlers are supported at runtime; typings vary by version
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
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

        // Classify with recent history so a risk disclosure followed by a
        // short answer ("safe" / "not safe") is understood in context. Risk
        // labels on recent rows keep the safety posture open even after the
        // raw-text window rolls past the original disclosure.
        const { data: recentMsgs } = await supabase
          .from("ai_messages")
          .select("content, role, risk_label")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: false })
          .limit(6);
        const risk = classifyInnerMateMessage(body.message, {
          recentUserMessages: (recentMsgs ?? [])
            .filter((m) => m.role === "user")
            .slice(0, 3)
            .map((m) => m.content),
          recentRiskLabel: (recentMsgs ?? []).some(
            (m) => m.risk_label === "crisis" || m.risk_label === "support",
          ),
        });
        const isCrisis = risk.riskLevel === 3;

        // Save user message
        await supabase.from("ai_messages").insert({
          conversation_id: conversationId,
          user_id: userId,
          role: "user",
          content: body.message,
          risk_label: isCrisis ? "crisis" : risk.riskLevel === 2 ? "support" : null,
        });

        const encoder = new TextEncoder();
        const convId = conversationId;

        // Helper to build an SSE-ish framed stream: lines prefixed with event types
        const writeFrame = (controller: ReadableStreamDefaultController, type: string, data: string) => {
          controller.enqueue(encoder.encode(`${type}:${data}\n`));
        };

        if (isCrisis) {
          // Level 3 — active danger. The reply is deterministic (never
          // model-generated) and built ONLY from verified crisis resources.
          const crisisReply = buildActiveDangerReply();
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
            flagged_categories: { source: "companion_api", matched: risk.reason },
            session_id: convId,
            idempotency_key: idempotencyKey,
          });
          await supabase.from("ai_messages").insert({
            conversation_id: convId,
            user_id: userId,
            role: "assistant",
            content: crisisReply,
            risk_label: "crisis",
          });
          const stream = new ReadableStream({
            async start(controller) {
              writeFrame(controller, "meta", JSON.stringify({ conversationId: convId, crisis: true }));
              writeFrame(controller, "phase", "crisis");
              // Stream char-by-char with calm pacing
              for (const ch of crisisReply) {
                writeFrame(controller, "token", JSON.stringify(ch));
                await new Promise((r) => setTimeout(r, 8));
              }
              writeFrame(controller, "mode", "safety");
              writeFrame(controller, "done", "1");
              controller.close();
            },
          });
          return new Response(stream, {
            headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
          });
        }

        // Log the Level-2 safety event BEFORE any rate limiting — the audit
        // trail of a risk disclosure must never depend on abuse protection.
        if (risk.riskLevel === 2) {
          const supportKey = await sha256Hex(
            `support:${convId}:${body.message}`,
          );
          await logSafetyEventSafely({
            user_id: userId,
            event_type: "support_keyword_detected",
            severity: "medium",
            risk_level: "elevated",
            resource_shown: risk.safetyFollowUp === "confirmed_safe" ? null : "sos_button",
            action_taken: risk.safetyFollowUp === "confirmed_safe" ? "safety_confirmed_by_user" : "safety_check_asked",
            flagged_categories: { source: "companion_api", matched: risk.reason },
            session_id: convId,
            idempotency_key: supportKey,
          });
        }

        // Rate limit AFTER the safety branches. If a Level-2 user is
        // throttled, they still get a deterministic safety-check reply —
        // never a bare 429.
        const rl = await consumeAiRateLimit(userId, COMPANION_ROUTE, AI_RATE_LIMITS[COMPANION_ROUTE]);
        if (!rl.allowed) {
          await logInvocation({
            userId,
            route: COMPANION_ROUTE,
            promptVersionId: null,
            model: COMPANION_MODEL,
            status: "rate_limited",
            metadata: { conversation_id: convId, retry_after_seconds: rl.retryAfterSeconds, risk_level: risk.riskLevel },
          });
          if (risk.riskLevel === 2) {
            const fallback = buildSafetyCheckFallback();
            await supabase.from("ai_messages").insert({
              conversation_id: convId,
              user_id: userId,
              role: "assistant",
              content: fallback,
              risk_label: "support",
            });
            const stream = new ReadableStream({
              async start(controller) {
                writeFrame(controller, "meta", JSON.stringify({ conversationId: convId, crisis: false }));
                writeFrame(controller, "phase", "ready");
                for (const ch of fallback) {
                  writeFrame(controller, "token", JSON.stringify(ch));
                  await new Promise((r) => setTimeout(r, 8));
                }
                writeFrame(controller, "mode", "safety");
                writeFrame(controller, "done", "1");
                controller.close();
              },
            });
            return new Response(stream, {
              headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
            });
          }
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

        // The latest check-in note carries the Home mindset answers
        // ("arriving: heavy · mind: circling one thing · needs: rest") —
        // the quiet channel through which the companion understands how
        // they arrived today.
        const latestNote = (moods[0]?.note ?? "").trim().slice(0, 160);

        const contextBrief = [
          `It is ${weekday} ${timeOfDay}.`,
          displayName ? `Their name: ${displayName} (use sparingly, never in every reply).` : "",
          moodLine ? `Recent moods on a 1–10 scale (1–2 very low, 3–4 heavy, 5–6 neutral, 7–8 steady, 9–10 peaceful), newest first: ${moodLine}${moodTrend ? ` — overall ${moodTrend}` : ""}.` : "",
          latestNote ? `Their latest check-in, in their words or from the arrival questions: "${latestNote}".` : "",
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

        // Always on — memory honesty and voice-simulation bans must not
        // depend on whether the user happened to share a story or memories.
        const honorRules =
          "\n\nRULES: If they shared 'how I like to be spoken to', honor it in every reply. Never pretend to remember anything that is not in this context — your view of their journal and history is a small, user-approved slice, so never invent entries, dates, or trends. Never speak AS or FOR any person they mentioned — you may acknowledge that someone matters to them, but you must never simulate that person's voice, imagine their thoughts, or compose messages from them.";

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

        // Risk-level modifiers. Level 3 never reaches here (deterministic
        // reply above). Level 2 is warm and trust-first with ONE safety
        // check; Level 1 reframes without escalation; Level 0 adds nothing.
        const riskModifier = (() => {
          if (risk.riskLevel === 2 && risk.thirdParty) {
            return `\n\nSAFETY MODE — SOMEONE ELSE IS AT RISK. The user is afraid for another person, not themselves. Stay with THEM first: their fear is real and heavy. Then, briefly and concretely: (1) taking it seriously was right; (2) the most helpful moves are staying in contact, telling a trusted adult or person close to that friend, and helping the friend reach crisis support — the app's SOS page has verified numbers they can share; (3) if danger sounds immediate, this is not a secret to keep — emergency services exist for exactly this; (4) one line making clear they cannot carry this alone and it is not their job to be the rescue. No philosophy, no journaling, short sentences. Do not write phone numbers yourself.`;
          }
          if (risk.riskLevel === 2 && risk.harmOthers) {
            return `\n\nSAFETY MODE — ANGER WITH INTENT TOWARD ANOTHER PERSON. Stay calm and completely non-judgmental; anger this hot usually sits on top of hurt. Do NOT analyze the grievance, take sides, or help plan any confrontation, message, or payback. In 3-5 short sentences: acknowledge the heat without feeding it, name that acting on it would cost THEM the most, give one immediate physical de-escalation step (leave the room, cold water on the face, walk without the phone), and ask them to check back in ten minutes. If they described being about to physically harm someone right now, tell them plainly to put distance between themselves and that person before anything else. No hotline numbers, no philosophy, no journaling.`;
          }
          if (risk.riskLevel === 2 && risk.carryOver) {
            return `\n\nSAFETY CONTEXT — a recent message in this conversation contained risk language, and the safety question may still be open. Stay warm and watchful. If they asked for grounding, guide one small two-minute practice in short sentences. Whatever they said, weave ONE natural check into your reply, e.g. "and just so I know you're okay: safe, for now?", without restarting the whole script. No hotline numbers. No journaling or deep-reflection suggestions yet. Keep it short.`;
          }
          if (risk.riskLevel === 2 && risk.safetyFollowUp === "confirmed_safe") {
            return `\n\nSAFETY MODE — THEY JUST CONFIRMED THEY CAN STAY SAFE. Thank them briefly for answering, without ceremony. Then: one tiny grounding instruction (water, feet on the floor, sit somewhere visible), and gently return to the pain that started this — invite them to tell you what happened. One practical step at most. Keep it under 90 words. No hotline numbers. Example rhythm: "Good. Stay with me for the next 10 minutes. The exam pain is real, but we won't let one result decide the whole story. First, drink some water and sit somewhere visible. Then tell me: what happened?"`;
          }
          if (risk.riskLevel === 2) {
            return `\n\nSAFETY MODE — PASSIVE RISK DETECTED (they said something like not wanting to live, with no plan or means). Override the usual 2-3 sentence limit: reply in 90-150 words, calm and direct, in this order:
1) Meet the concrete pain first in one or two grounded sentences (e.g. "Failing the exam hurts. But this result is not a verdict on your life."). No drama, no lecture.
2) Then ONE direct safety check, plainly: "When you say that, I want to check one thing first — are you in danger of hurting yourself, or can you stay safe for the next 10 minutes?"
3) One conditional line, not a disclaimer: "If there's any chance you may hurt yourself, please don't stay alone. Tap SOS below, or call someone near you and say: 'Please stay with me. I'm not okay right now.'"
4) Close with one tiny physical instruction and ask them to reply with one word: safe or not safe.
DO NOT: include any hotline numbers (the app surfaces those), quote philosophy or scripture, suggest journaling or deep reflection, use lines like "you are not alone" or "this too shall pass", or ask any other question.`;
          }
          if (risk.riskLevel === 1) {
            return `\n\nHIGH DISTRESS (no self-harm language). Validate strongly and specifically. Separate the event from their identity — what failed is a result, not who they are. Offer one grounding step or one small next step, not both. Ask whether they want to talk it through or calm down first. Keep it short. Do not mention hotlines, SOS, or safety checks unless they introduce self-harm language.`;
          }
          // Level 0: deliver the classifier's read of the moment to the
          // model as a light steer — the facets do the rest.
          switch (risk.responseMode) {
            case "no_impulse":
              return `\n\nTHIS TURN reads like an urge to contact, check, or react. Lead with STEADYING: name the urge kindly, offer one delay (ten minutes for small things, up to 24 hours before big sends or decisions), one replacement action under 20 minutes, and remind them they can decide later from a calmer place — nothing is lost by waiting. Never shame. Keep it short.`;
            case "calm":
              return `\n\nTHIS TURN needs grounding before anything else: short sentences, body before mind, no analysis yet. Offer ONE step now — a 4-4-6 breath together, feet on the floor, or naming five things they can see. If they describe acute physical symptoms (chest pain, numbness, fainting, trouble breathing at rest), say plainly that it could be medical and that checking with emergency services or someone nearby comes before anything we do here.`;
            case "action":
              return `\n\nTHIS TURN asks for direction: give up to three tiny, concrete steps (short numbered lines are allowed here), starting with the very next 25 minutes. One priority, not a system. No productivity platitudes.`;
            case "deep_thinking":
              return `\n\nTHIS TURN reaches for meaning: DEEPER WATER is welcome, one idea in plain language, tied to their situation. If they explicitly asked what a tradition says (the Gita, Stoics, Buddhism), you may name it and take a few extra sentences, still no verse numbers, no preaching. If the reach is about who they are, feeling lost or not like themselves, use the RECONNECTING WITH YOURSELF moves: separate the self from the performance, find the signal through values not mood (when did they last feel most like themselves), and one small act of alignment. Never diagnose identity, never say they've lost their identity.${wisdomGroundingBlock(body.message)}`;
            case "pattern":
              return `\n\nTHIS TURN asks about their patterns. Be honest about your window: you can only see a small, recent, user-approved slice of their writing — never invent history, counts, or trends. Reflect only what is actually in the silent context, say plainly that it's a partial view, and point them to their Insights page, where the full pattern picture (weeks of moods, themes, and rhythms) lives. One real observation at most, then one question.`;
            case "repair":
              return `\n\nREPAIR MODE — they are challenging your last answer (too vague, wrong, contradictory, "what are your qualifications", "that I already know", or "waste of time"). They are right to push. In this order: (1) name the exact miss in one plain sentence ("You're right, I gave you something too soft" / "I overstated that"); (2) state the corrected read or claim ("More accurate: ..."); (3) give a sharper, concrete answer with a test, checklist, or decision rule. Do NOT apologize more than once, do NOT get defensive, do NOT retreat into another poetic or soothing line. If they asked your qualifications, say plainly you're a reflection companion, not a therapist or doctor, then get MORE precise, not more deferential. Become sharper, not softer.`;
            case "precision":
              return `\n\nPRECISION MODE — they asked how exactly / to be specific / how they'd know. Answer the exact question FIRST, in plain language, then give a concrete framework: a short checklist of observable signs, a decision rule, a simple test, or a worked example. Numbered or dashed lines are welcome here. No abstract emotional language unless you immediately explain it in concrete terms. Skip "maybe" and hedging; if something is uncertain, say what would tell them either way. Up to ~180 words; every line must be usable.`;
            case "flatness":
              return `\n\nEMOTIONAL FLATNESS (body ok, mood still low). First, validate plainly that physical clarity does not guarantee happiness — feeling rested or clear does not mean joy has to arrive. Then name the likely state and the missing ingredient: rest fixes tiredness, action fixes stuckness, connection fixes loneliness, meaning fixes emptiness, expression fixes something unspoken. Ask (or reason) which of those fits, and offer ONE small real re-entry into life for the next 10 minutes (a short walk, one message to a person, one small task, or writing the sentence "what is missing right now?"). Do NOT suggest breathing or grounding — this is not panic. Say plainly: you don't need to feel happy before acting; sometimes action comes first and mood follows.`;
            default:
              return "";
          }
        })();
        const systemFinal = systemWithContext + riskModifier;

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
          metadata: { tone: body.tone ?? null, risk_level: risk.riskLevel, response_mode: risk.responseMode },
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

            // The classifier already read this turn — map its response mode
            // onto the wire vocabulary the UI understands, with two light
            // refinements (habit/journal) that only apply when risk is 0.
            let mode = toWireMode(risk);
            if (risk.riskLevel === 0 && mode === "listen") {
              const lower = body.message.toLowerCase();
              const habitHints = [
                "habit", "routine", "discipline", "consistent", "every day",
                "sleep schedule", "wake up early", "gym", "start again",
                "restart", "get back on track", "how do i start",
              ];
              const journalHints = [
                "journal", "write it", "writing", "write about", "unsent letter",
                "on paper", "put into words",
              ];
              if (habitHints.some((k) => lower.includes(k))) mode = "habit";
              else if (journalHints.some((k) => lower.includes(k))) mode = "journal";
            }
            writeFrame(controller, "mode", mode);

            // Persist assistant message. Level-2 turns carry the "support"
            // risk label so the client can restore safety mode after a
            // thread refetch (the mode frame alone lives only in optimistic
            // state).
            try {
              await supabase.from("ai_messages").insert({
                conversation_id: convId,
                user_id: userId,
                role: "assistant",
                content: full || "(no response)",
                risk_label: risk.riskLevel === 2 ? "support" : null,
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
              metadata: { conversation_id: convId, mode, tone: body.tone ?? null, risk_level: risk.riskLevel, response_mode: risk.responseMode },
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