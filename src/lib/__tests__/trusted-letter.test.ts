import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildTrustedLetterPdf,
  letterHasDevanagari,
  letterCopy,
  LETTER_COVER_EYEBROW,
  LETTER_COVER_TITLE,
  LETTER_NOTHING_UNTICKED,
  LETTER_CLOSING,
  type TrustedLetterInput,
} from "../trusted-letter.ts";

const hasDevanagari = (s: string) => /[ऀ-ॿ]/.test(s);

const base: TrustedLetterInput = {
  preparedBy: "Neeraj",
  forName: "Dr. Mehta",
  windowLabel: "the last two weeks",
  personalNote: "Doing okay, mostly. Sleep is still hard.",
  moodOverview: {
    count: 5,
    avg: 6.4,
    topEmotions: [["Anxious", 3], ["Calm", 2]],
    topTriggers: [["Exams", 2]],
  },
  patterns: [{ label: "Overwhelmed", count: 3 }],
  journalEntries: [
    {
      created_at: "2026-07-10T10:00:00Z",
      title: "A hard day",
      body: "College was a lot today. The evening walk helped.",
    },
  ],
};

const hindi: TrustedLetterInput = {
  ...base,
  preparedBy: "नीरज",
  personalNote: "मैं पिछले कुछ हफ़्तों से बेहतर महसूस कर रहा हूँ।",
  patterns: [{ label: "सब बहुत ज़्यादा", count: 3 }],
  journalEntries: [
    ...base.journalEntries,
    {
      created_at: "2026-07-14T10:00:00Z",
      title: "एक मुश्किल दिन",
      body: "आज कॉलेज में बहुत दबाव था।",
    },
  ],
};

const pdfBytes = async (input: TrustedLetterInput) =>
  Buffer.from(await buildTrustedLetterPdf(input).arrayBuffer());

describe("letterHasDevanagari", () => {
  it("is false for an English-only letter", () => {
    assert.equal(letterHasDevanagari(base), false);
  });

  it("sees Devanagari in the personal note", () => {
    assert.equal(letterHasDevanagari({ ...base, personalNote: "नींद मुश्किल है" }), true);
  });

  it("sees Devanagari in a journal body", () => {
    assert.equal(
      letterHasDevanagari({
        ...base,
        journalEntries: [{ created_at: "2026-07-10T10:00:00Z", title: null, body: "आज का दिन" }],
      }),
      true,
    );
  });

  it("sees Devanagari in a pattern label", () => {
    assert.equal(
      letterHasDevanagari({ ...base, patterns: [{ label: "सब बहुत ज़्यादा", count: 2 }] }),
      true,
    );
  });

  it("sees Devanagari in the recipient's name", () => {
    assert.equal(letterHasDevanagari({ ...base, forName: "माँ" }), true);
  });

  it("sees Devanagari in the signature", () => {
    assert.equal(letterHasDevanagari({ ...base, preparedBy: "नीरज" }), true);
  });

  it("sees Devanagari in a mood-overview label", () => {
    assert.equal(
      letterHasDevanagari({
        ...base,
        moodOverview: { count: 1, avg: null, topEmotions: [["उदास", 1]], topTriggers: [] },
      }),
      true,
    );
  });
});

describe("buildTrustedLetterPdf", () => {
  it("produces a real PDF", async () => {
    const buf = await pdfBytes(base);
    assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
  });

  it("leaves the Devanagari font out of English-only letters", async () => {
    const buf = await pdfBytes(base);
    assert.equal(buf.includes("NotoDevanagari"), false);
  });

  it("embeds the Devanagari font when the letter needs it", async () => {
    const buf = await pdfBytes(hindi);
    assert.equal(buf.includes("NotoDevanagari"), true);
  });

  it("embeds the Devanagari font for a Hindi-language letter even with English content", async () => {
    // lang === "hi" makes the fixed chrome Devanagari, so the font must embed
    // regardless of the user's own content.
    const buf = Buffer.from(await buildTrustedLetterPdf(base, "hi").arrayBuffer());
    assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
    assert.equal(buf.includes("NotoDevanagari"), true);
  });

  it("still leaves the font out of an English-language English letter", async () => {
    const buf = Buffer.from(await buildTrustedLetterPdf(base, "en").arrayBuffer());
    assert.equal(buf.includes("NotoDevanagari"), false);
  });

  it("builds a letter that is only a personal note", async () => {
    const buf = await pdfBytes({
      ...base,
      moodOverview: null,
      patterns: null,
      journalEntries: [],
    });
    assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
  });

  it("survives a missing display name", async () => {
    const buf = await pdfBytes({ ...base, preparedBy: null });
    assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
  });
});

