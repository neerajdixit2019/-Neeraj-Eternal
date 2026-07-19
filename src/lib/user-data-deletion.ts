/**
 * Complete "delete my data" — purge the user's Storage media BEFORE their DB
 * rows, so a delete-everything request truly leaves nothing behind. The audit
 * found deleteMyData dropped database rows but orphaned the uploaded memory
 * images/audio in the "memories" Storage bucket.
 *
 * Runtime-agnostic + dependency-injected so it is unit-testable without a live
 * Supabase. The caller wires a DeletionClient over the RLS-scoped USER client
 * (never service_role): row deletes are owner-scoped by RLS, and Storage
 * removes are owner-scoped by the storage.objects policies
 * (auth.uid() = foldername[1], paths are "{userId}/{uuid}.{ext}"), so a user
 * can only ever remove their own rows and their own files.
 */

/** The user-owned tables cleared on deletion, in FK-safe order. Retained BY
 *  DESIGN for the legal audit trail: consent_records, rights_requests,
 *  safety_events. Reflection children cascade from reflection_sessions
 *  (FK ON DELETE CASCADE); we also clear them explicitly for defence in depth. */
export const DELETED_TABLES = [
  "ai_messages",
  "ai_conversations",
  "journal_entries",
  "mood_logs",
  "user_path_progress",
  "memories",
  "user_story",
  "weekly_letters",
  "reflection_journal_entries",
  "reflection_turns",
  "reflection_sessions",
  "reflections",
  "user_feedback",
] as const;

export const MEMORIES_BUCKET = "memories";

/** storage.remove tolerates large arrays, but chunk defensively so a user with
 *  very many memories can't hit an implicit limit — and so a retry after a
 *  partial failure still completes. */
export const REMOVE_CHUNK = 100;

export interface DeletionClient {
  /** All non-empty media_path values for this user's memories. */
  listMemoryMediaPaths(userId: string): Promise<string[]>;
  /** Remove objects from a bucket. MUST be missing-file-safe (no throw for an
   *  absent object) but MUST throw on a real transport error, so the caller can
   *  abort before deleting rows and the whole operation stays retry-safe. */
  removeMedia(bucket: string, paths: string[]): Promise<void>;
  /** DELETE ... WHERE user_id = userId for one table. Throws on error. */
  deleteOwnedRows(table: string, userId: string): Promise<void>;
  /** Append the completed delete_data rights request (audit trail). */
  recordDeletion(userId: string): Promise<void>;
}

export interface DeletionResult {
  removedMedia: number;
  deletedTables: readonly string[];
}

/**
 * Purge a user's media then rows then write the audit record. Ordered so it is
 * RETRY-SAFE: media is removed first; if any step throws, the surviving rows
 * still reference their (now possibly-removed, missing-file-safe) paths, so a
 * re-run re-derives the work and converges. Never deletes another user's data —
 * every operation is keyed on userId and enforced again by RLS/Storage policy.
 */
export async function purgeAllUserData(
  client: DeletionClient,
  userId: string,
): Promise<DeletionResult> {
  if (!userId) throw new Error("purgeAllUserData: userId is required");

  // 1. Storage FIRST. If this throws, no rows are deleted yet, so the paths can
  //    be re-derived from the surviving memories rows on the next attempt.
  const paths = await client.listMemoryMediaPaths(userId);
  for (let i = 0; i < paths.length; i += REMOVE_CHUNK) {
    await client.removeMedia(MEMORIES_BUCKET, paths.slice(i, i + REMOVE_CHUNK));
  }

  // 2. Rows (owner-scoped).
  for (const table of DELETED_TABLES) {
    await client.deleteOwnedRows(table, userId);
  }

  // 3. Audit trail.
  await client.recordDeletion(userId);

  return { removedMedia: paths.length, deletedTables: DELETED_TABLES };
}
