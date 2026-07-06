/**
 * Lightweight client analytics layer.
 *
 * Design goals:
 *   1. Never crash the app if the underlying provider is missing or fails.
 *   2. Never capture private content (journal text, chat text, memory bodies,
 *      emotion notes, letter content). Track behavior, not content.
 *   3. Centralized event taxonomy — see EventName below.
 *
 * To plug in a real provider (PostHog / Amplitude / Mixpanel / Supabase
 * `analytics_events` table) implement `dispatch()` and wire it in `track()`.
 * Until then events are dev-logged only and silently dropped in production.
 */

export type EventName =
  // Onboarding
  | "onboarding_started"
  | "onboarding_step_completed"
  | "onboarding_completed"
  | "onboarding_skipped"
  // Home
  | "home_viewed"
  | "primary_action_clicked"
  | "quick_action_clicked"
  // InnerMate / companion
  | "companion_opened"
  | "companion_message_sent"
  | "companion_response_started"
  | "companion_response_completed"
  | "companion_response_error"
  | "companion_followup_chip_clicked"
  | "companion_new_chat_created"
  | "companion_history_opened"
  // Mood
  | "mood_checkin_started"
  | "mood_checkin_completed"
  | "mood_checkin_cancelled"
  // Journal
  | "journal_opened"
  | "journal_entry_started"
  | "journal_entry_saved"
  | "journal_entry_deleted"
  // Weekly letter
  | "weekly_letter_card_viewed"
  | "weekly_letter_generation_started"
  | "weekly_letter_generation_completed"
  | "weekly_letter_generation_failed"
  | "weekly_letter_saved"
  // Memories
  | "memory_upload_started"
  | "memory_upload_completed"
  | "memory_ai_readable_enabled"
  | "memory_ai_readable_disabled"
  // Wind-down
  | "winddown_started"
  | "winddown_completed"
  // Rituals & shelf
  | "urge_shield_started"
  | "urge_shield_completed"
  | "journal_entry_autosaved"
  | "memory_pinned_viewed"
  // Settings / privacy
  | "privacy_mode_enabled"
  | "privacy_mode_disabled"
  | "export_started"
  | "export_completed"
  | "delete_account_started";

/**
 * Allow-listed, non-sensitive property values. Strings should be short enums
 * (e.g. "morning", "mood_chip", "low"), numbers should be counts/scores, never
 * raw user-authored text. Anything sensitive must be omitted.
 */
export type EventProps = Record<string, string | number | boolean | null | undefined>;

const PRIVATE_KEYS = new Set([
  "text", "content", "body", "message", "note", "story",
  "journal", "letter", "memory", "title", "transcript",
  "prompt", "response", "email", "name", "user_email",
]);

function sanitize(props?: EventProps): EventProps | undefined {
  if (!props) return undefined;
  const out: EventProps = {};
  for (const [k, v] of Object.entries(props)) {
    if (PRIVATE_KEYS.has(k.toLowerCase())) continue;
    if (typeof v === "string" && v.length > 64) continue; // long strings likely private
    out[k] = v;
  }
  return out;
}

/**
 * Replace this with a real provider call (e.g. posthog.capture, supabase insert,
 * navigator.sendBeacon to an /api/public/analytics endpoint). Must never throw.
 */
function dispatch(_name: EventName, _props?: EventProps): void {
  // no-op until a provider is wired
}

export function track(name: EventName, props?: EventProps): void {
  try {
    const safe = sanitize(props);
    if (typeof window !== "undefined" && import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.debug("[analytics]", name, safe ?? {});
    }
    dispatch(name, safe);
  } catch {
    // analytics must never break the app
  }
}

/** Convenience helper for a no-op call site that you want to keep present. */
export const analytics = { track };