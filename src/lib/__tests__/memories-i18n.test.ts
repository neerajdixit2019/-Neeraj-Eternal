import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HI_TEXT } from "../i18n-strings.ts";

const src = readFileSync("src/routes/_app.memories.tsx", "utf-8");

function txLiterals(s: string): string[] {
  return [...s.matchAll(/tx\(lang,\s*"((?:[^"\\]|\\.)*)"\)/g)]
    .map((m) => m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
}

describe("memories: every tx() literal has Hindi", () => {
  it("all wrapped strings translate", () => {
    const found = txLiterals(src);
    assert.ok(found.length >= 60, `expected the memories chrome, found ${found.length}`);
    for (const k of found) assert.ok(HI_TEXT[k] !== undefined, `"${k}" wrapped but no Hindi`);
  });
});

describe("memories: the dynamic Photo/Video/Audio labels and feelings translate", () => {
  it("the media-kind labels rendered via tx(lang, label) have Hindi", () => {
    for (const k of ["Photo", "Video", "Audio"]) {
      assert.ok(HI_TEXT[k] !== undefined, `media label "${k}" has no Hindi`);
    }
  });
  it("every pickable feeling has a Hindi display label in FEELING_HI", () => {
    // The six feelings the picker offers must all be in the local FEELING_HI map.
    for (const f of ["warm", "bittersweet", "heavy", "grateful", "longing", "peaceful"]) {
      assert.match(src, new RegExp(`\\b${f}:\\s*"[^"]+"`), `FEELING_HI missing "${f}"`);
    }
  });
});

describe("memories: the loud strings a keeper reads are wrapped", () => {
  it("headline, the keep flow, the consent line, and the burn ritual translate", () => {
    for (const k of [
      "Your night sky",
      "hang a new star",
      "Hang this star",
      "Let InnerMate know about this memory",
      "If on, InnerMate may gently remember the story you wrote here. It never sees the photo, video, or audio itself, only your words about it.",
      "Burn a memory",
      "letting go is a true goodbye. the memory and whatever you kept with it leave your sky for good.",
    ]) {
      assert.ok(src.includes(`tx(lang, "${k.replace(/"/g, '\\"')}")`), `not wrapped: ${k}`);
      assert.ok(HI_TEXT[k] !== undefined, `no Hindi: ${k}`);
    }
  });
});

describe("memories: no bare English text node leaks past tx()", () => {
  // Intentional English lives ONLY inside `lang === "hi" ? … : …` branches — of
  // the JSX text nodes, only the step-0 "Say goodbye to " prefix is one.
  const ALLOW = new Set(["Say goodbye to"]);
  // A .tsx file's `>…<` also spans TS generics (useState<T>(x)) and comparisons,
  // so restrict to clean PROSE: letters + gentle punctuation, no code characters.
  const CODE = /[()[\]{}<>=;:|/$.`"\\_@#%^&*+~]/;
  it("no unwrapped English prose text node remains", () => {
    const leaks = [...src.matchAll(/>([^<>{}]+)</g)]
      .map((m) => m[1].replace(/\s+/g, " ").trim())
      .filter((t) => /[a-z]{2}/.test(t) && /^[\x20-\x7E]+$/.test(t) && !CODE.test(t))
      .filter((t) => /\s/.test(t)) // prose is multi-word; a lone token is a TS generic (Promise<T>)
      .filter((t) => !ALLOW.has(t));
    assert.deepEqual(leaks, [], `bare English text: ${leaks.join(" | ")}`);
  });
  it("no bare English placeholder/aria-label/title attribute remains", () => {
    const attrs = [...src.matchAll(/(?:placeholder|aria-label|title)="([A-Za-z][^"]*)"/g)].map((m) => m[1]);
    assert.deepEqual(attrs, [], `bare English attrs: ${attrs.join(" | ")}`);
  });
});

describe("memories: feeling VALUES stay English (display-only translation)", () => {
  it("the picker stores English feeling values, never Hindi", () => {
    // The DB tag, star math, and filters all key on the English value; only the
    // DISPLAY is translated (via feelingLabel). A Devanagari value would corrupt
    // the stored tag and break every filter.
    for (const v of ["warm", "bittersweet", "heavy", "grateful", "longing", "peaceful"]) {
      assert.match(src, new RegExp(`value:\\s*"${v}"`), `FEELINGS lost English value "${v}"`);
    }
    assert.ok(!/value:\s*"[^"]*[ऀ-ॿ]/.test(src), "a feeling value was translated into Devanagari");
    // the save path must persist the raw English feeling, not a label
    assert.match(src, /feeling_tag:\s*\(feeling\s*\|\|\s*null\)/, "save no longer stores the raw feeling value");
  });
});
