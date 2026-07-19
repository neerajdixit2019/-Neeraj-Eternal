import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HI_TEXT } from "../i18n-strings.ts";
import { LETTER_COPY } from "../trusted-letter.ts";
import { ARCHIVE_COPY } from "../export-pdf.ts";

/**
 * Phase 31 — the finale. Pins the leak-sweep: every user-visible string the
 * sweep wrapped in tx() on the previously-partial surfaces (Sanctuary, Home,
 * SOS, Journal, and the shared components) resolves to Hindi, stored enum
 * values stay English, and the trusted-letter / private-archive PDFs are fully
 * bilingual from their one shared copy source.
 */

const files = {
  settings: readFileSync("src/routes/_app.settings.tsx", "utf-8"),
  home: readFileSync("src/routes/_app.home.tsx", "utf-8"),
  sos: readFileSync("src/routes/_app.sos.tsx", "utf-8"),
  journal: readFileSync("src/routes/_app.journal.tsx", "utf-8"),
  urgeShield: readFileSync("src/routes/_app.urge-shield.tsx", "utf-8"),
  memories: readFileSync("src/routes/_app.memories.tsx", "utf-8"),
  checkinRitual: readFileSync("src/components/CheckinRitual.tsx", "utf-8"),
  verseQuote: readFileSync("src/components/VerseQuote.tsx", "utf-8"),
  trustedLetter: readFileSync("src/routes/_app.trusted-letter.tsx", "utf-8"),
};

function txLiterals(s: string): string[] {
  return [...s.matchAll(/tx\(lang,\s*"((?:[^"\\]|\\.)*)"\)/g)]
    .map((m) => m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
}

const hasDevanagari = (s: string) => /[ऀ-ॿ]/.test(s);

describe("finale: every tx() literal on the swept surfaces has Hindi", () => {
  for (const [name, src] of Object.entries(files)) {
    it(`${name} — all wrapped strings translate`, () => {
      const found = txLiterals(src);
      for (const k of found) {
        assert.ok(HI_TEXT[k] !== undefined, `${name}: "${k}" wrapped but no Hindi`);
      }
    });
  }

  it("the sweep covered a large amount of previously-English chrome", () => {
    const total = Object.values(files).reduce((n, s) => n + txLiterals(s).length, 0);
    assert.ok(total >= 250, `expected the finale surfaces wrapped, found ${total}`);
  });
});

describe("finale: stored values and brands stay English (display-only)", () => {
  it("Sanctuary insight-source keys and tone/story enums are never Devanagari", () => {
    // the machine-readable keys must remain their English enum literals
    for (const key of ["daily_checkin", "journal", "memory", "innermate_chat"]) {
      assert.match(files.settings, new RegExp(`key:\\s*"${key}"`), `insight source key ${key} missing`);
    }
    assert.ok(!/key:\s*"[^"]*[ऀ-ॿ]/.test(files.settings), "a stored key was translated into Devanagari");
    assert.ok(!/id:\s*"[^"]*[ऀ-ॿ]/.test(files.settings), "a stored id was translated into Devanagari");
  });

  it("crisis provider names and Tele-MANAS stay Latin on the SOS page", () => {
    // brand/provider names must not be translated
    assert.ok(files.sos.includes("Tele-MANAS"), "Tele-MANAS name must remain");
    // no tx() key should itself be a translated brand name
    for (const brand of ["InnerMate", "Tele-MANAS", "My Quiet Space"]) {
      assert.ok(HI_TEXT[brand] === undefined || HI_TEXT[brand] === brand, `${brand} must not be translated as a key`);
    }
  });
});

describe("finale: the two PDFs are bilingual from one source", () => {
  it("letter copy: English keeps its promises, Hindi is Devanagari throughout", () => {
    assert.match(LETTER_COPY.en.coverTitle, /A letter about how I've been/);
    for (const s of [
      LETTER_COPY.hi.coverEyebrow, LETTER_COPY.hi.coverTitle, LETTER_COPY.hi.nothingUnticked,
      LETTER_COPY.hi.closing, LETTER_COPY.hi.sections.days, LETTER_COPY.hi.sections.patterns,
    ]) {
      assert.ok(hasDevanagari(s), `letter hi not Devanagari: ${s}`);
    }
    // brand stays Latin inside the Hindi closing
    assert.ok(LETTER_COPY.hi.closing.includes("My Quiet Space"));
  });

  it("archive copy: English keeps its title, Hindi is Devanagari, brand stays Latin", () => {
    assert.equal(ARCHIVE_COPY.en.title, "My Quiet Space");
    assert.equal(ARCHIVE_COPY.hi.title, "My Quiet Space");
    for (const s of [
      ARCHIVE_COPY.hi.coverEyebrow, ARCHIVE_COPY.hi.lettersTitle, ARCHIVE_COPY.hi.checkinsTitle,
      ARCHIVE_COPY.hi.grouped, ARCHIVE_COPY.hi.noLetters, ARCHIVE_COPY.hi.noCheckins,
    ]) {
      assert.ok(hasDevanagari(s), `archive hi not Devanagari: ${s}`);
    }
    // the footer keeps the Latin brand after the Hindi word
    assert.ok(ARCHIVE_COPY.hi.footer.includes("My Quiet Space"));
    assert.ok(hasDevanagari(ARCHIVE_COPY.hi.footer));
  });
});
