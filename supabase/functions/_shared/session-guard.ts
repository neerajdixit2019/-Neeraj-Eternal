/**
 * Prove that a client-supplied reflection session_id belongs to the
 * authenticated caller BEFORE any service-role (RLS-bypassing) write keyed on
 * it. Without this, a user could graft reflections/turns onto another user's
 * session by passing its id.
 *
 * Pure and runtime-agnostic (no Deno/Node APIs, no Supabase import) so it can
 * be imported by BOTH the Deno edge functions and the node:test gate. The
 * caller injects the lookup, so the guard has no I/O of its own.
 */

/** RFC-4122 shape check. Rejecting a malformed id here avoids handing an
 *  invalid value to a uuid column (which would surface as an opaque DB error). */
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type OwnerRow = { user_id: string } | null;

export type SessionOwnership =
  | { ok: true; sid: string }
  | { ok: false; status: 400 | 403 | 404 | 500; error: string };

/**
 * @param sid          client-supplied session id (unknown / possibly null)
 * @param userId       the authenticated caller (from a verified JWT)
 * @param lookupOwner  async (validSid) => the session's owner row, or null if
 *                     no such session exists
 *
 * Returns:
 *  - 400 invalid_session_id  — missing, non-string, or not a UUID
 *  - 404 session_not_found   — well-formed but no such session
 *  - 403 session_forbidden   — session exists but is owned by another user
 *  - 500 session_lookup_failed — the lookup itself errored
 *  - ok                      — the session exists and belongs to the caller
 */
export async function verifySessionOwnership(
  sid: unknown,
  userId: string,
  lookupOwner: (validSid: string) => Promise<OwnerRow>,
): Promise<SessionOwnership> {
  if (typeof sid !== "string" || !UUID_RE.test(sid)) {
    return { ok: false, status: 400, error: "invalid_session_id" };
  }
  let owner: OwnerRow;
  try {
    owner = await lookupOwner(sid);
  } catch {
    return { ok: false, status: 500, error: "session_lookup_failed" };
  }
  if (!owner) return { ok: false, status: 404, error: "session_not_found" };
  if (owner.user_id !== userId) {
    return { ok: false, status: 403, error: "session_forbidden" };
  }
  return { ok: true, sid };
}
