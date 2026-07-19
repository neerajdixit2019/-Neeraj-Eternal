#!/usr/bin/env node
/**
 * Post-deploy verification for the Supabase reflection edge functions.
 * Run this AFTER: supabase functions deploy generate-reflection continue-reflection
 *
 * It proves the two things that deploy ships:
 *   1. SECURITY  — a client-supplied session_id is verified against the caller
 *      (403 cross-user, 404 nonexistent, 400 malformed, 401 unauthenticated,
 *       200 own session).
 *   2. HINDI     — lang:"hi" returns Devanagari reflection text; default is English.
 *
 * Self-contained + self-cleaning: it admin-creates two throwaway users, runs the
 * matrix, then deletes them and their reflection rows. It NEVER prints secrets
 * and touches no real user data.
 *
 * Requires @supabase/supabase-js (already a dependency) and these env vars:
 *   SUPABASE_URL                 e.g. https://<ref>.supabase.co
 *   SUPABASE_ANON_KEY            (publishable / anon key; falls back to
 *                                 SUPABASE_PUBLISHABLE_KEY)
 *   SUPABASE_SERVICE_ROLE_KEY    (used only to create/delete the test users)
 *
 * Usage (from the repo root):
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/verify-reflection-deploy.mjs
 * (On Windows PowerShell, set the three with $env:NAME='...' first, then run node.)
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// ---- env (never printed) ----
const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const missing = [
  ["SUPABASE_URL", URL],
  ["SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY)", ANON],
  ["SUPABASE_SERVICE_ROLE_KEY", SERVICE],
].filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error("Missing required env var(s): " + missing.join(", "));
  console.error("Set them (values are read from the environment, never hard-coded) and re-run.");
  process.exit(2);
}

const FN = (name) => `${URL.replace(/\/$/, "")}/functions/v1/${name}`;
const DEVANAGARI = /[ऀ-ॿ]/;
const BENIGN = "I've felt a little tired and quiet this week, but I think I'm okay overall.";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

// POST to an edge function. `token` null => send no Authorization (unauth test).
// Retries once on a 429 (rate limit is 6/60s per user).
async function callFn(name, token, body, { retried = false } = {}) {
  const headers = { "Content-Type": "application/json", apikey: ANON };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(FN(name), { method: "POST", headers, body: JSON.stringify(body) });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON (e.g. platform 401) */ }
  if (res.status === 429 && !retried) {
    console.log("  (rate-limited; pausing 61s then retrying once…)");
    await sleep(61_000);
    return callFn(name, token, body, { retried: true });
  }
  return { status: res.status, json };
}

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

