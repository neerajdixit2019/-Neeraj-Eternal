import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  eventsFromCheckins, eventsFromJournal, eventsFromMemories, eventsFromChat,
  mergeEvents, type InsightEvent, type InsightSource,
} from "./insight-events";

/**
 * The unified insight feed. Consent is enforced HERE, at query level: a
 * source the user switched off is never even read. Derivation happens
 * server-side so full chat/journal text stays on the server — only the
 * event structure (tags + clipped excerpts of the user's own words)
 * crosses the wire. Nothing derived is stored; deleting a source record
 * removes its evidence on the next read, automatically.
 *
 * Consent rows live in user_feedback (category 'insight_source_off',
 * source name in comment) — same no-migration mechanism as pattern
 * hiding, user-scoped by RLS, covered by export & delete.
 */

const SOURCES: InsightSource[] = ["daily_checkin", "journal", "memory", "innermate_chat"];

async function readDisabled(supabase: { from: (t: string) => any }, userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("user_feedback").select("comment")
    .eq("user_id", userId).eq("category", "insight_source_off");
  return new Set(((data ?? []) as { comment: string | null }[]).map((r) => r.comment).filter(Boolean) as string[]);
}

export const listInsightSourceSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const off = await readDisabled(context.supabase, context.userId);
    return Object.fromEntries(SOURCES.map((s) => [s, !off.has(s)])) as Record<InsightSource, boolean>;
  });

export const setInsightSourceEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    source: z.enum(["daily_checkin", "journal", "memory", "innermate_chat"]),
    enabled: z.boolean(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("user_feedback").delete()
      .eq("user_id", userId).eq("category", "insight_source_off").eq("comment", data.source);
    if (!data.enabled) {
      const { error } = await supabase.from("user_feedback").insert({
        user_id: userId,
        category: "insight_source_off",
        comment: data.source,
        rating: null,
        helpful: false,
        reasons: [],
        save_mode: "private",
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/* ── Kept intentions — "one small thing" the user chose to hold tonight ──
   Persisted as user_feedback rows (category 'intention', text in comment,
   rating null until answered). No schema change; RLS-scoped; covered by
   export & delete. The page — not InnerMate — follows up the next day. */

export const keepIntention = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ text: z.string().min(1).max(200) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("user_feedback").insert({
      user_id: userId,
      category: "intention",
      comment: data.text,
      rating: null,
      helpful: false,
      reasons: [],
      save_mode: "private",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getIntentionState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("user_feedback")
      .select("id,comment,rating,created_at")
      .eq("user_id", userId).eq("category", "intention")
      .order("created_at", { ascending: false }).limit(5);
    const rows = (data ?? []) as { id: string; comment: string | null; rating: string | null; created_at: string }[];
    const todayKey = new Date().toDateString();
    const today = rows.find((r) => new Date(r.created_at).toDateString() === todayKey) ?? null;
    // The most recent earlier intention still waiting for an answer.
    const open = rows.find((r) => new Date(r.created_at).toDateString() !== todayKey && r.rating == null) ?? null;
    return { today, open };
  });

export const recordIntentionOutcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid(),
    outcome: z.enum(["yes", "a_little", "not_really"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_feedback")
      .update({ rating: data.outcome, helpful: data.outcome === "yes" })
      .eq("id", data.id).eq("category", "intention");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listInsightEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InsightEvent[]> => {
    const { supabase, userId } = context;
    const off = await readDisabled(supabase, userId);

    const groups: InsightEvent[][] = [];

    if (!off.has("daily_checkin")) {
      const { data } = await supabase.from("mood_logs")
        .select("id,created_at,mood_score,emotion_tags,trigger_tags,note")
        .order("created_at", { ascending: false }).limit(120);
      groups.push(eventsFromCheckins(data ?? []));
    }
    if (!off.has("journal")) {
      const { data } = await supabase.from("journal_entries")
        .select("id,created_at,title,emotion_tags")
        .order("created_at", { ascending: false }).limit(100);
      groups.push(eventsFromJournal(data ?? []));
    }
    if (!off.has("memory")) {
      const { data } = await supabase.from("memories")
        .select("id,created_at,title,feeling_tag")
        .order("created_at", { ascending: false }).limit(100);
      groups.push(eventsFromMemories(data ?? []));
    }
    if (!off.has("innermate_chat")) {
      // User-authored only; safety-flagged rows are excluded again inside
      // eventsFromChat (defence in depth).
      const { data } = await supabase.from("ai_messages")
        .select("id,conversation_id,created_at,role,content,risk_label")
        .eq("user_id", userId).eq("role", "user")
        .order("created_at", { ascending: false }).limit(400);
      groups.push(eventsFromChat((data ?? []).reverse()));
    }

    return mergeEvents(...groups);
  });
