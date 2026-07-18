import { jsPDF } from "jspdf";
import { anyDevanagari, devanagariFontFor } from "./pdf-devanagari.ts";

/**
 * The letter you hand someone — a consent-first export a user composes for a
 * therapist or trusted person and DOWNLOADS THEMSELVES. Nothing is sent,
 * stored, or shared by the app; this module is a pure document builder.
 *
 * Hard rules, enforced by the type itself: only the slices the user ticked
 * can appear (everything is optional), and AI conversations / memories are
 * not representable here at all — there is no field for them.
 */

export type TrustedMoodOverview = {
  count: number;
  avg: number | null;
  topEmotions: [string, number][];
  topTriggers: [string, number][];
};

export type TrustedJournalEntry = {
  created_at: string;
  title: string | null;
  body: string;
};

export type TrustedLetterInput = {
  preparedBy: string | null;
  forName: string;
  windowLabel: string;
  personalNote: string;
  moodOverview: TrustedMoodOverview | null;
  patterns: { label: string; count: number }[] | null;
  journalEntries: TrustedJournalEntry[];
};

const MARGIN = 56;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - MARGIN * 2;

function formatDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso ?? "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

/* Copy shared verbatim between this PDF and the browser-typeset fair copy
 * (FairCopySheet) — one source, so the two renderings can never drift. */
export const LETTER_COVER_EYEBROW = "Shared by choice — prepared and handed over by its author";
export const LETTER_COVER_TITLE = "A letter about how I've been";
export const LETTER_NOTHING_UNTICKED =
  "Everything here was chosen piece by piece. Nothing else from the app is included — no private conversations, no memories, nothing unticked.";
export const LETTER_CLOSING =
  "This letter was prepared inside My Quiet Space by its author. The app keeps no copy of it and sends nothing on anyone's behalf. Sharing can stop at any time.";
export const LETTER_SECTIONS = {
  ownWords: "In my own words",
  days: "How my days have felt",
  patterns: "Patterns I've noticed",
  pages: "Pages I chose to share",
} as const;
export const LETTER_DISCLAIMERS = {
  moods: "These are self-reported moments, not a clinical measure.",
  patterns: "Observations from my own check-ins — things worth talking about, not verdicts.",
} as const;

/** Does any user-provided text in this letter contain Devanagari? Covers
 * every printed string — including the mood overview's emotion/trigger
 * labels, so the font is embedded even if those are the only Hindi. */
export function letterHasDevanagari(input: TrustedLetterInput): boolean {
  const m = input.moodOverview;
  return anyDevanagari([
    input.preparedBy, input.forName, input.personalNote,
    ...input.journalEntries.flatMap((e) => [e.title, e.body]),
    ...(input.patterns ?? []).map((p) => p.label),
    ...(m ? [...m.topEmotions, ...m.topTriggers].map(([label]) => label) : []),
  ]);
}

