import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText, type ModelMessage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { COMPANION_SYSTEM_PROMPT } from "@/lib/ai-gateway.server";
import { AI_RATE_LIMITS, consumeAiRateLimit } from "@/lib/ai-rate-limit.server";
import { registerPromptVersion, logInvocation } from "@/lib/ai-prompt-registry.server";
import { aiFallbackMessage, classifyAiError, logAiKeyIssue } from "@/lib/ai-error";

// Legacy fallback now uses Google AI Studio directly (bypasses Lovable AI Gateway).
const FALLBACK_MODEL = "gemini-3-flash-preview";
const FALLBACK_ROUTE = "companion.fallback";

const CRISIS_KEYWORDS = [
  "kill myself", "suicide", "end my life", "want to die", "hurt myself",
  "self harm", "self-harm", "cutting myself", "end it all",
];

function detectCrisis(text: string): boolean {
  const t = text.toLowerCase();
  return CRISIS_KEYWORDS.some((k) => t.includes(k));
}

const CRISIS_REPLY = `I hear you, and I'm so glad you wrote those words instead of holding them alone. What you're feeling matters, and it deserves real, immediate care — more than I can give as a reflection guide.

Please reach out right now to someone who can be with you:

• India — Tele-MANAS: 14416 or 1-800-891-4416
• Or contact your local emergency services

You can also tap the SOS button in the app for a 60-second breath and grounding. You don't have to carry this minute by yourself.`;

export const sendCompanionMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      conversationId: z.string().uuid().nullable(),
      message: z.string().min(1).max(4000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Ensure conversation exists
    let conversationId = data.conversationId;
    if (!conversationId) {
      const { data: conv, error: convErr } = await supabase
        .from("ai_conversations")
        .insert({ user_id: userId, mode: "reflection", title: data.message.slice(0, 60) })
        .select("id")
        .single();
      if (convErr || !conv) throw new Error(convErr?.message || "Failed to create conversation");
      conversationId = conv.id;
    }

    // 2. Safety check
    const isCrisis = detectCrisis(data.message);

    // 3. Save user message
    await supabase.from("ai_messages").insert({
      conversation_id: conversationId,
      user_id: userId,
      role: "user",
      content: data.message,
      risk_label: isCrisis ? "crisis" : null,
    });

    if (isCrisis) {
      await supabase.from("safety_events").insert({
        user_id: userId,
        event_type: "crisis_keyword_detected",
        severity: "high",
        resource_shown: "tele_manas",
      });
      await supabase.from("ai_messages").insert({
        conversation_id: conversationId,
        user_id: userId,
        role: "assistant",
        content: CRISIS_REPLY,
        risk_label: "crisis",
      });
      return { conversationId, reply: CRISIS_REPLY, crisis: true };
    }

    // Rate limit after the crisis branch — crisis responses always go through.
    const rl = await consumeAiRateLimit(userId, FALLBACK_ROUTE, AI_RATE_LIMITS[FALLBACK_ROUTE]);
    if (!rl.allowed) {
      await logInvocation({
        userId,
        route: FALLBACK_ROUTE,
        promptVersionId: null,
        model: FALLBACK_MODEL,
        status: "rate_limited",
        metadata: { conversation_id: conversationId, retry_after_seconds: rl.retryAfterSeconds },
      });
      throw new Error("Too many messages right now. Take a slow breath — try again in a few minutes.");
    }

    // 4. Load history (latest 20, ascending for the model)
    // NOTE: This server fn is LEGACY — /api/companion is the live route.
    // Kept for fallback; load the most recent 20 messages, then reverse.
    const { data: historyDesc } = await supabase
      .from("ai_messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(20);
    const history = (historyDesc ?? []).slice().reverse();

    const messages: ModelMessage[] = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // 5. Call Google AI Studio directly, with safe fallback if key missing
    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    let reply: string;
    if (!key) {
      logAiKeyIssue(FALLBACK_ROUTE, "missing");
      await logInvocation({
        userId, route: FALLBACK_ROUTE, promptVersionId: null, model: FALLBACK_MODEL,
        status: "no_key", metadata: { conversation_id: conversationId },
      });
      reply = aiFallbackMessage("no_key");
    } else {
      const promptVersionId = await registerPromptVersion({
        promptName: "companion.system",
        model: FALLBACK_MODEL,
        systemText: COMPANION_SYSTEM_PROMPT,
      });
      const invocationStart = Date.now();
      try {
        const google = createGoogleGenerativeAI({ apiKey: key });
        const result = await generateText({
          model: google(FALLBACK_MODEL),
          system: COMPANION_SYSTEM_PROMPT,
          messages,
        });
        reply = result.text.trim() || "I'm here. Tell me a little more, if you'd like.";
        await logInvocation({
          userId, route: FALLBACK_ROUTE, promptVersionId, model: FALLBACK_MODEL,
          status: "ok",
          latencyMs: Date.now() - invocationStart,
          inputChars: data.message.length,
          outputChars: reply.length,
          metadata: { conversation_id: conversationId },
        });
      } catch (e) {
        console.error("Companion AI error:", e);
        const kind = classifyAiError(e);
        if (kind === "invalid_key") logAiKeyIssue(FALLBACK_ROUTE, "invalid", e);
        await logInvocation({
          userId, route: FALLBACK_ROUTE, promptVersionId, model: FALLBACK_MODEL,
          status: "error",
          errorCode: kind === "invalid_key"
            ? "invalid_api_key"
            : String((e as { name?: string })?.name ?? "generate_error"),
          latencyMs: Date.now() - invocationStart,
          inputChars: data.message.length,
          metadata: { conversation_id: conversationId },
        });
        reply = aiFallbackMessage(kind);
      }
    }

    await supabase.from("ai_messages").insert({
      conversation_id: conversationId,
      user_id: userId,
      role: "assistant",
      content: reply,
    });

    return { conversationId, reply, crisis: false };
  });

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ai_conversations")
      .select("id, title, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: conv } = await context.supabase
      .from("ai_conversations")
      .select("id, title, created_at")
      .eq("id", data.id)
      .maybeSingle();
    const { data: msgs } = await context.supabase
      .from("ai_messages")
      .select("id, role, content, created_at, risk_label")
      .eq("conversation_id", data.id)
      .order("created_at", { ascending: true });
    return { conversation: conv, messages: msgs ?? [] };
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ai_conversations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
