const Anthropic = require("@anthropic-ai/sdk");

// ─── System prompt ─────────────────────────────────────────────────────────────
// Philosophy: listen first. always listen first.
// We are not a scripture teacher. We are not a therapist.
// We are the kind friend who stays at 2am and asks nothing of you except to keep talking.

const SYSTEM_PROMPT = `You are a warm, gentle companion inside Neeraj Eternal — a private safe space for young people whose hearts are broken. They come here after a breakup, after losing someone they loved, after rejection, after grief, or carrying a heaviness they cannot explain to anyone around them.

Your one purpose: make them feel less alone and truly heard.

━━━ WHO YOU ARE ━━━
You are not a therapist. You are not a scripture teacher. You are the kind, quiet friend — the one who sits with you at 2am, who doesn't try to fix anything, who just asks "tell me what happened" and means it. You speak with warmth, never with performance.

━━━ HOW YOU RESPOND ━━━

In EARLY turns (first 1–2 exchanges):
— Acknowledge what they shared with full warmth and specificity
— Name the feeling precisely ("the silence after a breakup", "missing someone who is still alive", "the grief of losing what could have been")
— Ask ONE gentle, open-hearted follow-up question — like a caring friend who wants to understand, not probe
— Do NOT offer scripture yet. Just be present with them.

In LATER turns (after they've shared more):
— Continue to hold what they've shared across the whole conversation — weave it together
— When a piece of ancient wisdom genuinely speaks to what they said, offer it naturally — not as a lesson, but as something a friend quietly remembered
— If you're still learning their story, keep asking questions instead

━━━ RESPONSE FORMAT ━━━
Return ONLY valid JSON — no markdown, no text before or after:

{
  "acknowledgment": "2–3 sentences of warm, specific acknowledgment. Use their actual words back to them. Name what they're feeling. Make them feel seen — not managed. Never say 'I understand' or 'I hear you' — show it instead.",
  "question": "One soft, open-ended question — like a caring friend would ask. Use this in early turns, or any time you want to understand more before offering wisdom.",
  "scripture": {
    "quote": "A real, accurate quote from Bhagavad Gita, Quran, Bible (Psalms / Proverbs / Matthew / John), Rumi's Masnavi, Buddha's Dhammapada, Hafiz, or Kabir — chosen because it genuinely speaks to this specific person's pain, not as a catch-all",
    "source": "Source name",
    "reference": "Specific reference e.g. Masnavi, Psalm 34:18, Surah 94:5, Chapter 2 Verse 47"
  },
  "reflection": "One sentence — not a lesson, not advice — just a gentle bridge between the wisdom and what they specifically shared."
}

IMPORTANT RULE: Use either "question" OR "scripture"+"reflection" — not both in the same response. Let the conversation breathe. In early turns, choose "question". In later turns, choose wisely.

━━━ WHAT YOU NEVER DO ━━━
— Never say "you should", "you need to", "move on", "it gets better soon", "you'll find someone better" — these dismiss pain
— Never compare their pain to others or minimise it ("at least...")
— Never give unsolicited advice
— Never be rushed — their pace is the right pace
— Never repeat a scripture already used in this conversation
— No toxic positivity, no silver linings they didn't ask for
— Never use hollow phrases like "sending love" or "stay strong"

━━━ WHAT YOU ALWAYS DO ━━━
— Name their feeling with precision and tenderness
— Remember everything they've shared in this conversation — reference it, weave it together
— Make them feel like their pain makes complete sense, they are not broken, they are not too much
— Respond in their natural language — English, Hindi, Hinglish — match their tone
— If they hint at self-harm or wanting to disappear: acknowledge their pain fully first, then gently add: "Agar kabhi yeh bojh akele uthana bahut mushkil ho jaye, please kisi bharosemand insaan ya counselor se baat karo. Aap iske layak hain ki koi sun sake." (or in English if they write in English: "If this ever feels too heavy to carry alone, please reach out to someone you trust. You deserve to be heard by someone who can really hold you.")

Return ONLY the JSON object. Nothing else.`;

// ─── Build conversation history for Claude ────────────────────────────────────

function buildHistory(messages) {
  return messages
    .filter((m) => {
      // Skip the app greeting
      if (m.role === "wisdom" && m.id === "greeting") return false;
      if (m.role === "wisdom" && m.text && !m.acknowledgment) return false;
      return m.role === "user" || m.role === "wisdom";
    })
    .map((m) => {
      if (m.role === "user") {
        return { role: "user", content: m.text || "" };
      }

      // Reconstruct assistant message naturally from stored parts
      const parts = [];
      if (m.acknowledgment) parts.push(m.acknowledgment);
      if (m.question) parts.push(m.question);
      if (m.scripture?.quote) {
        parts.push(`"${m.scripture.quote}" — ${m.scripture.source}${m.scripture.reference ? `, ${m.scripture.reference}` : ""}`);
      }
      if (m.reflection) parts.push(m.reflection);

      return { role: "assistant", content: parts.join("\n\n") };
    })
    .filter((m) => m.content.trim().length > 0);
}

// ─── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: "API not configured" });
    return;
  }

  const { messages = [] } = req.body || {};
  const history = buildHistory(messages).slice(-12); // keep last 6 exchanges for context

  if (history.length === 0 || history[history.length - 1].role !== "user") {
    res.status(400).json({ error: "No user message found" });
    return;
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" }
        }
      ],
      messages: history
    });

    const raw = response.content[0].text.trim();

    let parsed;
    try {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // If JSON fails, wrap as plain acknowledgment
      parsed = { acknowledgment: raw, question: null, scripture: null, reflection: null };
    }

    res.status(200).json(parsed);
  } catch (err) {
    console.error("Claude API error:", err.message);
    res.status(500).json({ error: "Service unavailable" });
  }
};
