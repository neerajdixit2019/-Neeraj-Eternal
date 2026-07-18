import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles").select("*").eq("id", context.userId).maybeSingle();
    return data;
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    age_gate_passed: z.literal(true),
    primary_struggle: z.string().min(1).max(50),
    initial_mood: z.number().int().min(1).max(10),
    initial_need: z.string().min(1).max(50),
    display_name: z.string().min(1).max(80).optional(),
    companion_tone: z.enum(["gentle", "poetic", "practical"]).nullable().optional(),
    speaking_styles: z.array(z.string().max(80)).max(8).optional(),
    avoid_styles: z.array(z.string().max(80)).max(8).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("profiles").update({
      age_gate_passed: true,
      primary_struggle: data.primary_struggle,
      onboarding_completed: true,
      display_name: data.display_name ?? undefined,
      ...(data.companion_tone !== undefined ? { companion_tone: data.companion_tone } : {}),
    }).eq("id", userId);
    // Save how the user wants InnerMate to speak (and what to avoid).
    // Stored in user_story.speaking_preference so the companion prompt
    // picks it up silently. We keep it human-readable.
    const styles = (data.speaking_styles ?? []).filter(Boolean);
    const avoids = (data.avoid_styles ?? []).filter(Boolean);
    if (styles.length || avoids.length) {
      const parts: string[] = [];
      if (styles.length) parts.push(`Prefer: ${styles.join("; ")}`);
      if (avoids.length) parts.push(`Avoid: ${avoids.join("; ")}`);
      await supabase.from("user_story").upsert({
        user_id: userId,
        speaking_preference: parts.join(" · "),
        is_ai_readable: true,
      }, { onConflict: "user_id" });
    }
    await supabase.from("mood_logs").insert({
      user_id: userId, mood_score: data.initial_mood,
      emotion_tags: [], trigger_tags: [data.primary_struggle],
      note: `First check-in. Need: ${data.initial_need}`,
    });
    await supabase.from("consent_records").insert({
      user_id: userId, consent_type: "not_therapy_acknowledgement",
    });
    return { ok: true };
  });

export const setCompanionTone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    tone: z.enum(["gentle", "poetic", "practical"]).nullable(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ companion_tone: data.tone })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setBackgroundAnimation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    enabled: z.boolean(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ background_animation_enabled: data.enabled })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const logMood = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    mood_score: z.number().int().min(1).max(10),
    emotion_tags: z.array(z.string()).max(20),
    trigger_tags: z.array(z.string()).max(20),
    note: z.string().max(2000).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("mood_logs").insert({
      user_id: context.userId, ...data, note: data.note ?? null,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row?.id ?? null };
  });

/**
 * Attach the mindset-question answers (or any short reflection) to an
 * existing mood log. The companion's silent context reads mood notes, so
 * this is how the check-in flow deepens what InnerMate understands.
 */
export const annotateMood = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid(),
    note: z.string().max(500),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("mood_logs")
      .update({ note: data.note })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMoods = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("mood_logs")
      .select("*").order("created_at", { ascending: false }).limit(120);
    return data ?? [];
  });

export const listJournal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("journal_entries")
      .select("id,title,body,created_at,emotion_tags").order("created_at", { ascending: false }).limit(50);
    return data ?? [];
  });

/**
 * Everything the trusted letter may draw from, fetched for one whole window.
 * listMoods/listJournal cap at the newest rows, which would silently hide
 * older in-window pages from the pick list — a consent gap — and understate
 * the letter's check-in counts.
 */
export const listLetterWindow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    days: z.union([z.literal(14), z.literal(30), z.literal(90)]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - data.days * 86400000).toISOString();
    const [{ data: moods }, { data: journal }] = await Promise.all([
      context.supabase.from("mood_logs")
        .select("created_at,mood_score,emotion_tags,trigger_tags")
        .gte("created_at", since).order("created_at", { ascending: false }),
      context.supabase.from("journal_entries")
        .select("id,title,body,created_at")
        .gte("created_at", since).order("created_at", { ascending: false }),
    ]);
    return { moods: moods ?? [], journal: journal ?? [] };
  });

export const saveJournal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid().nullable(),
    title: z.string().max(200).optional(),
    body: z.string().max(20000),
    emotion_tags: z.array(z.string()).max(20).default([]),
    entry_type: z.string().max(40).default("free"),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { error } = await supabase.from("journal_entries").update({
        title: data.title ?? null, body: data.body,
        emotion_tags: data.emotion_tags, entry_type: data.entry_type,
      }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase.from("journal_entries").insert({
      user_id: userId, title: data.title ?? null, body: data.body,
      emotion_tags: data.emotion_tags, entry_type: data.entry_type,
    }).select("id").single();
    if (error || !row) throw new Error(error?.message || "insert failed");
    return { id: row.id };
  });

export const deleteJournal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await context.supabase.from("journal_entries").delete().eq("id", data.id);
    return { ok: true };
  });