export function buildTrustedLetterPdf(input: TrustedLetterInput): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = MARGIN;

  const fontFor = devanagariFontFor(doc, letterHasDevanagari(input));

  const ensureSpace = (need: number) => {
    if (y + need > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const writeBlock = (
    text: string,
    opts: { size?: number; font?: "normal" | "italic" | "bold"; color?: [number, number, number]; gap?: number } = {},
  ) => {
    const size = opts.size ?? 11;
    fontFor(text, opts.font ?? "normal");
    doc.setFontSize(size);
    doc.setTextColor(...(opts.color ?? ([40, 40, 50] as [number, number, number])));
    const lines = doc.splitTextToSize(text, CONTENT_W) as string[];
    const lineH = size * 1.35;
    for (const line of lines) {
      ensureSpace(lineH);
      doc.text(line, MARGIN, y);
      y += lineH;
    }
    y += opts.gap ?? 6;
  };

  const heading = (text: string) => {
    ensureSpace(46);
    y += 10;
    doc.setFont("times", "bold");
    doc.setFontSize(16);
    doc.setTextColor(30, 30, 40);
    doc.text(text, MARGIN, y);
    y += 22;
  };

  /* ── Cover ── */
  doc.setFont("times", "italic");
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 130);
  doc.text(LETTER_COVER_EYEBROW, MARGIN, y);
  y += 28;

  doc.setFont("times", "bold");
  doc.setFontSize(26);
  doc.setTextColor(30, 30, 40);
  doc.text(LETTER_COVER_TITLE, MARGIN, y);
  y += 30;

  if (input.forName.trim()) {
    writeBlock(`For ${input.forName.trim()}`, { size: 13, font: "italic", color: [70, 70, 85], gap: 4 });
  }
  if (input.preparedBy) {
    writeBlock(`Prepared by ${input.preparedBy}`, { size: 11, font: "italic", color: [90, 90, 100], gap: 4 });
  }
  writeBlock(`${formatDate(new Date().toISOString())} · covering ${input.windowLabel}`, {
    size: 10, color: [120, 120, 130], gap: 16,
  });

  const contents: string[] = [];
  if (input.personalNote.trim()) contents.push("a note in my own words");
  if (input.moodOverview) contents.push("how my days have felt");
  if (input.patterns && input.patterns.length) contents.push("patterns I've noticed");
  if (input.journalEntries.length) {
    contents.push(`${input.journalEntries.length} journal page${input.journalEntries.length === 1 ? "" : "s"} I chose to share`);
  }
  writeBlock(`Inside: ${contents.join(" · ")}.`, { size: 11, color: [70, 70, 85], gap: 10 });
  writeBlock(LETTER_NOTHING_UNTICKED, { size: 10, font: "italic", color: [110, 110, 125], gap: 0 });

  /* ── A note in my own words ── */
  if (input.personalNote.trim()) {
    heading(LETTER_SECTIONS.ownWords);
    writeBlock(input.personalNote.trim(), { size: 12, font: "italic", color: [50, 50, 65], gap: 10 });
  }

  /* ── Mood overview ── */
  if (input.moodOverview) {
    const m = input.moodOverview;
    heading(LETTER_SECTIONS.days);
    writeBlock(
      `${m.count} check-in${m.count === 1 ? "" : "s"} in this period${m.avg != null ? ` · average mood ${m.avg.toFixed(1)} / 10` : ""}.`,
      { size: 11, gap: 6 },
    );
    if (m.topEmotions.length) {
      writeBlock(`Feelings I named most: ${m.topEmotions.map(([t, n]) => `${t} (${n}×)`).join(", ")}.`, { size: 11, gap: 4 });
    }
    if (m.topTriggers.length) {
      writeBlock(`What they tended to arrive with: ${m.topTriggers.map(([t, n]) => `${t} (${n}×)`).join(", ")}.`, { size: 11, gap: 6 });
    }
    writeBlock(LETTER_DISCLAIMERS.moods, { size: 9.5, font: "italic", color: [120, 120, 130], gap: 4 });
  }

  /* ── Patterns ── */
  if (input.patterns && input.patterns.length) {
    heading(LETTER_SECTIONS.patterns);
    for (const p of input.patterns) {
      writeBlock(`•  ${p.label} — appeared ${p.count} time${p.count === 1 ? "" : "s"}`, { size: 11, gap: 2 });
    }
    writeBlock(LETTER_DISCLAIMERS.patterns, { size: 9.5, font: "italic", color: [120, 120, 130], gap: 4 });
  }

  /* ── Chosen journal pages ── */
  if (input.journalEntries.length) {
    doc.addPage();
    y = MARGIN;
    doc.setFont("times", "bold");
    doc.setFontSize(18);
    doc.setTextColor(30, 30, 40);
    doc.text(LETTER_SECTIONS.pages, MARGIN, y);
    y += 26;
    for (const e of input.journalEntries) {
      ensureSpace(60);
      writeBlock(formatDate(e.created_at), { size: 9.5, font: "italic", color: [120, 120, 130], gap: 2 });
      if (e.title?.trim()) {
        writeBlock(e.title.trim(), { size: 13, font: "bold", color: [40, 40, 55], gap: 4 });
      }
      writeBlock(e.body.trim(), { size: 11, gap: 14 });
    }
  }

  /* ── Closing ── */
  ensureSpace(60);
  y += 8;
  writeBlock(LETTER_CLOSING, { size: 9.5, font: "italic", color: [120, 120, 130], gap: 0 });

  return doc.output("blob");
}
