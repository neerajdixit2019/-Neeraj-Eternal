/**
 * Wisdom library — verified, plain-language teachings InnerMate can draw
 * on when someone reaches for meaning. Curated across traditions (Gita,
 * Stoic, Buddhist, Sufi/Rumi, Kabir, Tao) so no single tradition is
 * privileged.
 *
 * DESIGN PRINCIPLES (parallel to crisis-resources: never let the model
 * improvise the facts):
 * - Each entry is ALREADY translated to plain modern language. The model
 *   weaves the idea into its own warm voice; it does not recite this.
 * - NO verse numbers anywhere. Models hallucinate citations, and the
 *   product rule is to never quote them. We store the tradition name and
 *   the plain teaching only.
 * - Teachings are phrased to HONOR feeling, never to bypass it ("detach
 *   and you won't suffer" is banned; "you can care deeply and hold
 *   loosely" is the register).
 * - This only surfaces at risk level 0 in the deeper-water facet. Never
 *   during a safety moment.
 */

export type Tradition = "Gita" | "Stoic" | "Buddhist" | "Sufi" | "Kabir" | "Tao";

export interface Teaching {
  id: string;
  tradition: Tradition;
  /** Themes this teaching speaks to (for selection + explain). */
  themes: string[];
  /** Keywords in the user's message that surface this teaching. */
  triggers: string[];
  /** The idea, already in plain modern language. */
  plain: string;
}

