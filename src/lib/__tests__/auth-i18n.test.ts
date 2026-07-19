import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HI_TEXT, STRINGS } from "../i18n-strings.ts";

const login = readFileSync("src/routes/login.tsx", "utf-8");
const reset = readFileSync("src/routes/reset-password.tsx", "utf-8");
const shell = readFileSync("src/routes/_app.tsx", "utf-8");
const toggle = readFileSync("src/components/LangToggle.tsx", "utf-8");

function txLiterals(src: string): string[] {
  return [...src.matchAll(/tx\(lang,\s*"((?:[^"\\]|\\.)*)"\)/g)]
    .map((m) => m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
}

describe("auth threshold: every tx() literal has Hindi", () => {
  it("login.tsx — all wrapped strings translate", () => {
    const found = txLiterals(login);
    assert.ok(found.length >= 20, `expected the login chrome, found ${found.length}`);
    for (const k of found) assert.ok(HI_TEXT[k] !== undefined, `login: "${k}" wrapped but no Hindi`);
  });
  it("reset-password.tsx — all wrapped strings translate", () => {
    const found = txLiterals(reset);
    assert.ok(found.length >= 9, `expected the reset chrome, found ${found.length}`);
    for (const k of found) assert.ok(HI_TEXT[k] !== undefined, `reset: "${k}" wrapped but no Hindi`);
  });
});

describe("auth threshold: the loud, load-bearing strings are wrapped", () => {
  // The strings a stranger at the door reads first, and the toasts they hit.
  it("login wraps its headings, CTA, and toasts", () => {
    for (const k of [
      "A quiet place to put things down.",
      "Begin",
      "Continue with Google",
      "New here? Just continue — we'll create your space.",
      "A reset link is on its way. Check your inbox.",
      "Your session expired for your safety. Please sign in again to continue.",
    ]) {
      assert.ok(login.includes(`tx(lang, "${k.replace(/"/g, '\\"')}")`), `login not wrapping: ${k}`);
      assert.ok(HI_TEXT[k] !== undefined, `no Hindi: ${k}`);
    }
  });
  it("reset wraps its heading, CTA, and both toasts", () => {
    for (const k of [
      "Set a new password",
      "Save new password",
      "Both passwords need to match.",
      "Password updated. Welcome back.",
    ]) {
      assert.ok(reset.includes(`tx(lang, "${k.replace(/"/g, '\\"')}")`), `reset not wrapping: ${k}`);
      assert.ok(HI_TEXT[k] !== undefined, `no Hindi: ${k}`);
    }
  });
});

describe("auth threshold: the language toggle carries the door's choice inward", () => {
  it("both auth pages read the shared language and mount the toggle", () => {
    for (const [name, src] of [["login", login], ["reset", reset]] as const) {
      assert.ok(src.includes("useLang"), `${name}: does not read the shared language`);
      assert.ok(src.includes("<LangToggle"), `${name}: does not mount the language toggle`);
    }
  });
  it("the toggle writes the shared store and clears the 44px floor", () => {
    assert.ok(toggle.includes("setLang(l)"), "toggle writes the language");
    assert.ok(toggle.includes('aria-pressed={lang === l}'), "active language announced");
    assert.ok(toggle.includes("min-h-11"), "targets must be >=44px, not min-h-9");
    assert.ok(!toggle.includes("min-h-9"), "no 36px target may remain");
  });
});

describe("auth threshold: no bare English text node leaks past tx()", () => {
  // The coverage test proves WRAPPED strings translate; it cannot see a string
  // that was never wrapped. Scan for bare JSX text nodes (>text<, not >{expr}<)
  // that read as English prose — a future unwrapped <h1>Welcome back</h1> fails
  // here even though every other assertion stays green.
  const ALLOW = new Set([
    "My Quiet Space",                                  // the brand — stays Latin
    "developer: preview the app without an account",   // DEV-only, stripped from prod builds
  ]);
  const bareEnglish = (src: string) =>
    [...src.matchAll(/>([^<>{}]+)</g)]
      .map((m) => m[1].replace(/\s+/g, " ").trim())
      .filter((t) => /[a-z]{2}/.test(t) && /^[\x20-\x7E]+$/.test(t)) // ASCII, holds an English word
      .filter((t) => !ALLOW.has(t));
  for (const [name, src] of [["login", login], ["reset", reset]] as const) {
    it(`${name}.tsx renders no unwrapped English prose`, () => {
      const leaks = bareEnglish(src);
      assert.deepEqual(leaks, [], `bare English in ${name}.tsx: ${leaks.join(" | ")}`);
    });
  }
});

describe("frame: the nav shell has no bare-English leaks left", () => {
  it("the shell strings the review flagged now route through t()", () => {
    for (const key of [
      "app.opening", "nav.sanctuary", "privacy.on", "privacy.off",
      "privacy.enable", "privacy.disable", "privacy.note",
      "action.close", "steady.dialogLabel", "nav.primaryLabel",
    ]) {
      assert.ok(shell.includes(`t("${key}")`), `_app.tsx does not use t("${key}")`);
    }
  });
  it("the old hardcoded shell English is gone", () => {
    for (const gone of [">opening your space<", ">sanctuary\n", 'aria-label="Close"', 'aria-label="Primary"', 'aria-label="Steady']) {
      assert.ok(!shell.includes(gone), `stale English still present: ${gone}`);
    }
    assert.ok(!/\bprivacy on\b|\bprivacy off\b/.test(shell.replace(/"privacy\.(on|off)"/g, "")), "literal privacy on/off remains");
  });
});

describe("STRINGS: en and hi keysets match exactly (no half-added key)", () => {
  it("every key present in en is present in hi and vice versa", () => {
    const en = Object.keys(STRINGS.en).sort();
    const hi = Object.keys(STRINGS.hi).sort();
    const missingHi = en.filter((k) => !(k in STRINGS.hi));
    const missingEn = hi.filter((k) => !(k in STRINGS.en));
    assert.deepEqual(missingHi, [], `keys missing from hi: ${missingHi.join(", ")}`);
    assert.deepEqual(missingEn, [], `keys missing from en: ${missingEn.join(", ")}`);
  });
  it("no hi value is left an English echo for ANY newly-added shell key", () => {
    // All 10 Phase-26 shell keys — an untranslated echo (hi === en) must fail,
    // not just the four spot-checks the first pass shipped.
    for (const key of [
      "app.opening", "nav.sanctuary", "nav.primaryLabel", "action.close",
      "steady.dialogLabel", "privacy.on", "privacy.off", "privacy.enable",
      "privacy.disable", "privacy.note",
    ] as const) {
      assert.notEqual(STRINGS.hi[key], STRINGS.en[key], `hi["${key}"] was never translated`);
    }
  });
});
