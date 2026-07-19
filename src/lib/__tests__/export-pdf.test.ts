import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPrivateArchivePdf } from "../export-pdf.ts";

const base = {
  display_name: "Neeraj",
  exported_at: "2026-07-18T10:00:00Z",
  letters: [
    {
      week_start: "2026-07-06",
      tone: "gentle",
      ritual: "One slow cup of chai before the phone.",
      body: "This week held more than it looked like it did.",
      check_in_echo: null,
      generated_at: "2026-07-12T10:00:00Z",
      kept: true,
    },
  ],
  check_ins: [
    {
      created_at: "2026-07-10T10:00:00Z",
      mood_score: 6,
      emotion_tags: ["Calm"],
      trigger_tags: ["Sleep"],
      note: "Slept a little better.",
    },
  ],
};

const pdfBytes = async (archive: typeof base) =>
  Buffer.from(await buildPrivateArchivePdf(archive).arrayBuffer());

describe("private archive PDF", () => {
  it("produces a real PDF", async () => {
    const buf = await pdfBytes(base);
    assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
  });

  it("leaves the Devanagari font out of English-only archives", async () => {
    const buf = await pdfBytes(base);
    assert.equal(buf.includes("NotoDevanagari"), false);
  });

  it("embeds the Devanagari font for a Hindi check-in note", async () => {
    const hindi = {
      ...base,
      check_ins: [{ ...base.check_ins[0], note: "आज नींद थोड़ी बेहतर थी।" }],
    };
    const buf = await pdfBytes(hindi);
    assert.equal(buf.includes("NotoDevanagari"), true);
  });

  it("embeds the Devanagari font for a Hinglish letter body", async () => {
    const hindi = {
      ...base,
      letters: [{ ...base.letters[0], body: "इस हफ़्ते तुमने जितना सोचा उससे ज़्यादा सँभाला।" }],
    };
    const buf = await pdfBytes(hindi);
    assert.equal(buf.includes("NotoDevanagari"), true);
  });

  it("survives an empty archive", async () => {
    const buf = await pdfBytes({ ...base, letters: [], check_ins: [] });
    assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
  });

  it("embeds the Devanagari font for a Hindi-language archive even with English content", async () => {
    // lang === "hi" makes the fixed chrome (titles, labels) Devanagari, so the
    // font must embed regardless of the user's own content.
    const buf = Buffer.from(await buildPrivateArchivePdf(base, {}, "hi").arrayBuffer());
    assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
    assert.equal(buf.includes("NotoDevanagari"), true);
  });

  it("still leaves the font out of an English-language English archive", async () => {
    const buf = Buffer.from(await buildPrivateArchivePdf(base, {}, "en").arrayBuffer());
    assert.equal(buf.includes("NotoDevanagari"), false);
  });
});
