import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type Whisper = {
  kind: "journal" | "memory" | "mood";
  id: string;
  created_at: string;
  years_ago: number;
  months_ago: number;
  preview: string;
};

// Find a single past entry from this exact calendar day in a prior week/month/year.
// Returns the oldest match (most resonant), or null.
export const getOnThisDay = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Whisper | null> => {
    const { supabase } = context;
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const today = new Date(now.getFullYear(), now.getMonth(), day);

    const [j, m, mo] = await Promise.all([
      supabase.from("journal_entries")
        .select("id, title, body, created_at")
        .order("created_at", { ascending: true }),
      supabase.from("memories")
        .select("id, title, story, memory_date, created_at")
        .order("created_at", { ascending: true }),
      supabase.from("mood_logs")
        .select("id, mood_score, note, emotion_tags, created_at")
        .order("created_at", { ascending: true }),
    ]);

    const candidates: Whisper[] = [];
    const sameDay = (d: Date) =>
      d.getDate() === day && d.getMonth() + 1 === month &&
      // strictly past (not today)
      (d.getFullYear() < now.getFullYear() ||
        (d.getFullYear() === now.getFullYear() && d.getMonth() < now.getMonth()) ||
        // also allow earlier in same month (weeks-ago feel)
        false);
    const monthsAgo = (d: Date) => Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30));
    const yearsAgo = (d: Date) => now.getFullYear() - d.getFullYear();

    for (const r of j.data ?? []) {
      const d = new Date(r.created_at);
      if (sameDay(d)) {
        const preview = (r.title?.trim() || r.body?.replace(/\s+/g, " ").slice(0, 120) || "").trim();
        if (preview) candidates.push({
          kind: "journal", id: r.id, created_at: r.created_at,
          years_ago: yearsAgo(d), months_ago: monthsAgo(d), preview,
        });
      }
    }
    for (const r of m.data ?? []) {
      const ref = r.memory_date ? new Date(r.memory_date + "T00:00:00") : new Date(r.created_at);
      if (sameDay(ref)) {
        const preview = (r.title?.trim() || r.story?.replace(/\s+/g, " ").slice(0, 120) || "").trim();
        if (preview) candidates.push({
          kind: "memory", id: r.id, created_at: r.created_at,
          years_ago: yearsAgo(ref), months_ago: monthsAgo(ref), preview,
        });
      }
    }
    for (const r of mo.data ?? []) {
      const d = new Date(r.created_at);
      if (sameDay(d)) {
        const tags = (r.emotion_tags ?? []).slice(0, 2).join(", ");
        const preview = r.note?.trim() || (tags ? `you felt ${tags}` : `a quiet check-in`);
        candidates.push({
          kind: "mood", id: r.id, created_at: r.created_at,
          years_ago: yearsAgo(d), months_ago: monthsAgo(d),
          preview: preview.slice(0, 120),
        });
      }
    }
    if (!candidates.length) return null;
    // Prefer journal/memory over mood, then oldest.
    candidates.sort((a, b) => {
      const rank = { journal: 0, memory: 0, mood: 1 } as const;
      if (rank[a.kind] !== rank[b.kind]) return rank[a.kind] - rank[b.kind];
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    return candidates[0];
  });

// Save the evening wind-down line as a lightweight journal entry.
export const saveWindDown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ line: z.string().trim().min(1).max(500) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("journal_entries").insert({
      user_id: userId,
      title: "Wind-down",
      body: data.line,
      entry_type: "wind_down",
      is_ai_readable: true,
      emotion_tags: [],
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });