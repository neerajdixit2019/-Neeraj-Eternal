import { jsPDF } from "jspdf";
import type { Lang } from "./i18n";
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

function formatDate(iso: string | null, lang: Lang = "en") {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso ?? "";
  return d.toLocaleDateString(lang === "hi" ? "hi-IN" : undefined, { year: "numeric", month: "long", day: "numeric" });
}

/* Copy shared verbatim between this PDF and the browser-typeset fair copy
 * (FairCopySheet) — ONE source, so the two renderings can never drift.
 *
 * The letter is written in the author's first-person voice ("my days", "I
 * chose"). The author's gender is unknown, so the Hindi never uses a verb or
 * adjective that agrees with the writer: it leans on noun-agreement ("मेरे दिन
 * कैसे बीते" — बीते agrees with दिन), ergative object-agreement ("मैंने जो पैटर्न
 * देखे" — देखे agrees with पैटर्न), and passive ("चुना गया"). Feature/brand
 * names (My Quiet Space, InnerMate) stay Latin. */
type LetterCopy = {
  coverEyebrow: string;
  coverTitle: string;
  nothingUnticked: string;
  closing: string;
  sections: { ownWords: string; days: string; patterns: string; pages: string };
  disclaimers: { moods: string; patterns: string };
  /** cover line: "For <name>" */
  forLine: (name: string) => string;
  /** cover line: "Prepared by <name>" */
  preparedByLine: (name: string) => string;
  /** cover line: "<date> · covering <window>" */
  metaLine: (date: string, windowLabel: string) => string;
  /** cover line: "Inside: <a · b · c>." */
  insideLine: (parts: string[]) => string;
  /** the opt-in slice names that fill the "Inside:" line */
  bits: { note: string; days: string; patterns: string; pages: (n: number) => string };
  /** mood section: count (+ optional average) */
  moodCount: (count: number, avg: number | null) => string;
  /** mood section: "Feelings I named most: …" */
  feelingsMost: (pairs: [string, number][]) => string;
  /** mood section: "What they tended to arrive with: …" */
  arrivedWith: (pairs: [string, number][]) => string;
  /** patterns section: one bullet */
  patternLine: (label: string, count: number) => string;
};

const tally = (pairs: [string, number][]) => pairs.map(([t, n]) => `${t} (${n}×)`).join(", ");

export const LETTER_COPY: Record<Lang, LetterCopy> = {
  en: {
    coverEyebrow: "Shared by choice — prepared and handed over by its author",
    coverTitle: "A letter about how I've been",
    nothingUnticked:
      "Everything here was chosen piece by piece. Nothing else from the app is included — no private conversations, no memories, nothing unticked.",
    closing:
      "This letter was prepared inside My Quiet Space by its author. The app keeps no copy of it and sends nothing on anyone's behalf. Sharing can stop at any time.",
    sections: {
      ownWords: "In my own words",
      days: "How my days have felt",
      patterns: "Patterns I've noticed",
      pages: "Pages I chose to share",
    },
    disclaimers: {
      moods: "These are self-reported moments, not a clinical measure.",
      patterns: "Observations from my own check-ins — things worth talking about, not verdicts.",
    },
    forLine: (name) => `For ${name}`,
    preparedByLine: (name) => `Prepared by ${name}`,
    metaLine: (date, windowLabel) => `${date} · covering ${windowLabel}`,
    insideLine: (parts) => `Inside: ${parts.join(" · ")}.`,
    bits: {
      note: "a note in my own words",
      days: "how my days have felt",
      patterns: "patterns I've noticed",
      pages: (n) => `${n} journal page${n === 1 ? "" : "s"} I chose to share`,
    },
    moodCount: (count, avg) =>
      `${count} check-in${count === 1 ? "" : "s"} in this period${avg != null ? ` · average mood ${avg.toFixed(1)} / 10` : ""}.`,
    feelingsMost: (pairs) => `Feelings I named most: ${tally(pairs)}.`,
    arrivedWith: (pairs) => `What they tended to arrive with: ${tally(pairs)}.`,
    patternLine: (label, count) => `•  ${label} — appeared ${count} time${count === 1 ? "" : "s"}`,
  },
  hi: {
    coverEyebrow: "अपनी मर्ज़ी से साझा — इसे लिखने वाले ने ख़ुद तैयार करके सौंपा",
    coverTitle: "मेरा हाल कैसा रहा, इस पर एक ख़त",
    nothingUnticked:
      "यहाँ सब कुछ एक-एक करके चुना गया। ऐप से और कुछ शामिल नहीं — न कोई निजी बातचीत, न यादें, न कुछ ऐसा जो चुना न गया हो।",
    closing:
      "यह ख़त My Quiet Space के भीतर इसके लिखने वाले ने तैयार किया। ऐप इसकी कोई नक़ल नहीं रखता और किसी की ओर से कुछ नहीं भेजता। साझा करना कभी भी रोका जा सकता है।",
    sections: {
      ownWords: "मेरे अपने शब्दों में",
      days: "मेरे दिन कैसे बीते",
      patterns: "मैंने जो पैटर्न देखे",
      pages: "जो पन्ने मैंने साझा करने के लिए चुने",
    },
    disclaimers: {
      moods: "ये ख़ुद बताए गए पल हैं, कोई नैदानिक माप नहीं।",
      patterns: "मेरे अपने चेक-इन से देखी गई बातें — बात करने लायक़, कोई फ़ैसला नहीं।",
    },
    forLine: (name) => `${name} के लिए`,
    preparedByLine: (name) => `${name} द्वारा तैयार`,
    metaLine: (date, windowLabel) => `${date} · ${windowLabel}`,
    insideLine: (parts) => `इसमें: ${parts.join(" · ")}।`,
    bits: {
      note: "मेरे अपने शब्दों में एक बात",
      days: "मेरे दिन कैसे बीते",
      patterns: "देखे गए कुछ पैटर्न",
      pages: (n) => `${n} जर्नल पन्ने जो मैंने साझा करने के लिए चुने`,
    },
    moodCount: (count, avg) =>
      `इस अवधि में ${count} चेक-इन${avg != null ? ` · औसत मूड ${avg.toFixed(1)} / 10` : ""}।`,
    feelingsMost: (pairs) => `सबसे ज़्यादा नाम दी गई भावनाएँ: ${tally(pairs)}।`,
    arrivedWith: (pairs) => `अक्सर इनके साथ जो रहा: ${tally(pairs)}।`,
    patternLine: (label, count) => `•  ${label} — ${count} बार`,
  },
};

export function letterCopy(lang: Lang = "en"): LetterCopy {
  return LETTER_COPY[lang] ?? LETTER_COPY.en;
}

/* English aliases kept so any other consumer — and the copy-promise pins —
 * still resolve. The bilingual source of truth is LETTER_COPY / letterCopy(). */
export const LETTER_COVER_EYEBROW = LETTER_COPY.en.coverEyebrow;
export const LETTER_COVER_TITLE = LETTER_COPY.en.coverTitle;
export const LETTER_NOTHING_UNTICKED = LETTER_COPY.en.nothingUnticked;
export const LETTER_CLOSING = LETTER_COPY.en.closing;
export const LETTER_SECTIONS = LETTER_COPY.en.sections;
export const LETTER_DISCLAIMERS = LETTER_COPY.en.disclaimers;

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

export function buildTrustedLetterPdf(input: TrustedLetterInput, lang: Lang = "en"): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = MARGIN;
  const C = letterCopy(lang);

  // Embed the Devanagari font whenever the letter carries Hindi — either in the
  // user's own content OR in the fixed chrome (lang === "hi"). Without the
  // second half, a Hindi-chrome letter with English content would print the
  // headings as tofu.
  const fontFor = devanagariFontFor(doc, lang === "hi" || letterHasDevanagari(input));

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
  doc.text(C.coverEyebrow, MARGIN, y);
  y += 28;

  doc.setFont("times", "bold");
  doc.setFontSize(26);
  doc.setTextColor(30, 30, 40);
  doc.text(C.coverTitle, MARGIN, y);
  y += 30;

  if (input.forName.trim()) {
    writeBlock(C.forLine(input.forName.trim()), { size: 13, font: "italic", color: [70, 70, 85], gap: 4 });
  }
  if (input.preparedBy) {
    writeBlock(C.preparedByLine(input.preparedBy), { size: 11, font: "italic", color: [90, 90, 100], gap: 4 });
  }
  writeBlock(C.metaLine(formatDate(new Date().toISOString(), lang), input.windowLabel), {
    size: 10, color: [120, 120, 130], gap: 16,
  });

  const contents: string[] = [];
  if (input.personalNote.trim()) contents.push(C.bits.note);
  if (input.moodOverview) contents.push(C.bits.days);
  if (input.patterns && input.patterns.length) contents.push(C.bits.patterns);
  if (input.journalEntries.length) contents.push(C.bits.pages(input.journalEntries.length));
  writeBlock(C.insideLine(contents), { size: 11, color: [70, 70, 85], gap: 10 });
  writeBlock(C.nothingUnticked, { size: 10, font: "italic", color: [110, 110, 125], gap: 0 });

  /* ── A note in my own words ── */
  if (input.personalNote.trim()) {
    heading(C.sections.ownWords);
    writeBlock(input.personalNote.trim(), { size: 12, font: "italic", color: [50, 50, 65], gap: 10 });
  }

  /* ── Mood overview ── */
  if (input.moodOverview) {
    const m = input.moodOverview;
    heading(C.sections.days);
    writeBlock(C.moodCount(m.count, m.avg), { size: 11, gap: 6 });
    if (m.topEmotions.length) {
      writeBlock(C.feelingsMost(m.topEmotions), { size: 11, gap: 4 });
    }
    if (m.topTriggers.length) {
      writeBlock(C.arrivedWith(m.topTriggers), { size: 11, gap: 6 });
    }
    writeBlock(C.disclaimers.moods, { size: 9.5, font: "italic", color: [120, 120, 130], gap: 4 });
  }

  /* ── Patterns ── */
  if (input.patterns && input.patterns.length) {
    heading(C.sections.patterns);
    for (const p of input.patterns) {
      writeBlock(C.patternLine(p.label, p.count), { size: 11, gap: 2 });
    }
    writeBlock(C.disclaimers.patterns, { size: 9.5, font: "italic", color: [120, 120, 130], gap: 4 });
  }

  /* ── Chosen journal pages ── */
  if (input.journalEntries.length) {
    doc.addPage();
    y = MARGIN;
    doc.setFont("times", "bold");
    doc.setFontSize(18);
    doc.setTextColor(30, 30, 40);
    doc.text(C.sections.pages, MARGIN, y);
    y += 26;
    for (const e of input.journalEntries) {
      ensureSpace(60);
      writeBlock(formatDate(e.created_at, lang), { size: 9.5, font: "italic", color: [120, 120, 130], gap: 2 });
      if (e.title?.trim()) {
        writeBlock(e.title.trim(), { size: 13, font: "bold", color: [40, 40, 55], gap: 4 });
      }
      writeBlock(e.body.trim(), { size: 11, gap: 14 });
    }
  }

  /* ── Closing ── */
  ensureSpace(60);
  y += 8;
  writeBlock(C.closing, { size: 9.5, font: "italic", color: [120, 120, 130], gap: 0 });

  return doc.output("blob");
}
