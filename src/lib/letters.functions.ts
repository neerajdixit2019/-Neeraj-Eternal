import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider, WEEKLY_LETTER_SYSTEM_PROMPT } from "@/lib/ai-gateway.server";
import {
  AI_RATE_LIMITS,
  consumeAiRateLimit,
} from "@/lib/ai-rate-limit.server";
import {
  registerPromptVersion,
  logInvocation,
} from "@/lib/ai-prompt-registry.server";

const WEEKLY_LETTER_MODEL = "google/gemini-3-flash-preview";
const WEEKLY_LETTER_ROUTE = "weekly_letter.generate";

function isMondayISO(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return false;
  return d.getUTCDay() === 1;
}

export const getCurrentLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ weekStartISO: z.string().refine(isMondayISO, "must be a Monday (YYYY-MM-DD)") }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("weekly_letters")
      .select("*")
      .eq("user_id", userId)
      .eq("week_start", data.weekStartISO)
      .maybeSingle();
    return row ?? null;
  });

export const getLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("weekly_letters")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    const weekStartDate = new Date(row.week_start + "T00:00:00Z");
    const weekEndDate = new Date(weekStartDate.getTime() + 7 * 86400000);
    const { data: moods } = await context.supabase
      .from("mood_logs")
      .select("created_at, mood_score")
      .gte("created_at", weekStartDate.toISOString())
      .lt("created_at", weekEndDate.toISOString());
    // Bucket into Mon..Sun averages.
    const buckets: number[][] = [[], [], [], [], [], [], []];
    for (const m of moods ?? []) {
      const d = new Date(m.created_at);
      const diff = Math.floor((d.getTime() - weekStartDate.getTime()) / 86400000);
      if (diff >= 0 && diff < 7 && typeof m.mood_score === "number") buckets[diff].push(m.mood_score);
    }
    const arc = buckets.map((b) => (b.length ? b.reduce((s, n) => s + n, 0) / b.length : null));
    return { ...row, arc };
  });

export const listKeptLetters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("weekly_letters")
      .select("id, week_start, tone, ritual, body, generated_at")
      .eq("kept", true)
      .order("week_start", { ascending: false });
    return data ?? [];
  });

export const setLetterKept = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), kept: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("weekly_letters")
      .update({ kept: data.kept })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("weekly_letters").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setWeeklyLetterPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      weekly_letter_enabled: z.boolean().optional(),
      weekly_letter_uses_memories: z.boolean().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const patch: { weekly_letter_enabled?: boolean; weekly_letter_uses_memories?: boolean } = {};
    if (typeof data.weekly_letter_enabled === "boolean") patch.weekly_letter_enabled = data.weekly_letter_enabled;
    if (typeof data.weekly_letter_uses_memories === "boolean") patch.weekly_letter_uses_memories = data.weekly_letter_uses_memories;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase.from("profiles").update(patch).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPrivateArchive = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [lettersRes, moodsRes, profileRes] = await Promise.all([
      supabase
        .from("weekly_letters")
        .select("week_start, tone, ritual, body, check_in_echo, generated_at, kept")
        .order("week_start", { ascending: false }),
      supabase
        .from("mood_logs")
        .select("created_at, mood_score, emotion_tags, trigger_tags, note")
        .order("created_at", { ascending: false })
        .limit(365),
      supabase
        .from("profiles")
        .select("display_name")
        .eq("id", context.userId)
        .maybeSingle(),
    ]);
    return {
      display_name: profileRes.data?.display_name ?? null,
      letters: lettersRes.data ?? [],
      check_ins: moodsRes.data ?? [],
      exported_at: new Date().toISOString(),
    };
  });