async function makeUser(tag) {
  const email = `mqs-verify-${tag}-${randomUUID().slice(0, 8)}@example.com`;
  const password = `Vf-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data?.user) throw new Error(`createUser(${tag}) failed: ${error?.message}`);
  const anon = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: s, error: sErr } = await anon.auth.signInWithPassword({ email, password });
  if (sErr || !s?.session?.access_token) throw new Error(`signIn(${tag}) failed: ${sErr?.message}`);
  return { id: data.user.id, token: s.session.access_token };
}

async function cleanup(userIds) {
  for (const t of ["reflection_turns", "reflection_journal_entries", "reflections", "reflection_sessions", "safety_events", "user_feedback", "profiles"]) {
    try { await admin.from(t).delete().in(t === "profiles" ? "id" : "user_id", userIds); } catch { /* best-effort */ }
  }
  for (const id of userIds) {
    try { await admin.auth.admin.deleteUser(id); } catch { /* best-effort */ }
  }
}

async function main() {
  console.log("Verifying reflection edge functions at", URL.replace(/^https?:\/\//, "").split(".")[0] + ".supabase.co\n");

  let A, B;
  try {
    A = await makeUser("a");
    B = await makeUser("b");
  } catch (e) {
    console.error("Setup failed:", e.message);
    process.exit(1);
  }

  const validUuidNoSession = randomUUID();
  const genBody = (extra = {}) => ({ category: "Anxiety", intensity: 5, save_mode: "private", message: BENIGN, ...extra });
  const contBody = (extra = {}) => ({ save_mode: "private", message: "It's a bit better today, thanks.", ...extra });

  try {
    // ---------- AUTH GATE ----------
    console.log("Auth gate:");
    check("generate: no Authorization -> 401", (await callFn("generate-reflection", null, genBody())).status === 401);
    check("continue: no Authorization -> 401", (await callFn("continue-reflection", null, contBody({ session_id: validUuidNoSession }))).status === 401);
    check("generate: garbage token -> 401", (await callFn("generate-reflection", "not.a.jwt", genBody())).status === 401);

    // ---------- VALID OWN PATH (creates A's session) ----------
    console.log("Valid path + Hindi:");
    const created = await callFn("generate-reflection", A.token, genBody());
    const sidA = created.json?.session_id;
    check("generate: valid new private session -> 200 + session_id + reflection",
      created.status === 200 && !!sidA && !!created.json?.reflection?.what_i_hear,
      `status=${created.status} session_id=${sidA ? "present" : "MISSING"}`);

    // ---------- HINDI (Phase 28-C) ----------
    const hi = await callFn("generate-reflection", A.token, genBody({ lang: "hi" }));
    const hiText = [hi.json?.reflection?.what_i_hear, hi.json?.reflection?.gentle_question, hi.json?.reflection?.title].filter(Boolean).join(" ");
    check("generate: lang:hi -> Devanagari reflection", hi.status === 200 && DEVANAGARI.test(hiText),
      `status=${hi.status} devanagari=${DEVANAGARI.test(hiText)}`);

    const en = await callFn("generate-reflection", A.token, genBody({ lang: "en" }));
    const enText = String(en.json?.reflection?.what_i_hear ?? "");
    check("generate: lang:en -> English (no Devanagari)", en.status === 200 && !DEVANAGARI.test(enText),
      `status=${en.status} devanagari=${DEVANAGARI.test(enText)}`);

    // ---------- OWNERSHIP SECURITY (the fix) ----------
    console.log("Ownership security:");
    if (!sidA) {
      check("generate: cross-user -> 403 (SKIPPED: no session to target)", false, "A's session was not created");
      check("continue: cross-user -> 403 (SKIPPED)", false, "A's session was not created");
    } else {
      const xGen = await callFn("generate-reflection", B.token, genBody({ session_id: sidA }));
      check("generate: B uses A's session_id -> 403 session_forbidden",
        xGen.status === 403 && xGen.json?.error === "session_forbidden", `status=${xGen.status} error=${xGen.json?.error}`);

      const xCont = await callFn("continue-reflection", B.token, contBody({ session_id: sidA }));
      check("continue: B uses A's session_id -> 403 forbidden",
        xCont.status === 403 && xCont.json?.error === "forbidden", `status=${xCont.status} error=${xCont.json?.error}`);
    }

    // ---------- NONEXISTENT ----------
    console.log("Nonexistent / malformed:");
    const neGen = await callFn("generate-reflection", A.token, genBody({ session_id: validUuidNoSession }));
    check("generate: unknown UUID -> 404 session_not_found",
      neGen.status === 404 && neGen.json?.error === "session_not_found", `status=${neGen.status} error=${neGen.json?.error}`);
    const neCont = await callFn("continue-reflection", A.token, contBody({ session_id: validUuidNoSession }));
    check("continue: unknown UUID -> 404 session_not_found",
      neCont.status === 404 && neCont.json?.error === "session_not_found", `status=${neCont.status} error=${neCont.json?.error}`);

    // ---------- MALFORMED ----------
    const mfGen = await callFn("generate-reflection", A.token, genBody({ session_id: "not-a-uuid" }));
    check("generate: malformed session_id -> 400 invalid_session_id",
      mfGen.status === 400 && mfGen.json?.error === "invalid_session_id", `status=${mfGen.status} error=${mfGen.json?.error}`);
    const mfCont = await callFn("continue-reflection", A.token, contBody({ session_id: "not-a-uuid" }));
    check("continue: malformed session_id -> 400 invalid_session_id",
      mfCont.status === 400 && mfCont.json?.error === "invalid_session_id", `status=${mfCont.status} error=${mfCont.json?.error}`);

    // ---------- VALID OWN CONTINUE (own session works end-to-end) ----------
    if (sidA) {
      const okCont = await callFn("continue-reflection", A.token, contBody({ session_id: sidA }));
      check("continue: A continues A's own session -> 200 + reflection",
        okCont.status === 200 && !!okCont.json?.reflection, `status=${okCont.status}`);
    }
  } finally {
    console.log("\nCleaning up test users + data…");
    await cleanup([A.id, B.id]);
  }

  // ---------- SUMMARY ----------
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.log("FAILED:");
    for (const f of failed) console.log(`  - ${f.name}${f.detail ? `  (${f.detail})` : ""}`);
    console.log("\nRESULT: FAIL — the deploy did not fully take, or a function is misbehaving.");
    process.exit(1);
  }
  console.log("RESULT: PASS — session ownership is enforced and Hindi replies are live.");
  process.exit(0);
}

main().catch((e) => { console.error("Verifier crashed:", e.message); process.exit(1); });
