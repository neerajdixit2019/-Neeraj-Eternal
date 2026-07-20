/**
 * Shared helpers for classifying AI provider failures and producing
 * user-safe fallback copy. Keeps the "invalid key" vs "generic error"
 * distinction consistent across every Google AI call site, so the
 * invocation log carries a stable errorCode and the UI never leaks
 * provider strings to the user.
 */

export type AiFailureKind = "no_key" | "invalid_key" | "rate_limited" | "error";

/**
 * Recognise the shape of a Google Generative AI auth failure.
 * The AI SDK surfaces provider errors with fields like `statusCode`,
 * `responseBody`, and `message`; a bad or revoked key comes back as a
 * 400/401/403 with a body mentioning "API key not valid" or
 * "API_KEY_INVALID". We match defensively.
 */
export function isInvalidKeyError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    statusCode?: number;
    status?: number;
    message?: string;
    responseBody?: string;
    data?: { error?: { status?: string; message?: string } };
  };
  const status = e.statusCode ?? e.status;
  const text = [
    e.message ?? "",
    e.responseBody ?? "",
    e.data?.error?.status ?? "",
    e.data?.error?.message ?? "",
  ].join(" ").toLowerCase();
  if (/api key not valid|api_key_invalid|invalid api key|permission denied/.test(text)) return true;
  if (status === 401 || status === 403) return true;
  if (status === 400 && /api[_ ]?key/.test(text)) return true;
  return false;
}

export function classifyAiError(err: unknown): AiFailureKind {
  return isInvalidKeyError(err) ? "invalid_key" : "error";
}

/**
 * User-facing fallback copy for AI outages. Never mentions "Google",
 * "API key", or any provider — the user reads a calm, honest sentence
 * that matches the room's voice.
 */
export function aiFallbackMessage(
  kind: AiFailureKind,
  lang: "en" | "hi" = "en",
): string {
  if (lang === "hi") {
    switch (kind) {
      case "no_key":
      case "invalid_key":
        return "मैं यहीं हूँ, चुपचाप। (AI अभी उपलब्ध नहीं है — आपके शब्द सुरक्षित सहेज लिए गए हैं।)";
      case "rate_limited":
        return "एक धीमी साँस लीजिए। कुछ मिनट बाद फिर कोशिश कीजिए।";
      default:
        return "मैं आपके साथ हूँ, पर अभी शब्द नहीं मिल रहे। एक पल बाद फिर कोशिश कीजिए।";
    }
  }
  switch (kind) {
    case "no_key":
    case "invalid_key":
      return "I'm here, quietly. (AI is unavailable right now — your words are safely saved.)";
    case "rate_limited":
      return "Take a slow breath. Try again in a few minutes.";
    default:
      return "I'm here with you, but I'm having trouble finding my words right now. Try again in a moment.";
  }
}

/**
 * Log a one-liner so operators grepping worker logs immediately see
 * "the key is missing" or "the key was rejected" without digging into
 * `ai_prompt_invocations`. Never prints the key itself.
 */
export function logAiKeyIssue(route: string, kind: "missing" | "invalid", err?: unknown) {
  if (kind === "missing") {
    console.error(`[ai] ${route}: GOOGLE_GENERATIVE_AI_API_KEY is missing — serving fallback.`);
    return;
  }
  console.error(
    `[ai] ${route}: GOOGLE_GENERATIVE_AI_API_KEY was rejected by the provider — serving fallback.`,
    err instanceof Error ? { name: err.name, message: err.message } : err,
  );
}
