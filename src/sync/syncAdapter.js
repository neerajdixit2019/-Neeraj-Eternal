import { getSyncableProgressSnapshot } from "../storage/progressSnapshot.js";
import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

export function getSyncStatus() {
  return {
    configured: isSupabaseConfigured,
    provider: "supabase",
    privateTextSynced: false
  };
}

export function getSyncSnapshot() {
  return getSyncableProgressSnapshot();
}

export async function getCurrentSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session || null;
}

export async function signInWithEmail(email) {
  if (!supabase) throw new Error("Supabase is not configured yet.");
  const redirectTo = `${window.location.origin}/me`;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo }
  });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function syncProgressSnapshot() {
  if (!supabase) throw new Error("Supabase is not configured yet.");
  const session = await getCurrentSession();
  if (!session?.user) throw new Error("Please sign in before syncing.");

  const snapshot = getSyncableProgressSnapshot();
  const { error } = await supabase.from("profiles").upsert({
    id: session.user.id,
    email: session.user.email,
    sync_snapshot: snapshot,
    updated_at: new Date().toISOString()
  });

  if (error) throw error;
  return snapshot;
}