describe("the fair copy stays the same letter", () => {
  const sheet = readFileSync("src/components/FairCopySheet.tsx", "utf-8");
  const route = readFileSync("src/routes/_app.trusted-letter.tsx", "utf-8");
  const css = readFileSync("src/styles.css", "utf-8");

  it("both renderings draw their fixed copy from the one shared source", () => {
    // The fair copy and the PDF both build their fixed strings from
    // letterCopy(lang) — the single source that keeps the two from drifting.
    assert.ok(sheet.includes("letterCopy"), "fair copy must read letterCopy(lang)");
    // the English copy keeps its promises
    const en = letterCopy("en");
    assert.match(en.coverEyebrow, /Shared by choice/);
    assert.match(en.coverTitle, /A letter about how I've been/);
    assert.match(en.nothingUnticked, /nothing unticked/);
    assert.match(en.closing, /keeps no copy/);
    // the back-compat aliases still resolve to the English copy
    assert.equal(LETTER_COVER_EYEBROW, en.coverEyebrow);
    assert.equal(LETTER_COVER_TITLE, en.coverTitle);
    assert.equal(LETTER_NOTHING_UNTICKED, en.nothingUnticked);
    assert.equal(LETTER_CLOSING, en.closing);
  });

  it("the Hindi copy is real Devanagari across every fixed field", () => {
    const hi = letterCopy("hi");
    for (const s of [hi.coverEyebrow, hi.coverTitle, hi.nothingUnticked, hi.closing,
      hi.sections.ownWords, hi.sections.days, hi.sections.patterns, hi.sections.pages,
      hi.disclaimers.moods, hi.disclaimers.patterns]) {
      assert.ok(hasDevanagari(s), `expected Hindi in: ${s}`);
    }
    // the templated lines translate too
    assert.ok(hasDevanagari(hi.forLine("Dr. Mehta")));
    assert.ok(hasDevanagari(hi.moodCount(5, 6.4)));
    assert.ok(hasDevanagari(hi.insideLine([hi.bits.days])));
    // brand stays Latin, names pass through untouched
    assert.ok(hi.closing.includes("My Quiet Space"));
  });

  it("printing the fair copy cannot blank other pages of the app", () => {
    assert.ok(sheet.includes("fair-copy-printing"), "sheet must set the body guard class");
    assert.ok(css.includes("body.fair-copy-printing > *:not(.fair-copy-sheet)"), "print hiding must be guarded by the body class");
  });

  it("preserves the personal note's line breaks, as the PDF does", () => {
    // jsPDF's splitTextToSize keeps newlines; the fair copy must match with
    // pre-wrap, or the letter's most personal section drifts between renderings.
    assert.match(css, /\.fc-own-words\s*\{[^}]*white-space:\s*pre-wrap/, "personal note needs pre-wrap");
    assert.match(css, /\.fc-body\s*\{[^}]*white-space:\s*pre-wrap/, "journal bodies need pre-wrap");
  });

  it("the route composes one input for both renderings", () => {
    assert.ok(route.includes("composeInput"), "shared composition must exist");
    assert.ok(route.includes("buildTrustedLetterPdf(composeInput(), lang)"), "download must use it, in the reader's language");
    assert.ok(route.includes("setPrintInput(composeInput())"), "print must use it");
    assert.ok(route.includes("afterprint"), "the sheet must unmount after the dialog");
  });
});
