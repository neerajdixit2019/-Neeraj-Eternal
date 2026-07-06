import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CATEGORIES = [
  "Heartbreak",
  "Loneliness",
  "Anxiety",
  "Overthinking",
  "Relationship confusion",
  "Work pressure",
  "Family stress",
  "Something else",
] as const;

const RESPONSE_MODES = ["listen", "clarity", "grounding", "decision", "celebration"] as const;
const RATINGS = ["yes", "a_little", "not_really"] as const;
const REASONS = [
  "felt_too_generic",
  "too_much_advice",
  "did_not_understand_me",
  "too_long",
  "too_clinical",
  "too_emotional",
  "repetitive",
  "other",
] as const;

const MOCK = {
  title: "A quiet reflection",
  what_i_hear:
    "It sounds like a part of you is trying to hold on while another part is tired of carrying the same thoughts. Both feelings can exist together. Missing something does not always mean that you need to act on it.",
  possible_underneath: [
    "A wish for clarity",
    "A need to feel understood",
    "A fear that letting go may erase what mattered",
  ],
  gentle_question:
    "What would you want to carry forward from this experience, even if you stopped carrying the pain?",
  micro_action: {
    prompt: "Complete this sentence:",
    sentence: "The part I am ready to release today is...",
    duration_minutes: 2,
  },
};

export const getMockReflection = () => MOCK;

export const submitReflectionFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        // For ephemeral feedback there is no stored reflection to link to.
        reflection_id: z.string().uuid().nullable().optional(),
        rating: z.enum(RATINGS),
        reasons: z.array(z.enum(REASONS)).max(REASONS.length).default([]),
        comment: z.string().trim().max(500).optional(),
        response_mode: z.enum(RESPONSE_MODES).optional(),
        save_mode: z.enum(["private", "ephemeral"]),
        category: z.string().max(64).optional(),
        intensity: z.number().int().min(1).max(10).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const isEphemeral = data.save_mode === "ephemeral";
    // Ephemeral rule: store only anonymous metadata. Never link to a reflection,
    // never include the user's typed comment or any AI/journal text.
    const row = {
      user_id: userId,
      reflection_id: isEphemeral ? null : (data.reflection_id ?? null),
      helpful: data.rating === "yes",
      rating: data.rating,
      reasons: data.reasons ?? [],
      response_mode: data.response_mode ?? null,
      save_mode: data.save_mode,
      category: data.category ?? null,
      intensity: data.intensity ?? null,
      comment: isEphemeral ? null : (data.comment ?? null),
    };
    const { error } = await supabase.from("user_feedback").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export { CATEGORIES, RESPONSE_MODES, RATINGS, REASONS };