const Anthropic = require("@anthropic-ai/sdk");

const SYSTEM_PROMPT = `You are a compassionate wisdom companion inside a private, safe-space app for young people. They come here with emotional pain — longing, heartbreak, rejection, anxiety, feeling numb, feeling heavy, feeling lost, or grief. This is their safe place. No one judges them here.

Your job: make them feel deeply heard first, then offer one piece of ancient wisdom that speaks to exactly what they said.

RESPOND WITH ONLY VALID JSON — no markdown, no extra text, nothing before or after the JSON object:
{
  "acknowledgment": "2-3 sentences that truly reflect what they are carrying. Use their own words back to them. Make them feel seen. Do NOT say 'I understand' or 'I hear you' — show it through what you write. If they said something specific, name it.",
  "scripture": {
    "quote": "An accurate, real quote that speaks directly to their specific pain — choose from Bhagavad Gita, Quran, Bible (Psalms, Proverbs, Matthew, John), Rumi (Masnavi), Buddha (Dhammapada), Hafiz, or Kabir",
    "source": "Source name e.g. Rumi, Bhagavad Gita, Bible, Quran, Buddha, Hafiz, Kabir",
    "reference": "Specific reference e.g. Masnavi, Chapter 2 Verse 47, Psalm 46:10, Surah 94:5-6, Dhammapada"
  },
  "reflection": "One sentence connecting this wisdom to what they specifically shared — not generic, not preachy. Just a gentle bridge."
}

Core rules:
- Emotional acknowledgment MUST come first — they need to feel heard before they receive wisdom
- Pick scripture that matches their SPECIFIC pain, not a catch-all quote. If they are lonely, give them something about solitude and inner connection. If they are rejected, give them something about self-worth and dignity. If they are lost, give them something about trust and finding the path.
- Never preach. Never say "you should" or "you must". Never tell them what to do.
- Never minimize their pain or rush them toward feeling better.
- If they mentioned something painful in earlier messages, remember it — do not ignore their history.
- If they express thoughts of self-harm or that life is not worth living, add gently at the end of the acknowledgment: "If this ever feels too heavy to carry alone, please reach out to someone you trust. You deserve real support."
- The user may write in English, Hindi, or Hinglish — respond in the same tone and language style they used.
- Quotes must be REAL and ACCURATELY attributed. Do not invent quotes.
- Do not repeat a scripture or theme that was already offered in the same conversation.
- Return ONLY the JSON object. Nothing else.`;

function buildHistory(messages) {
  return messages
    .filter((m) => {
      if (m.role !== "user" && m.role !== "wisdom") return false;
      // Skip the greeting message
      if (m.id === "greeting" || (m.text && m.text.length > 200 && m.role === "wisdom")) return false;
      return true;
    })
    .map((m) => {
      if (m.role === "user") {
        return { role: "user", content: m.text || "" };
      }
      // Reconstruct assistant message from wisdom response parts
      const parts = [];
      if (m.acknowledgment) parts.push(m.acknowledgment);
      if (m.scripture?.quote) {
        parts.push(`"${m.scripture.quote}" — ${m.scripture.source}${m.scripture.reference ? `, ${m.scripture.reference}` : ""}`);
      }
      if (m.reflection) parts.push(m.reflection);
      if (m.text && parts.length === 0) parts.push(m.text);
      return { role: "assistant", content: parts.join("\n\n") };
    })
    .filter((m) => m.content.trim().length > 0);
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: "API not configured" });
    return;
  }

  const { messages = [] } = req.body || {};

  const history = buildHistory(messages).slice(-10);

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
      // Strip markdown code fences if present
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: wrap the plain text as an acknowledgment
      parsed = {
        acknowledgment: raw,
        scripture: null,
        reflection: ""
      };
    }

    res.status(200).json(parsed);
  } catch (err) {
    console.error("Claude API error:", err.message);
    res.status(500).json({ error: "Service unavailable" });
  }
};
