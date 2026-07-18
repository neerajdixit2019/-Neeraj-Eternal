import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  hashPin,
  makeSalt,
  isValidPin,
  attemptDelayMs,
  shouldRelatch,
  MAX_ATTEMPT_DELAY_MS,
  RELATCH_AFTER_MS,
} from "../latch.ts";

describe("latch: the key", () => {
  it("accepts exactly four digits", () => {
    assert.equal(isValidPin("0413"), true);
    for (const bad of ["", "123", "12345", "12a4", "١٢٣٤", "12 4"]) {
      assert.equal(isValidPin(bad), false, bad);
    }
  });

  it("hashes deterministically with the same salt, differently with another", async () => {
    const salt = makeSalt();
    const a = await hashPin("1234", salt, 50);
    const b = await hashPin("1234", salt, 50);
    const c = await hashPin("1234", makeSalt(), 50);
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.match(a, /^[0-9a-f]{64}$/);
  });

  it("different pins never share a hash", async () => {
    const salt = makeSalt();
    assert.notEqual(await hashPin("1234", salt, 50), await hashPin("1235", salt, 50));
  });

  it("salts are unpredictable and well-formed", () => {
    const a = makeSalt();
    const b = makeSalt();
    assert.match(a, /^[0-9a-f]{32}$/);
    assert.notEqual(a, b);
  });
});

describe("latch: never a lockout", () => {
  it("first try is never delayed", () => {
    assert.equal(attemptDelayMs(0), 0);
  });

  it("misses slow the door but the cap holds", () => {
    assert.equal(attemptDelayMs(1), 600);
    assert.equal(attemptDelayMs(3), 1800);
    assert.equal(attemptDelayMs(100), MAX_ATTEMPT_DELAY_MS);
    assert.ok(MAX_ATTEMPT_DELAY_MS <= 5_000, "pacing must stay a nuisance, never a bar");
  });
});

describe("latch: pacing survives the gate's own doors", () => {
  const gate = readFileSync("src/components/LatchGate.tsx", "utf-8");

  it("the gate seeds its miss count from storage and records each miss", () => {
    assert.ok(gate.includes("readMisses()"), "must seed from persisted misses");
    assert.ok(gate.includes("noteMiss()"), "must persist each miss");
    assert.ok(gate.includes("clearMisses()"), "the right key must clear the count");
  });
});

describe("latch: the grace window", () => {
  it("never relatches without a hidden timestamp", () => {
    assert.equal(shouldRelatch(null, 10_000_000), false);
  });

  it("short absences do not relatch; long ones do", () => {
    const t = 1_000_000;
    assert.equal(shouldRelatch(t, t + RELATCH_AFTER_MS - 1), false);
    assert.equal(shouldRelatch(t, t + RELATCH_AFTER_MS), true);
  });
});

describe("latch: the sanctuary stays open", () => {
  const appLayout = readFileSync("src/routes/_app.tsx", "utf-8");
  const gate = readFileSync("src/components/LatchGate.tsx", "utf-8");
  const routerTs = readFileSync("src/router.tsx", "utf-8");

  it("neither the gate nor the veil ever covers /sos", () => {
    // Anchored to the component renders so one line can't satisfy both.
    assert.match(appLayout, /latchLocked && !isSanctuary && \(\s*<LatchGate/, "gate must be sanctuary-guarded");
    assert.match(appLayout, /veiled && !latchLocked && !isSanctuary && <Veil/, "veil must be sanctuary-guarded");
  });

  it("the covered study leaves the tab order entirely", () => {
    assert.ok(appLayout.includes("inert={covered || undefined}"), "shell must go inert while covered");
    assert.ok(gate.includes("trapTab"), "the gate must trap Tab");
  });

  it("the gate itself holds a door to the steady room", () => {
    assert.ok(gate.includes('to="/sos"'));
  });

  it("gate sign-out clears the latch only after sign-out succeeds", () => {
    assert.ok(gate.includes("clearPin()"), "gate must clear the latch");
    const errorGuardBeforeClear = gate.indexOf("if (error)") < gate.indexOf("clearPin()");
    assert.ok(errorGuardBeforeClear, "clearPin must sit behind the sign-out success check");
  });

  it("every way a session ends takes the latch with it", () => {
    const authListener = appLayout.slice(appLayout.indexOf("onAuthStateChange"));
    assert.ok(authListener.includes("clearPin()"), "onAuthStateChange !session must clear the latch");
    assert.ok(routerTs.includes("clearPin()"), "session-expiry path must clear the latch");
  });
});