export const listPaths = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: paths }, { data: progress }, { data: steps }] = await Promise.all([
      context.supabase.from("healing_paths").select("*").order("title"),
      context.supabase.from("user_path_progress").select("*"),
      context.supabase.from("healing_steps").select("path_id,day_number,title,exercise_text"),
    ]);
    const stepIndex: Record<string, { title: string; preview: string }> = {};
    const stepsByPath: Record<string, { day_number: number; title: string; exercise_text: string }[]> = {};
    for (const s of steps ?? []) {
      (stepsByPath[s.path_id] ??= []).push(s);
    }
    for (const pid of Object.keys(stepsByPath)) {
      stepsByPath[pid].sort((a, b) => a.day_number - b.day_number);
      const first = stepsByPath[pid][0];
      if (first) {
        const sentence = (first.exercise_text.split(/(?<=[.!?])\s/)[0] ?? first.exercise_text).trim();
        stepIndex[pid] = { title: first.title, preview: sentence };
      }
    }
    const currentByPath: Record<string, { day: number; title: string; preview: string } | null> = {};
    for (const p of progress ?? []) {
      const list = stepsByPath[p.path_id] ?? [];
      const next = list.find(s => !p.completed_steps?.includes(s.day_number));
      if (next) {
        const sentence = (next.exercise_text.split(/(?<=[.!?])\s/)[0] ?? next.exercise_text).trim();
        currentByPath[p.path_id] = { day: next.day_number, title: next.title, preview: sentence };
      } else {
        currentByPath[p.path_id] = null;
      }
    }
    return { paths: paths ?? [], progress: progress ?? [], firstSteps: stepIndex, currentSteps: currentByPath };
  });

export const getPath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ slug: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: path } = await context.supabase.from("healing_paths")
      .select("*").eq("slug", data.slug).maybeSingle();
    if (!path) return { path: null, steps: [], progress: null };
    const [{ data: steps }, { data: progress }] = await Promise.all([
      context.supabase.from("healing_steps").select("*").eq("path_id", path.id).order("day_number"),
      context.supabase.from("user_path_progress").select("*").eq("path_id", path.id).maybeSingle(),
    ]);
    return { path, steps: steps ?? [], progress };
  });

export const completeStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    path_id: z.string().uuid(), day: z.number().int().min(1).max(31),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase.from("user_path_progress")
      .select("*").eq("path_id", data.path_id).maybeSingle();
    const completed = new Set<number>(existing?.completed_steps ?? []);
    completed.add(data.day);
    const arr = Array.from(completed).sort((a, b) => a - b);
    if (existing) {
      await supabase.from("user_path_progress").update({
        completed_steps: arr, current_day: Math.max(existing.current_day, data.day + 1),
        last_active_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      await supabase.from("user_path_progress").insert({
        user_id: userId, path_id: data.path_id,
        completed_steps: arr, current_day: data.day + 1,
      });
    }
    return { ok: true };
  });

export const exportMyData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [
      profile, moods, journal, convs, msgs, progress, memories, story,
      letters, refSessions, refTurns, refJournal, reflections, feedback,
      consent, rights, safety,
    ] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("mood_logs").select("*"),
      supabase.from("journal_entries").select("*"),
      supabase.from("ai_conversations").select("*"),
      supabase.from("ai_messages").select("*"),
      supabase.from("user_path_progress").select("*"),
      supabase.from("memories").select("*"),
      supabase.from("user_story").select("*"),
      supabase.from("weekly_letters").select("*"),
      supabase.from("reflection_sessions").select("*"),
      supabase.from("reflection_turns").select("*"),
      supabase.from("reflection_journal_entries").select("*"),
      supabase.from("reflections").select("*"),
      supabase.from("user_feedback").select("*"),
      supabase.from("consent_records").select("*"),
      supabase.from("rights_requests").select("*"),
      supabase.from("safety_events").select("*"),
    ]);
    return {
      exported_at: new Date().toISOString(),
      profile: profile.data,
      mood_logs: moods.data,
      journal_entries: journal.data,
      ai_conversations: convs.data,
      ai_messages: msgs.data,
      path_progress: progress.data,
      memories: memories.data,
      user_story: story.data,
      weekly_letters: letters.data,
      reflection_sessions: refSessions.data,
      reflection_turns: refTurns.data,
      reflection_journal_entries: refJournal.data,
      reflections: reflections.data,
      user_feedback: feedback.data,
      consent_records: consent.data,
      rights_requests: rights.data,
      safety_events: safety.data,
    };
  });

export const deleteMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Delete user-created emotional content. Retain consent_records,
    // rights_requests, and safety_events as legally necessary audit trail.
    await supabase.from("ai_messages").delete().eq("user_id", userId);
    await supabase.from("ai_conversations").delete().eq("user_id", userId);
    await supabase.from("journal_entries").delete().eq("user_id", userId);
    await supabase.from("mood_logs").delete().eq("user_id", userId);
    await supabase.from("user_path_progress").delete().eq("user_id", userId);
    await supabase.from("memories").delete().eq("user_id", userId);
    await supabase.from("user_story").delete().eq("user_id", userId);
    await supabase.from("weekly_letters").delete().eq("user_id", userId);
    await supabase.from("reflection_journal_entries").delete().eq("user_id", userId);
    await supabase.from("reflection_turns").delete().eq("user_id", userId);
    await supabase.from("reflection_sessions").delete().eq("user_id", userId);
    await supabase.from("reflections").delete().eq("user_id", userId);
    await supabase.from("user_feedback").delete().eq("user_id", userId);
    await supabase.from("rights_requests").insert({
      user_id: userId, request_type: "delete_data", status: "completed",
      completed_at: new Date().toISOString(),
    });
    return { ok: true };
  });