export const TEACHINGS: Teaching[] = [
  {
    id: "gita-action-not-fruit",
    tradition: "Gita",
    themes: ["outcome", "control", "results", "anxiety about the future"],
    triggers: [
      "outcome", "result", "results", "will it work", "what if it fails",
      "control the outcome", "attached to the result", "did i do enough",
      "worried about the future", "expectation",
    ],
    plain:
      "The Gita's steadiest idea: you have a right to your effort, never to how it turns out. Do the thing because it's right, and let the result be what it will be. It doesn't mean not caring; it means not handing your peace to an outcome you can't hold.",
  },
  {
    id: "gita-equanimity",
    tradition: "Gita",
    themes: ["ups and downs", "steadiness", "gain and loss"],
    triggers: [
      "up and down", "gain and loss", "win or lose", "high and low",
      "everything keeps changing", "one day good one day bad",
    ],
    plain:
      "The Gita points to meeting gain and loss, praise and blame, with the same steady footing. Not numbness. A center that the weather passes over without deciding who you are.",
  },
  {
    id: "gita-own-path",
    tradition: "Gita",
    themes: ["comparison", "purpose", "others' expectations", "your own way"],
    triggers: [
      "compare", "comparison", "everyone else", "others expect",
      "supposed to", "my own path", "living someone else", "should be like",
    ],
    plain:
      "The Gita says it's better to walk your own path imperfectly than to live someone else's perfectly. The pressure often comes from measuring your inside against another person's outside.",
  },
  {
    id: "gita-be-your-friend",
    tradition: "Gita",
    themes: ["self-blame", "self-forgiveness", "being hard on yourself"],
    triggers: [
      "hate myself", "so hard on myself", "my own worst", "cant forgive myself",
      "forgive myself", "forgiving myself", "blame myself", "be kinder to myself",
      "self forgiveness",
    ],
    plain:
      "The Gita puts it plainly: you can be your own friend or your own enemy. Same person, two directions. The work is to lift yourself, not to keep sinking yourself with the story that you're the problem.",
  },
  {
    id: "gita-attachment",
    tradition: "Gita",
    themes: ["attachment", "detachment", "clinging", "letting go"],
    triggers: [
      "attachment", "detachment", "attached", "non attachment", "vairagya",
    ],
    plain:
      "The Gita treats attachment as the knot, not the loving. It asks you to act with your whole heart and full effort, while loosening the grip on how it has to turn out. Care completely; own the result less.",
  },
  {
    id: "gita-suffering",
    tradition: "Gita",
    themes: ["suffering", "why do i suffer", "pain and meaning"],
    triggers: [
      "why do i suffer", "why is there suffering", "suffer even", "so much suffering",
      "why do good people suffer", "deserve this pain",
    ],
    plain:
      "The Gita doesn't say suffering is a punishment you earned. It points instead at what the pain is trying to teach, and at meeting it with a steadier center rather than a verdict about your worth.",
  },
  {
    id: "stoic-control",
    tradition: "Stoic",
    themes: ["control", "anxiety", "what's not up to me"],
    triggers: [
      "cant control", "out of my control", "control", "cant do anything about",
      "powerless", "up to me", "up to them", "what can i even do",
    ],
    plain:
      "The Stoics drew one clean line: some things are yours to move, most aren't. Peace tends to live on your side of that line. Spend your effort there, and let the rest be the rest.",
  },
  {
    id: "stoic-imagination",
    tradition: "Stoic",
    themes: ["worry", "overthinking", "catastrophizing"],
    triggers: [
      "worst case", "what if", "keep imagining", "playing it out",
      "catastroph", "worrying", "spiral about the future", "cant stop worrying",
    ],
    plain:
      "Seneca noticed we suffer more often in imagination than in reality. The mind rehearses the disaster on a loop, and the rehearsal hurts as much as the thing would. Naming that it's a rehearsal can loosen its grip a little.",
  },
  {
    id: "stoic-obstacle",
    tradition: "Stoic",
    themes: ["setback", "obstacle", "failure"],
    triggers: [
      "setback", "obstacle", "in the way", "blocked", "keeps getting worse",
      "everything against me", "nothing works out",
    ],
    plain:
      "A Stoic turn: what stands in the way can become the way. Not a silver lining you force, just the quiet fact that this hard thing is also where the next move is hiding.",
  },
  {
    id: "buddhist-impermanence",
    tradition: "Buddhist",
    themes: ["pain that feels permanent", "impermanence", "this will pass"],
    triggers: [
      "always feel like this", "never ends", "will i always", "permanent",
      "feels endless", "stuck forever", "this feeling wont",
    ],
    plain:
      "A Buddhist eye would call this feeling weather. Real, and moving. It arrived, and by its own nature it will shift, even if right now it feels like the whole sky.",
  },
  {
    id: "buddhist-second-arrow",
    tradition: "Buddhist",
    themes: ["rumination", "self-criticism", "the story after the pain"],
    triggers: [
      "keep replaying", "beating myself up", "cant stop thinking about",
      "the story i tell", "make it worse in my head", "overthink",
    ],
    plain:
      "There's a Buddhist image of two arrows. The first is the thing that hurt. The second is the story you tell about it afterward, and that one you fire at yourself. You can't always dodge the first. The second, sometimes, you can set down.",
  },
  {
    id: "buddhist-attachment",
    tradition: "Buddhist",
    themes: ["attachment", "letting go", "clinging"],
    triggers: [
      "attachment", "attached", "let go", "letting go", "cant let go",
      "holding on", "cling", "grip",
    ],
    plain:
      "The Buddhist read isn't that love is the problem. It's the grip. You can care about someone with your whole heart and still open your hands a little, so the caring stops costing you your ground.",
  },
  {
    id: "sufi-wound-light",
    tradition: "Sufi",
    themes: ["pain and growth", "hurt", "healing"],
    triggers: [
      "broken", "wound", "hurt so much", "will i heal", "falling apart",
      "shattered", "why does it hurt",
    ],
    plain:
      "Rumi wrote that the wound is the place where the light enters. Not that the pain is good, only that the same crack letting the ache in is often where something new gets through too.",
  },
  {
    id: "sufi-guest-house",
    tradition: "Sufi",
    themes: ["difficult emotions", "welcoming feeling"],
    triggers: [
      "shouldnt feel", "dont want to feel", "make it go away", "hate feeling",
      "this emotion", "why am i feeling", "guest",
    ],
    plain:
      "Rumi called a person a guest house, and every feeling a visitor, even the dark ones. He said meet each at the door laughing, because sometimes grief is clearing the room for something you can't see yet.",
  },
  {
    id: "sufi-seeking",
    tradition: "Sufi",
    themes: ["longing", "searching", "what you want"],
    triggers: [
      "searching", "looking for", "what you seek", "chasing", "want it so bad",
      "longing", "yearning",
    ],
    plain:
      "Rumi's line: what you seek is also seeking you. The wanting isn't only lack. Sometimes it's a compass. What is this longing actually pointing at?",
  },
  {
    id: "kabir-here",
    tradition: "Kabir",
    themes: ["feeling stuck", "starting", "where to begin"],
    triggers: [
      "dont know where to start", "stuck", "cant begin", "where do i even",
      "so far to go", "overwhelmed by how much",
    ],
    plain:
      "Kabir kept it earthy: wherever you are is the entry point. You don't have to get somewhere else first. The next real step is available from exactly where you're standing.",
  },
  {
    id: "kabir-musk-within",
    tradition: "Kabir",
    themes: ["seeking peace outside", "looking outward"],
    triggers: [
      "need something to feel", "if only i had", "looking for peace",
      "external", "someone to complete", "then i'll be happy",
    ],
    plain:
      "Kabir told the story of the deer chasing the scent of musk everywhere, not knowing it comes from its own body. Some of what you're reaching for out there may already be closer in than it feels.",
  },
  {
    id: "tao-let-go-become",
    tradition: "Tao",
    themes: ["identity", "change", "who am i"],
    triggers: [
      "who am i", "dont know who i am", "used to be", "changing", "lost myself",
      "become", "reinvent",
    ],
    plain:
      "Lao Tzu: when you let go of what you are, you make room for what you might become. The version of you that's loosening isn't a loss. It's clearing ground.",
  },
  {
    id: "tao-unhurried",
    tradition: "Tao",
    themes: ["pressure", "pace", "hurry"],
    triggers: [
      "no time", "rushing", "behind", "so much pressure", "hurry",
      "not fast enough", "falling behind",
    ],
    plain:
      "The Tao points at nature, which doesn't hurry, and yet nothing is left undone. The pressure to rush is often louder than the actual deadline. What would the unhurried next step be?",
  },
];

