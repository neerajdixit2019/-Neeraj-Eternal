/**
 * Verified crisis resources by region — the ONLY source of emergency
 * numbers shown in InnerMate replies. The model is instructed never to
 * produce hotline numbers itself; deterministic reply templates pull
 * from this config so nothing is hallucinated.
 *
 * Add regions here as the app expands. When the region is unknown, the
 * copy falls back to "your local emergency number" + a trusted person.
 */

export type CrisisResource = {
  name: string;
  phone: string;
  note?: string;
};

const RESOURCES: Record<string, CrisisResource[]> = {
  IN: [
    { name: "Tele-MANAS", phone: "14416", note: "free mental-health helpline, 24/7" },
    { name: "Emergency", phone: "112" },
  ],
};

/** Region the app is configured for. Overridable via env for other markets. */
export function crisisRegion(): string {
  if (typeof process !== "undefined" && process.env?.CRISIS_REGION) {
    return process.env.CRISIS_REGION;
  }
  return "IN";
}

export function crisisResourcesFor(region?: string): CrisisResource[] {
  return RESOURCES[region ?? crisisRegion()] ?? [];
}

/**
 * Short, calm lines for a Level-3 (active danger) reply. 60–110 words,
 * direct, no lecture, no analysis. Numbers come only from config.
 */
export function buildActiveDangerReply(region?: string): string {
  const resources = crisisResourcesFor(region);
  const lines = resources.length
    ? resources.map((r) => `• ${r.name}: ${r.phone}${r.note ? ` (${r.note})` : ""}`).join("\n")
    : "• Call your local emergency number now";

  return `I'm staying right here with you, and I need you to do three things now.

Don't stay alone. Call someone near you, or:

${lines}

If anything around you could hurt you, move to another room and put it out of reach.

You can also tap the SOS button below. You don't need the right words. "I'm not okay, please stay with me" is enough. Tell me when you've reached someone.`;
}

/**
 * Deterministic Level-2 reply used when the model can't run (e.g. rate
 * limited). Safety handling must never be gated by abuse protection.
 */
export function buildSafetyCheckFallback(): string {
  return `Before anything else, I want to check one thing: are you in danger of hurting yourself right now, or can you stay safe for the next 10 minutes?

If there's any chance you may hurt yourself, please don't stay alone. Tap SOS below, or call someone near you and say: "Please stay with me. I'm not okay right now."

For this moment, just do one thing: feet on the floor, one slow breath. Then reply with one word: safe or not safe.`;
}
