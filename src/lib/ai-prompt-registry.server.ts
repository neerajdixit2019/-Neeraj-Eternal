import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

/**
 * In-process cache of resolved prompt-version ids, keyed by
 * `${name}::${model}::${hash}`. The registry is upsert-once-per-version,
 * so once we know an id we never need to look it up again for the life
 * of the worker.
 */
const versionIdCache = new Map<string, string>();

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Register (or look up) a prompt+model version, returning its stable id.
 *
 * Call this once per AI invocation before logInvocation. We hash the full
 * system text so any edit to a prompt produces a new version row — that's
 * the audit trail we want for "which prompt produced this reply?".
 *
 * Fail-soft: if the registry write errors, returns null and the caller
 * still logs the invocation without a version reference. We never want
 * audit gaps to block a user reply.
 */
export async function registerPromptVersion(args: {
  promptName: string;
  model: string;
  systemText: string;
  metadata?: Json;
}): Promise<string | null> {
  const hash = (await sha256Hex(args.systemText)).slice(0, 32);
  const cacheKey = `${args.promptName}::${args.model}::${hash}`;
  const cached = versionIdCache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data, error } = await supabaseAdmin
      .from("ai_prompt_versions")
      .upsert(
        {
          prompt_name: args.promptName,
          hash,
          model: args.model,
          system_text: args.systemText,
          metadata: (args.metadata ?? {}) as Json,
        },
        { onConflict: "prompt_name,hash,model" },
      )
      .select("id")
      .single();

    if (error || !data) {
      console.error("[prompt-registry] upsert failed", { promptName: args.promptName, error });
      return null;
    }
    versionIdCache.set(cacheKey, data.id);
    return data.id;
  } catch (err) {
    console.error("[prompt-registry] upsert threw", err);
    return null;
  }
}

export type InvocationStatus = "ok" | "error" | "rate_limited" | "no_key" | "crisis_bypass";

/**
 * Append one row to ai_prompt_invocations. Fire-and-forget from the caller's
 * perspective: we await it but swallow errors so a logging hiccup never
 * breaks the user-facing reply.
 */
export async function logInvocation(args: {
  userId: string;
  route: string;
  promptVersionId: string | null;
  model: string;
  status: InvocationStatus;
  errorCode?: string | null;
  latencyMs?: number | null;
  inputChars?: number | null;
  outputChars?: number | null;
  metadata?: Json;
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("ai_prompt_invocations").insert({
      user_id: args.userId,
      route: args.route,
      prompt_version_id: args.promptVersionId,
      model: args.model,
      status: args.status,
      error_code: args.errorCode ?? null,
      latency_ms: args.latencyMs ?? null,
      input_chars: args.inputChars ?? null,
      output_chars: args.outputChars ?? null,
      metadata: (args.metadata ?? {}) as Json,
    });
    if (error) console.error("[prompt-registry] log insert failed", error);
  } catch (err) {
    console.error("[prompt-registry] log insert threw", err);
  }
}