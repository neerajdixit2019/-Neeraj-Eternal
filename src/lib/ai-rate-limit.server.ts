import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type RateLimitConfig = {
  /** Max calls allowed in the window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  /** Seconds until the window resets — useful for Retry-After. */
  retryAfterSeconds: number;
};

/**
 * Default per-user limits per AI route.
 * Tuned for normal reflective use; abuse and runaway loops trip well below
 * these. Crisis paths must bypass this — never gate safety responses.
 */
export const AI_RATE_LIMITS: Record<string, RateLimitConfig> = {
  "companion.stream": { limit: 40, windowSeconds: 60 * 10 },     // 40 / 10 min
  "companion.fallback": { limit: 40, windowSeconds: 60 * 10 },
  "weekly_letter.generate": { limit: 5, windowSeconds: 60 * 60 * 24 }, // 5 / day
};

/**
 * Atomically increment the user's counter for this route and return whether
 * the call is allowed. Backed by a SECURITY DEFINER Postgres function so
 * concurrent requests don't race past the limit.
 *
 * Fail-open: if the backend errors (unlikely), we ALLOW the call. We never
 * want infra hiccups to block a person trying to be heard.
 */
export async function consumeAiRateLimit(
  userId: string,
  route: string,
  cfg: RateLimitConfig = AI_RATE_LIMITS[route] ?? { limit: 30, windowSeconds: 600 },
): Promise<RateLimitResult> {
  try {
    // The rpc helper isn't in the generated types yet — cast for now.
    const { data, error } = await (supabaseAdmin as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{
        data: Array<{ allowed: boolean; remaining: number; reset_at: string }> | null;
        error: { message: string } | null;
      }>;
    }).rpc("consume_ai_rate_limit", {
      p_user_id: userId,
      p_route: route,
      p_limit: cfg.limit,
      p_window_seconds: cfg.windowSeconds,
    });

    if (error || !data?.[0]) {
      console.error("[ai-rate-limit] rpc failed, failing open", { route, error });
      return failOpen(cfg);
    }
    const row = data[0];
    const resetAt = new Date(row.reset_at);
    return {
      allowed: row.allowed,
      remaining: row.remaining,
      resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000)),
    };
  } catch (err) {
    console.error("[ai-rate-limit] threw, failing open", { route, err });
    return failOpen(cfg);
  }
}

function failOpen(cfg: RateLimitConfig): RateLimitResult {
  const resetAt = new Date(Date.now() + cfg.windowSeconds * 1000);
  return { allowed: true, remaining: cfg.limit, resetAt, retryAfterSeconds: cfg.windowSeconds };
}

/**
 * Standard 429 response for rate-limited AI calls. Plain text body so the
 * UI can surface a calm message; numeric headers for clients that handle
 * Retry-After.
 */
export function rateLimitedResponse(result: RateLimitResult): Response {
  return new Response(
    "Too many requests right now. Take a slow breath — you can try again in a few minutes.",
    {
      status: 429,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Reset": result.resetAt.toISOString(),
      },
    },
  );
}