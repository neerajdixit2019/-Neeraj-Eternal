import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isReadingSize,
  scaleFor,
  READING_SCALE,
} from "../reading-prefs.ts";

describe("reading-prefs: the sizes", () => {
  it("accepts only the three known sizes", () => {
    for (const ok of ["cosy", "roomy", "large"]) assert.equal(isReadingSize(ok), true);
    for (const bad of ["", "huge", "COSY", null, "cosy "]) assert.equal(isReadingSize(bad), false);
  });

  it("cosy is the neutral 1.0 scale", () => {
    assert.equal(scaleFor("cosy"), 1);
  });

  it("larger sizes scale up monotonically", () => {
    assert.ok(scaleFor("cosy") < scaleFor("roomy"));
    assert.ok(scaleFor("roomy") < scaleFor("large"));
  });

  it("stays capped so the fixed measure never breaks", () => {
    for (const s of Object.values(READING_SCALE)) assert.ok(s <= 1.3, `scale ${s} exceeds cap`);
  });
});

describe("reading-prefs: applied only to prose, never the chrome", () => {
  const css = readFileSync("src/styles.css", "utf-8");

  it("defines the reading-text utility from the scale variable", () => {
    assert.match(css, /\.reading-text\s*\{[^}]*calc\(var\(--reading-px[^)]*\)\s*\*\s*var\(--reading-scale/);
  });

  it("the long-form surfaces opt in to scaling", () => {
    const journal = readFileSync("src/routes/_app.journal.tsx", "utf-8");
    const letter = readFileSync("src/routes/_app.letter.$id.tsx", "utf-8");
    const companion = readFileSync("src/routes/_app.companion.tsx", "utf-8");
    assert.ok(journal.includes("reading-text"), "journal body must scale");
    assert.ok(letter.includes("reading-text"), "letter body must scale");
    assert.ok(companion.includes("reading-text"), "InnerMate prose must scale");
  });
});

describe("the skip link", () => {
  const app = readFileSync("src/routes/_app.tsx", "utf-8");
  const css = readFileSync("src/styles.css", "utf-8");

  it("offers a skip-to-content link targeting the main landmark", () => {
    assert.ok(app.includes('href="#main-content"'), "skip link must point at main");
    assert.ok(app.includes('id="main-content"'), "main landmark must carry the id");
    assert.ok(app.includes("qs-skip-link"), "skip link must use its style");
  });

  it("the skip link is hidden until focus, then visible", () => {
    assert.match(css, /\.qs-skip-link\s*\{[^}]*translateY\(-1/, "skip link must sit off-screen by default");
    assert.match(css, /\.qs-skip-link:focus[^{]*\{[^}]*translateY\(0\)/, "focus must bring it on-screen");
  });
});

describe("accessibility hardening (audit fixes)", () => {
  const settings = readFileSync("src/routes/_app.settings.tsx", "utf-8");
  const root = readFileSync("src/routes/__root.tsx", "utf-8");
  const i18n = readFileSync("src/lib/i18n.ts", "utf-8");
  const reading = readFileSync("src/lib/reading-prefs.ts", "utf-8");

  it("every role=switch in settings carries an accessible name", () => {
    // pair each role="switch" with an aria-label within the same element
    const switches = settings.match(/role="switch"[\s\S]{0,160}?(?=onClick|onChange)/g) ?? [];
    assert.ok(switches.length >= 3, "expected the InnerMap + two Sunday-letter switches");
    for (const sw of switches) {
      assert.ok(/aria-label=/.test(sw), `a switch is missing aria-label: ${sw.slice(0, 60)}`);
    }
  });

  it("the document language follows the reader's choice", () => {
    assert.ok(i18n.includes("document.documentElement.lang"), "lang must be reflected onto <html>");
    assert.ok(root.includes("syncDocLang"), "root must reconcile lang on mount");
    assert.ok(root.includes("mqs-lang") && root.includes("d.lang"), "the pre-paint script must set lang");
  });

  it("non-default readers are set before first paint (no FOUC)", () => {
    assert.ok(root.includes("mqs-reading") && root.includes("--reading-scale"), "pre-paint script must set the scale");
  });

  it("cross-tab changes re-apply to the DOM, not just React", () => {
    assert.match(reading, /onStorage[\s\S]{0,120}applyReadingSize\(readSize\(\)\)/);
    assert.match(i18n, /onStorage[\s\S]{0,120}applyDocLang\(readLang\(\)\)/);
  });
});