export const generateWeeklyLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      weekStartISO: z.string().refine(isMondayISO, "must be a Monday (YYYY-MM-DD)"),
      checkIn: z.string().trim().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const weekStart = data.weekStartISO;
    const checkIn = data.checkIn?.trim() || "";
    const weekStartDate = new Date(weekStart + "T00:00:00Z");
    const now = Date.now();
    const ageDays = (now - weekStartDate.getTime()) / 86400000;
    if (ageDays < 0 || ageDays > 8) throw new Error("Week is out of range.");

    // Existing?
    const { data: existing } = await supabase
      .from("weekly_letters").select("*").eq("user_id", userId).eq("week_start", weekStart).maybeSingle();
    if (existing) return existing;

    // Rate limit AI generation per user (e.g. 5 / day). Re-reads of the
    // same week's letter are served from `existing` above without counting.
    const rl = await consumeAiRateLimit(
      userId,
      WEEKLY_LETTER_ROUTE,
      AI_RATE_LIMITS[WEEKLY_LETTER_ROUTE],
    );
    if (!rl.allowed) {
      await logInvocation({
        userId,
        route: WEEKLY_LETTER_ROUTE,
        promptVersionId: null,
        model: WEEKLY_LETTER_MODEL,
        status: "rate_limited",
        metadata: { week_start: weekStart, retry_after_seconds: rl.retryAfterSeconds },
      });
      throw new Error("Too many letter requests today. Please try again tomorrow.");
    }

    // Read profile prefs
    const { data: profile } = await supabase
      .from("profiles")
      .select("weekly_letter_enabled, weekly_letter_uses_memories")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.weekly_letter_enabled) throw new Error("Weekly letter is not enabled.");
    const useMemories = !!profile.weekly_letter_uses_memories;

    const weekEndDate = new Date(weekStartDate.getTime() + 7 * 86400000);
    const weekEndISO = weekEndDate.toISOString();
    const weekStartISO = weekStartDate.toISOString();

    const [moodsRes, journalRes, safetyRes, storyRes, memoryRes] = await Promise.all([
      supabase.from("mood_logs").select("mood_score, emotion_tags, created_at")
        .gte("created_at", weekStartISO).lt("created_at", weekEndISO).order("created_at", { ascending: true }),
      supabase.from("journal_entries").select("title, body, created_at, is_ai_readable, entry_type")
        .gte("created_at", weekStartISO).lt("created_at", weekEndISO)
        .eq("is_ai_readable", true).order("created_at", { ascending: true }).limit(3),
      supabase.from("safety_events").select("severity, event_type")
        .gte("created_at", weekStartISO).lt("created_at", weekEndISO),
      useMemories ? supabase.from("user_story").select("*").eq("user_id", userId).maybeSingle()
                  : Promise.resolve({ data: null }),
      useMemories ? supabase.from("memories").select("title, story, memory_date, feeling_tag, is_ai_readable")
                            .eq("is_ai_readable", true)
                            .order("memory_date", { ascending: false, nullsFirst: false })
                            .order("created_at", { ascending: false }).limit(1)
                  : Promise.resolve({ data: null }),
    ]);

    // Pull up to 2 recent wind-down lines this week as gentle context.
    const { data: windDowns } = await supabase
      .from("journal_entries")
      .select("body, created_at")
      .eq("entry_type", "wind_down")
      .gte("created_at", weekStartISO).lt("created_at", weekEndISO)
      .order("created_at", { ascending: false }).limit(2);
    const windDownLines = (windDowns ?? [])
      .map((w) => (w.body ?? "").replace(/\s+/g, " ").slice(0, 160))
      .filter(Boolean);

    const safetyEvents = (safetyRes.data ?? []) as { severity: string | null; event_type: string | null }[];
    const tone: "gentle" | "tender" = safetyEvents.some(
      (e) => e.severity === "high" || e.severity === "medium",
    ) ? "tender" : "gentle";

    const moods = moodsRes.data ?? [];
    let moodArc = "no check-ins this week";
    if (moods.length) {
      const avg = moods.reduce((s, m) => s + (m.mood_score ?? 0), 0) / moods.length;
      const tagCounts: Record<string, number> = {};
      for (const m of moods) for (const t of (m.emotion_tags ?? [])) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
      const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t]) => t);
      const trend = avg < 4 ? "the week felt heavier than usual"
                  : avg < 7 ? "the week sat in the middle, neither light nor heavy"
                  : "the week leaned brighter";
      moodArc = `${moods.length} check-ins. ${trend}. Recurring feelings: ${topTags.join(", ") || "varied"}`;
    }

    const journalSnips = (journalRes.data ?? []).map((j) => {
      const body = (j.body ?? "").replace(/\s+/g, " ").slice(0, 200);
      return body ? `- ${body}` : "";
    }).filter(Boolean).join("\n");

    const story = (storyRes as { data: { roots?: string | null; current_chapter?: string | null; people?: string | null; healing_from?: string | null; speaking_preference?: string | null; is_ai_readable?: boolean } | null }).data;
    const storyLines: string[] = [];
    if (story?.is_ai_readable) {
      if (story.roots) storyLines.push(`Roots: ${story.roots}`);
      if (story.current_chapter) storyLines.push(`Current chapter: ${story.current_chapter}`);
      if (story.people) storyLines.push(`People: ${story.people}`);
      if (story.healing_from) storyLines.push(`Healing from: ${story.healing_from}`);
      if (story.speaking_preference) storyLines.push(`Speaking preference: ${story.speaking_preference}`);
    }

    const memArr = (memoryRes as { data: { title: string | null; story: string | null; memory_date: string | null; feeling_tag: string | null; is_ai_readable: boolean | null }[] | null }).data;
    const memOne = memArr?.[0];
    const memoryLine = memOne
      ? `One memory they keep: "${(memOne.title ?? "untitled").trim()}" — ${(memOne.story ?? "").slice(0, 180)} (${memOne.feeling_tag ?? "no tag"})`
      : "";

    const brief = [
      `WEEK: ${weekStart} (Mon) through Sunday.`,
      `TONE: ${tone === "tender" ? "TENDER (safety signals present this week)" : "gentle"}.`,
      checkIn ? `Check-in (what they said is on their heart right now): ${checkIn}` : "",
      `Mood arc (silent, never quote numbers): ${moodArc}.`,
      journalSnips ? `Journal notes they marked shareable:\n${journalSnips}` : "No shareable journal this week.",
      windDownLines.length ? `Things they wanted to set down before sleep this week:\n${windDownLines.map((l) => `- ${l}`).join("\n")}` : "",
      storyLines.length ? `What they've shared about themselves:\n${storyLines.join("\n")}` : "",
      memoryLine,
    ].filter(Boolean).join("\n\n");

    const key = process.env.LOVABLE_API_KEY;
    let body: string;
    let ritual: string | null = null;
    let checkInEcho: string | null = null;

    if (!key) {
      await logInvocation({
        userId,
        route: WEEKLY_LETTER_ROUTE,
        promptVersionId: null,
        model: WEEKLY_LETTER_MODEL,
        status: "no_key",
        metadata: { week_start: weekStart, tone },
      });
      body = tone === "tender"
        ? `Dear you,\n\nThis week asked a lot. You don't have to make sense of it tonight. Just being here, in this quiet page, counts as something.\n\nIf anything feels too heavy to hold, Tele-MANAS 14416 is there, and so is the SOS button in this app.`
        : `Dear you,\n\nA quiet letter, for a quiet week. Whatever this week held, you carried it through to its end, and that's enough for now.\n\nFor the week ahead — one slow walk, with no destination, would be a small kindness.`;
    } else {
      const gateway = createLovableAiGatewayProvider(key);
      const promptVersionId = await registerPromptVersion({
        promptName: "weekly_letter.system",
        model: WEEKLY_LETTER_MODEL,
        systemText: WEEKLY_LETTER_SYSTEM_PROMPT,
        metadata: { tone, uses_memories: useMemories },
      });
      const invocationStart = Date.now();
      let status: "ok" | "error" = "ok";
      let errorCode: string | null = null;
      try {
      const result = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system: WEEKLY_LETTER_SYSTEM_PROMPT,
        prompt: brief,
      });
      body = (result.text ?? "").trim();
      if (!body) {
        body = "Dear you,\n\nA quiet letter for a quiet week. You're here, and that counts.";
      }
      } catch (err) {
        status = "error";
        errorCode = String((err as { name?: string })?.name ?? "generate_error");
        console.error("[weekly_letter] generate failed", err);
        body = tone === "tender"
          ? `Dear you,\n\nThis week asked a lot. You don't have to make sense of it tonight. Just being here counts as something.\n\nIf anything feels too heavy to hold, Tele-MANAS 14416 is there, and so is the SOS button in this app.`
          : `Dear you,\n\nA quiet letter for a quiet week. You're here, and that counts.\n\nFor the week ahead — one slow walk, with no destination, would be a small kindness.`;
      }
      await logInvocation({
        userId,
        route: WEEKLY_LETTER_ROUTE,
        promptVersionId,
        model: WEEKLY_LETTER_MODEL,
        status,
        errorCode,
        latencyMs: Date.now() - invocationStart,
        inputChars: brief.length,
        outputChars: body.length,
        metadata: { week_start: weekStart, tone, uses_memories: useMemories, has_check_in: !!checkIn },
      });

      if (checkIn) {
        try {
          const echoResult = await generateText({
            model: gateway("google/gemini-3-flash-preview"),
            system:
              "You write one short, gentle sentence (max 22 words) describing how the user's pre-letter check-in shaped the letter's opening. " +
              "Never quote or repeat their words verbatim. Never use quotation marks. " +
              "Paraphrase the feeling at a high level (e.g. 'something heavy you've been carrying', 'a quiet hope'). " +
              "Begin with 'Your note' or 'What you shared'. End with a period. Plain text only.",
            prompt: `Their check-in: ${checkIn}\n\nThe opening of the letter:\n${body.split(/\n\n+/)[0] ?? ""}`,
          });
          checkInEcho = (echoResult.text ?? "").trim().replace(/^["'“”]+|["'“”]+$/g, "") || null;
          if (checkInEcho && checkInEcho.length > 220) checkInEcho = checkInEcho.slice(0, 217) + "…";
        } catch {
          checkInEcho = "Your note quietly shaped the opening of this letter.";
        }
      }
    }

    // Extract the closing ritual line (if any) for storage convenience.
    const lines = body.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const last = lines[lines.length - 1] ?? "";
    if (/^for the week ahead/i.test(last)) {
      ritual = last.replace(/^for the week ahead\s*[—–-]\s*/i, "").trim() || null;
    } else if (/tele-?manas/i.test(last)) {
      ritual = null;
    }

    const { data: inserted, error } = await supabase.from("weekly_letters").insert({
      user_id: userId,
      week_start: weekStart,
      body,
      ritual,
      tone,
      kept: true,
      check_in_echo: checkInEcho,
    }).select("*").single();
    if (error || !inserted) throw new Error(error?.message ?? "Failed to keep letter.");
    return inserted;
  });