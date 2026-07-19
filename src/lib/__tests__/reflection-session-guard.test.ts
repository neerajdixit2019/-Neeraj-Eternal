import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  verifySessionOwnership,
  UUID_RE,
  type OwnerRow,
} from "../../../supabase/functions/_shared/session-guard.ts";

/**
 * Security hardening: a client-supplied reflection session_id must be proven to
 * belong to the authenticated caller before any service-role (RLS-bypassing)
 * write keyed on it. These tests cover the pure guard's decisions AND pin the
 * two edge functions' source so the guard is actually invoked before the
 * privileged inserts, behind the existing 401 auth gate.
 */

const SID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ME = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

const owns = (uid: string) => async (_sid: string): Promise<OwnerRow> => ({ user_id: uid });
const missing = async (_sid: string): Promise<OwnerRow> => null;
const boom = async (_sid: string): Promise<OwnerRow> => { throw new Error("db down"); };

describe("verifySessionOwnership — decisions", () => {
  it("valid ownership → ok, sid preserved", async () => {
    const r = await verifySessionOwnership(SID, ME, owns(ME));
    assert.deepEqual(r, { ok: true, sid: SID });
  });

  it("cross-user access → 403 session_forbidden", async () => {
    const r = await verifySessionOwnership(SID, ME, owns(OTHER));
    assert.deepEqual(r, { ok: false, status: 403, error: "session_forbidden" });
  });

  it("nonexistent session → 404 session_not_found", async () => {
    const r = await verifySessionOwnership(SID, ME, missing);
    assert.deepEqual(r, { ok: false, status: 404, error: "session_not_found" });
  });

  it("malformed / non-UUID id → 400, lookup never runs", async () => {
    let looked = false;
    const spy = async (_sid: string): Promise<OwnerRow> => { looked = true; return null; };
    for (const bad of ["not-a-uuid", "", "123", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; drop"]) {
      const r = await verifySessionOwnership(bad, ME, spy);
      assert.deepEqual(r, { ok: false, status: 400, error: "invalid_session_id" });
    }
    assert.equal(looked, false, "a malformed id must be rejected before touching the DB");
  });

  it("missing / non-string id (null, undefined, number, object) → 400", async () => {
    for (const bad of [null, undefined, 42, {}, []]) {
      const r = await verifySessionOwnership(bad, ME, owns(ME));
      assert.deepEqual(r, { ok: false, status: 400, error: "invalid_session_id" });
    }
  });

  it("lookup error → 500 session_lookup_failed (fails closed, does not fall through)", async () => {
    const r = await verifySessionOwnership(SID, ME, boom);
    assert.deepEqual(r, { ok: false, status: 500, error: "session_lookup_failed" });
  });

  it("UUID_RE accepts real v4 ids and rejects garbage", () => {
    assert.ok(UUID_RE.test(SID));
    assert.ok(UUID_RE.test("6ba7b810-9dad-11d1-80b4-00c04fd430c8"));
    for (const bad of ["", "xyz", "aaaaaaaaaaaa", SID + "x"]) assert.ok(!UUID_RE.test(bad));
  });
});

describe("edge functions invoke the guard before privileged writes, behind auth", () => {
  const gen = readFileSync("supabase/functions/generate-reflection/index.ts", "utf-8");
  const cont = readFileSync("supabase/functions/continue-reflection/index.ts", "utf-8");

  it("generate-reflection verifies ownership before the private inserts", () => {
    assert.ok(gen.includes('from "../_shared/session-guard.ts"'), "must import the shared guard");
    assert.ok(/verifySessionOwnership\(sid, userId/.test(gen), "must call the guard with the client sid");
    const guardAt = gen.indexOf("verifySessionOwnership(sid");
    const journalInsert = gen.indexOf('.from("reflection_journal_entries")');
    const reflInsert = gen.indexOf('.from("reflections")');
    assert.ok(guardAt > 0 && journalInsert > guardAt, "guard must run before the journal insert");
    assert.ok(reflInsert > guardAt, "guard must run before the reflection insert");
    // returns the guard's status on failure
    assert.ok(/return jsonResponse\(guard\.status/.test(gen));
  });

  it("generate-reflection rejects unauthenticated callers before any privileged work", () => {
    const unauth = gen.indexOf('jsonResponse(401, { error: "unauthorized" })');
    const userId = gen.indexOf("const userId = userRes.user.id");
    const guardAt = gen.indexOf("verifySessionOwnership(sid");
    assert.ok(unauth > 0 && userId > unauth, "401 gate precedes deriving userId");
    assert.ok(guardAt > userId, "ownership guard runs only after the caller is authenticated");
  });

  it("continue-reflection validates the UUID and ownership before the turns insert", () => {
    assert.ok(cont.includes('from "../_shared/session-guard.ts"'), "must import UUID_RE");
    assert.ok(/UUID_RE\.test\(sessionId\)/.test(cont), "must validate the session id shape");
    const ownCheck = cont.indexOf("session.user_id !== userId");
    const forbidden = cont.indexOf('jsonResponse(403');
    const turnsInsert = cont.indexOf('.from("reflection_turns")');
    assert.ok(ownCheck > 0 && forbidden > 0, "must 403 on a session owned by another user");
    assert.ok(turnsInsert > ownCheck, "ownership check must precede the turns insert");
  });

  it("continue-reflection also rejects unauthenticated callers", () => {
    const unauth = cont.indexOf('jsonResponse(401, { error: "unauthorized" })');
    const userId = cont.indexOf("const userId = userRes.user.id");
    assert.ok(unauth > 0 && userId > unauth);
  });
});
