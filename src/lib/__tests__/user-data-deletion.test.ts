import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  purgeAllUserData,
  DELETED_TABLES,
  MEMORIES_BUCKET,
  REMOVE_CHUNK,
  type DeletionClient,
} from "../user-data-deletion.ts";

/**
 * Privacy hardening: "delete my data" must erase BOTH the database rows and the
 * uploaded Storage media, purge media before rows, tolerate missing files, be
 * retry-safe, and never touch another user's data. These tests drive the pure
 * orchestrator with a recording mock (no live Supabase).
 */

type Call =
  | { op: "list"; userId: string }
  | { op: "remove"; bucket: string; paths: string[] }
  | { op: "delete"; table: string; userId: string }
  | { op: "audit"; userId: string };

function recorder(opts: {
  paths?: string[];
  removeThrowsOn?: (paths: string[]) => boolean;
  deleteThrowsOn?: (table: string) => boolean;
} = {}) {
  const calls: Call[] = [];
  const client: DeletionClient = {
    listMemoryMediaPaths: async (userId) => {
      calls.push({ op: "list", userId });
      return opts.paths ?? [];
    },
    removeMedia: async (bucket, paths) => {
      calls.push({ op: "remove", bucket, paths });
      if (opts.removeThrowsOn?.(paths)) throw new Error("storage transport error");
    },
    deleteOwnedRows: async (table, userId) => {
      calls.push({ op: "delete", table, userId });
      if (opts.deleteThrowsOn?.(table)) throw new Error(`delete failed: ${table}`);
    },
    recordDeletion: async (userId) => {
      calls.push({ op: "audit", userId });
    },
  };
  return { client, calls };
}

const USER = "11111111-1111-1111-1111-111111111111";

describe("purgeAllUserData — both media and rows are deleted", () => {
  it("removes every media path AND deletes every owned table, then writes the audit", async () => {
    const { client, calls } = recorder({ paths: ["u/a.jpg", "u/b.png"] });
    const res = await purgeAllUserData(client, USER);

    // media removed
    const removes = calls.filter((c) => c.op === "remove");
    assert.equal(removes.length, 1);
    assert.equal(removes[0].op === "remove" && removes[0].bucket, MEMORIES_BUCKET);
    assert.deepEqual(removes[0].op === "remove" && removes[0].paths, ["u/a.jpg", "u/b.png"]);
    assert.equal(res.removedMedia, 2);

    // every user-owned table deleted, exactly once, in order
    const deletedTables = calls.filter((c) => c.op === "delete").map((c) => (c.op === "delete" ? c.table : ""));
    assert.deepEqual(deletedTables, [...DELETED_TABLES]);

    // audit last
    assert.equal(calls[calls.length - 1].op, "audit");
    assert.deepEqual(res.deletedTables, [...DELETED_TABLES]);
  });

  it("purges Storage BEFORE deleting the memories row (retry-safe ordering)", async () => {
    const { client, calls } = recorder({ paths: ["u/a.jpg"] });
    await purgeAllUserData(client, USER);
    const firstRemove = calls.findIndex((c) => c.op === "remove");
    const memoriesDelete = calls.findIndex((c) => c.op === "delete" && c.table === "memories");
    assert.ok(firstRemove >= 0 && memoriesDelete >= 0);
    assert.ok(firstRemove < memoriesDelete, "media must be removed before the memories rows are deleted");
  });

  it("with no media, skips storage removal but still deletes rows + audit", async () => {
    const { client, calls } = recorder({ paths: [] });
    const res = await purgeAllUserData(client, USER);
    assert.equal(calls.filter((c) => c.op === "remove").length, 0);
    assert.equal(res.removedMedia, 0);
    assert.equal(calls.filter((c) => c.op === "delete").length, DELETED_TABLES.length);
    assert.equal(calls[calls.length - 1].op, "audit");
  });

  it("is user-scoped — every operation carries the caller's id, no other user is referenced", async () => {
    const { client, calls } = recorder({ paths: ["u/a.jpg"] });
    await purgeAllUserData(client, USER);
    for (const c of calls) {
      if (c.op === "list" || c.op === "delete" || c.op === "audit") assert.equal(c.userId, USER);
    }
  });

  it("chunks large media sets into batches of at most REMOVE_CHUNK", async () => {
    const paths = Array.from({ length: REMOVE_CHUNK * 2 + 5 }, (_, i) => `u/${i}.jpg`);
    const { client, calls } = recorder({ paths });
    const res = await purgeAllUserData(client, USER);
    const removes = calls.filter((c) => c.op === "remove") as Extract<Call, { op: "remove" }>[];
    assert.equal(removes.length, 3); // 100 + 100 + 5
    for (const r of removes) assert.ok(r.paths.length <= REMOVE_CHUNK);
    assert.equal(removes.reduce((n, r) => n + r.paths.length, 0), paths.length);
    assert.equal(res.removedMedia, paths.length);
  });
});

describe("purgeAllUserData — failure handling keeps it retry-safe", () => {
  it("if storage removal throws, NO rows are deleted (media-first, abort-before-rows)", async () => {
    const { client, calls } = recorder({ paths: ["u/a.jpg"], removeThrowsOn: () => true });
    await assert.rejects(() => purgeAllUserData(client, USER), /storage transport error/);
    assert.equal(calls.filter((c) => c.op === "delete").length, 0, "rows must survive a storage failure so a retry can re-derive paths");
    assert.equal(calls.filter((c) => c.op === "audit").length, 0);
  });

  it("propagates a row-delete error (honest failure the caller can retry)", async () => {
    const { client, calls } = recorder({ paths: [], deleteThrowsOn: (t) => t === "mood_logs" });
    await assert.rejects(() => purgeAllUserData(client, USER), /delete failed: mood_logs/);
    // audit not written because deletion did not complete
    assert.equal(calls.filter((c) => c.op === "audit").length, 0);
  });

  it("rejects an empty userId rather than issuing an unscoped wipe", async () => {
    const { client } = recorder({ paths: [] });
    await assert.rejects(() => purgeAllUserData(client, ""), /userId is required/);
  });

  it("memories is in the deleted-tables set (media's owning table is erased)", () => {
    assert.ok(DELETED_TABLES.includes("memories"));
  });
});