/**
 * Select the teachings most relevant to a message. Scores by trigger hits
 * first, then theme-word hits. Returns up to `max` (default 2), best first.
 * Empty array when nothing matches — the model then uses its general
 * deeper-water instruction with no grounding.
 */
export function selectTeachings(message: string, max = 2): Teaching[] {
  const n = message
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Common words that shouldn't, on their own, pull in a teaching.
  const STOP = new Set(["what", "your", "that", "this", "with", "them", "from", "about", "some", "when", "then", "have", "does", "into", "over"]);
  const tokens = new Set(n.split(" "));

  // If they named a scripture, prefer that tradition's teachings so a
  // Gita question surfaces a Gita answer.
  const wantTradition = namedTradition(message);

  const scored = TEACHINGS.map((t) => {
    let score = 0;
    // Triggers are multi-word phrases — substring match is intended.
    for (const trig of t.triggers) if (n.includes(trig)) score += 3;
    // Themes score on whole-token matches only, so "what" can't match
    // "what's" and generic words can't drag in an unrelated teaching.
    for (const theme of t.themes) {
      for (const word of theme.split(" ")) {
        if (word.length >= 4 && !STOP.has(word) && tokens.has(word)) score += 1;
      }
    }
    if (score > 0 && wantTradition && t.tradition === wantTradition) score += 4;
    return { t, score };
  }).filter((s) => s.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, max).map((s) => s.t);
}

const TRADITION_KEYWORDS: Array<[Tradition | null, string[]]> = [
  ["Gita", ["gita", "geeta", "bhagavad", "krishna", "arjuna"]],
  ["Stoic", ["stoic", "seneca", "marcus aurelius", "epictetus"]],
  ["Buddhist", ["buddha", "buddhist", "buddhism", "dhamma", "dukkha"]],
  ["Sufi", ["rumi", "sufi"]],
  ["Kabir", ["kabir"]],
  ["Tao", ["tao", "lao tzu", "laozi"]],
  // Named but not in our library — still counts as "asked about a tradition".
  [null, ["quran", "bible", "scripture", "shloka", "verse"]],
];

/** The tradition the user explicitly named, if any (null if none). */
export function namedTradition(message: string): Tradition | null {
  const n = message.toLowerCase();
  for (const [trad, keys] of TRADITION_KEYWORDS) {
    if (trad && keys.some((k) => n.includes(k))) return trad;
  }
  return null;
}

/** True when the user explicitly names a scripture/tradition. */
export function namesTradition(message: string): boolean {
  const n = message.toLowerCase();
  return TRADITION_KEYWORDS.some(([, keys]) => keys.some((k) => n.includes(k)));
}

/**
 * Build the grounding block injected into the companion's system prompt
 * for a deeper-water turn. Returns "" when no teaching matched.
 */
export function wisdomGroundingBlock(message: string): string {
  const matched = selectTeachings(message, 2);
  if (!matched.length) return "";
  const named = namesTradition(message);
  const lines = matched
    .map((t) => `- (${t.tradition}) ${t.plain}`)
    .join("\n");
  return `\n\nWISDOM TO DRAW FROM (verified, already in plain language — weave ONE of these into your own warm words; do not recite it whole, do not quote verse numbers, honor the feeling first and never use wisdom to bypass or minimize it${named ? "; they named a tradition, so you may say which tradition the idea comes from" : "; do not name the tradition unless they ask"}):\n${lines}`;
}