// ---------- Memories ----------

const FEELINGS = ["warm", "bittersweet", "heavy", "grateful", "longing", "peaceful"] as const;

export const listMemories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("memories")
      .select("*")
      .order("memory_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    // Sign URLs for media (1 hour)
    const out = await Promise.all(rows.map(async (m) => {
      let url: string | null = null;
      if (m.media_path) {
        const { data: signed } = await supabase.storage
          .from("memories")
          .createSignedUrl(m.media_path, 60 * 60);
        url = signed?.signedUrl ?? null;
      }
      return { ...m, media_url: url };
    }));
    return out;
  });

export const saveMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    title: z.string().max(200).optional().nullable(),
    story: z.string().max(4000).optional().nullable(),
    feeling_tag: z.enum(FEELINGS).nullable().optional(),
    memory_date: z.string().nullable().optional(), // ISO date
    media_path: z.string().nullable().optional(),
    media_type: z.string().max(40).nullable().optional(),
    is_ai_readable: z.boolean().default(false),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase.from("memories").insert({
      user_id: userId,
      title: data.title ?? null,
      story: data.story ?? null,
      feeling_tag: data.feeling_tag ?? null,
      memory_date: data.memory_date ?? null,
      media_path: data.media_path ?? null,
      media_type: data.media_type ?? null,
      is_ai_readable: data.is_ai_readable,
    }).select("id").single();
    if (error || !row) throw new Error(error?.message ?? "insert failed");
    return { id: row.id };
  });

export const setMemoryReadable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid(),
    is_ai_readable: z.boolean(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("memories")
      .update({ is_ai_readable: data.is_ai_readable })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("memories").select("media_path").eq("id", data.id).maybeSingle();
    if (row?.media_path) {
      await supabase.storage.from("memories").remove([row.media_path]);
    }
    const { error } = await supabase.from("memories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Edit a memory's words (title / story / feeling / date). RLS keeps it owner-only.
export const updateMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid(),
    title: z.string().max(200).nullable().optional(),
    story: z.string().max(4000).nullable().optional(),
    feeling_tag: z.enum(FEELINGS).nullable().optional(),
    memory_date: z.string().nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const patch: { title?: string | null; story?: string | null; feeling_tag?: string | null; memory_date?: string | null } = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.story !== undefined) patch.story = data.story;
    if (data.feeling_tag !== undefined) patch.feeling_tag = data.feeling_tag;
    if (data.memory_date !== undefined) patch.memory_date = data.memory_date;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase.from("memories").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Pattern control ----------
// "This pattern doesn't fit me" is a form of feedback. We persist it in the
// real user_feedback table (category 'pattern_hidden', the tag in `comment`),
// so it survives reload, stays scoped to the user, and is covered by the
// existing export & delete — no new schema.

export const listHiddenPatterns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_feedback").select("comment")
      .eq("user_id", context.userId).eq("category", "pattern_hidden");
    return [...new Set((data ?? []).map((r) => r.comment).filter(Boolean) as string[])];
  });

export const hidePattern = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    tag: z.string().min(1).max(64),
    reasons: z.array(z.string().max(40)).max(8).default([]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Clear any earlier hide for this tag so we don't stack duplicates.
    await supabase.from("user_feedback").delete()
      .eq("user_id", userId).eq("category", "pattern_hidden").eq("comment", data.tag);
    const { error } = await supabase.from("user_feedback").insert({
      user_id: userId,
      category: "pattern_hidden",
      comment: data.tag,
      reasons: data.reasons,
      rating: "not_really",
      helpful: false,
      save_mode: "private",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unhidePattern = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ tag: z.string().min(1).max(64) }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("user_feedback").delete()
      .eq("user_id", context.userId).eq("category", "pattern_hidden").eq("comment", data.tag);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- My Story ----------

export const getStory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_story").select("*").eq("user_id", context.userId).maybeSingle();
    return data;
  });

const STORY_FIELDS = ["roots", "current_chapter", "people", "healing_from", "speaking_preference"] as const;
type StoryField = typeof STORY_FIELDS[number];

export const saveStoryField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    field: z.enum(STORY_FIELDS),
    value: z.string().max(600),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: Record<string, string | null> = {};
    patch[data.field as StoryField] = data.value.trim() === "" ? null : data.value;
    const { error } = await supabase.from("user_story").upsert({
      user_id: userId,
      ...patch,
    }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setStoryReadable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ is_ai_readable: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("user_story").upsert({
      user_id: userId,
      is_ai_readable: data.is_ai_readable,
    }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });