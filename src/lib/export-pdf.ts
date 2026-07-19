import { jsPDF } from "jspdf";
import type { Lang } from "./i18n";
import { anyDevanagari, devanagariFontFor } from "./pdf-devanagari.ts";

type Letter = {
  week_start: string;
  tone: string | null;
  ritual: string | null;
  body: string | null;
  check_in_echo: string | null;
  generated_at: string | null;
  kept: boolean | null;
};

type CheckIn = {
  created_at: string;
  mood_score: number | null;
  emotion_tags: string[] | null;
  trigger_tags: string[] | null;
  note: string | null;
};

type Archive = {
  display_name: string | null;
  letters: Letter[];
  check_ins: CheckIn[];
  exported_at: string;
};

const MARGIN = 56; // pt
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - MARGIN * 2;

function formatDate(iso: string | null, lang: Lang = "en") {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === "hi" ? "hi-IN" : undefined, { year: "numeric", month: "long", day: "numeric" });
}

/* The private-archive chrome, in the app's own voice (second person, gender-
 * neutral respectful आप). The brand "My Quiet Space" stays Latin; user and
 * AI content (letter bodies, notes, tags, tone) is printed as-is. Same source
 * for every fixed phrase, so an EN and HI archive stay structurally identical. */
type ArchiveCopy = {
  coverEyebrow: string;
  title: string;
  keptFor: (name: string) => string;
  exported: (date: string) => string;
  counts: (letters: number, checkIns: number) => string;
  noteFromLast: (date: string) => string;
  snapshotFromLast: (date: string) => string;
  mood: (score: number) => string;
  lettersTitle: string;
  noLetters: string;
  weekOf: (date: string) => string;
  writtenOn: (date: string) => string;
  ritual: (text: string) => string;
  checkinsTitle: string;
  grouped: string;
  noCheckins: string;
  weekSummary: (count: number, avg: string | null, feelings: string | null) => string;
  footer: string;
};

export const ARCHIVE_COPY: Record<Lang, ArchiveCopy> = {
  en: {
    coverEyebrow: "Private archive — for you alone",
    title: "My Quiet Space",
    keptFor: (name) => `Kept for ${name}`,
    exported: (date) => `Exported ${date}`,
    counts: (l, c) => `${l} letter${l === 1 ? "" : "s"} · ${c} check-in${c === 1 ? "" : "s"}`,
    noteFromLast: (date) => `A note from your last check-in${date ? ` (${date})` : ""}:`,
    snapshotFromLast: (date) => `A snapshot from your last check-in${date ? ` (${date})` : ""}:`,
    mood: (score) => `Mood: ${score}/10`,
    lettersTitle: "Sunday Letters",
    noLetters: "No letters yet.",
    weekOf: (date) => `Week of ${date}`,
    writtenOn: (date) => `written ${date}`,
    ritual: (text) => `Ritual: ${text}`,
    checkinsTitle: "Check-in Summaries",
    grouped: "Grouped by week, most recent first.",
    noCheckins: "No check-ins yet.",
    weekSummary: (count, avg, feelings) =>
      [
        `${count} check-in${count === 1 ? "" : "s"}`,
        avg !== null ? `average mood ${avg}/10` : null,
        feelings ? `feelings: ${feelings}` : null,
      ].filter(Boolean).join(" · "),
    footer: "Private — My Quiet Space",
  },
  hi: {
    coverEyebrow: "निजी संग्रह — सिर्फ़ आपके लिए",
    title: "My Quiet Space",
    keptFor: (name) => `${name} के लिए रखा गया`,
    exported: (date) => `${date} को एक्सपोर्ट किया गया`,
    counts: (l, c) => `${l} ख़त · ${c} चेक-इन`,
    noteFromLast: (date) => `आपके पिछले चेक-इन से एक बात${date ? ` (${date})` : ""}:`,
    snapshotFromLast: (date) => `आपके पिछले चेक-इन की एक झलक${date ? ` (${date})` : ""}:`,
    mood: (score) => `मूड: ${score}/10`,
    lettersTitle: "इतवार के ख़त",
    noLetters: "अभी कोई ख़त नहीं।",
    weekOf: (date) => `${date} का हफ़्ता`,
    writtenOn: (date) => `${date} को लिखा गया`,
    ritual: (text) => `रस्म: ${text}`,
    checkinsTitle: "चेक-इन का सार",
    grouped: "हफ़्ते के हिसाब से, सबसे नया पहले।",
    noCheckins: "अभी कोई चेक-इन नहीं।",
    weekSummary: (count, avg, feelings) =>
      [
        `${count} चेक-इन`,
        avg !== null ? `औसत मूड ${avg}/10` : null,
        feelings ? `भावनाएँ: ${feelings}` : null,
      ].filter(Boolean).join(" · "),
    footer: "निजी — My Quiet Space",
  },
};

function archiveCopy(lang: Lang = "en"): ArchiveCopy {
  return ARCHIVE_COPY[lang] ?? ARCHIVE_COPY.en;
}

function bucketCheckIns(items: CheckIn[]) {
  const byWeek = new Map<string, CheckIn[]>();
  for (const c of items) {
    const d = new Date(c.created_at);
    if (Number.isNaN(d.getTime())) continue;
    // ISO week start (Monday)
    const day = (d.getUTCDay() + 6) % 7;
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
    const key = monday.toISOString().slice(0, 10);
    if (!byWeek.has(key)) byWeek.set(key, []);
    byWeek.get(key)!.push(c);
  }
  return Array.from(byWeek.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

export type CoverOptions = {
  includeTagline?: boolean;
  tagline?: string;
  includeDateRange?: boolean;
  includeLastReflection?: boolean;
  includeLastMoodCheckin?: boolean;
};

function computeDateRange(archive: Archive, lang: Lang = "en"): string | null {
  const dates: number[] = [];
  for (const l of archive.letters) {
    const t = l.week_start ? new Date(l.week_start).getTime() : NaN;
    if (!Number.isNaN(t)) dates.push(t);
  }
  for (const c of archive.check_ins) {
    const t = c.created_at ? new Date(c.created_at).getTime() : NaN;
    if (!Number.isNaN(t)) dates.push(t);
  }
  if (!dates.length) return null;
  const min = new Date(Math.min(...dates));
  const max = new Date(Math.max(...dates));
  return `${formatDate(min.toISOString(), lang)} \u2014 ${formatDate(max.toISOString(), lang)}`;
}

export function buildPrivateArchivePdf(archive: Archive, cover: CoverOptions = {}, lang: Lang = "en"): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = MARGIN;
  const A = archiveCopy(lang);

  // Hindi check-in notes, Hinglish letters, a Devanagari name or tagline —
  // all legible now (with the same shaping caveat the letter page discloses).
  const fontFor = devanagariFontFor(
    doc,
    // Hindi chrome (lang === "hi") needs the font even for an English archive,
    // otherwise the section titles print as tofu.
    lang === "hi" || anyDevanagari([
      archive.display_name, cover.tagline,
      ...archive.letters.flatMap((l) => [l.body, l.ritual, l.check_in_echo, l.tone]),
      ...archive.check_ins.flatMap((c) => [c.note, ...(c.emotion_tags ?? []), ...(c.trigger_tags ?? [])]),
    ]),
  );

  const ensureSpace = (need: number) => {
    if (y + need > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const writeBlock = (text: string, opts: { size?: number; font?: "normal" | "italic" | "bold"; color?: [number, number, number]; gap?: number } = {}) => {
    const size = opts.size ?? 11;
    fontFor(text, opts.font ?? "normal");
    doc.setFontSize(size);
    doc.setTextColor(...(opts.color ?? [40, 40, 50] as [number, number, number]));
    const lines = doc.splitTextToSize(text, CONTENT_W) as string[];
    const lineH = size * 1.35;
    for (const line of lines) {
      ensureSpace(lineH);
      doc.text(line, MARGIN, y);
      y += lineH;
    }
    y += opts.gap ?? 6;
  };

  // Cover
  doc.setFont("times", "italic");
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 130);
  doc.text(A.coverEyebrow, MARGIN, y);
  y += 28;

  doc.setFont("times", "bold");
  doc.setFontSize(28);
  doc.setTextColor(30, 30, 40);
  doc.text(A.title, MARGIN, y);
  y += 28;

  if (archive.display_name) {
    writeBlock(A.keptFor(archive.display_name), { size: 12, font: "italic", color: [90, 90, 100], gap: 4 });
  }
  writeBlock(A.exported(formatDate(archive.exported_at, lang)), { size: 10, color: [120, 120, 130], gap: 18 });
  writeBlock(A.counts(archive.letters.length, archive.check_ins.length), { size: 10, color: [120, 120, 130], gap: 30 });

  if (cover.includeDateRange) {
    const range = computeDateRange(archive, lang);
    if (range) {
      writeBlock(range, { size: 11, font: "italic", color: [100, 100, 115], gap: 12 });
    }
  }

  if (cover.includeTagline && cover.tagline && cover.tagline.trim()) {
    writeBlock(`\u201c${cover.tagline.trim()}\u201d`, { size: 12, font: "italic", color: [90, 90, 110], gap: 18 });
  }

  if (cover.includeLastReflection) {
    const last = archive.check_ins.find((c) => c.note && c.note.trim());
    if (last) {
      const date = formatDate(last.created_at, lang);
      writeBlock(A.noteFromLast(date), { size: 10, font: "italic", color: [100, 100, 115], gap: 4 });
      writeBlock(last.note!.trim(), { size: 11, font: "italic", color: [60, 60, 75], gap: 18 });
    }
  }

  if (cover.includeLastMoodCheckin) {
    const last = archive.check_ins
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    if (last && (typeof last.mood_score === "number" || (last.emotion_tags && last.emotion_tags.length))) {
      const date = formatDate(last.created_at, lang);
      const score = typeof last.mood_score === "number" ? A.mood(last.mood_score) : "";
      const tags = (last.emotion_tags ?? []).join(", ");
      const line = [score, tags].filter(Boolean).join(" · ");
      writeBlock(A.snapshotFromLast(date), { size: 10, font: "italic", color: [100, 100, 115], gap: 4 });
      writeBlock(line, { size: 11, font: "italic", color: [60, 60, 75], gap: 18 });
    }
  }

  // Letters
  doc.addPage();
  y = MARGIN;
  doc.setFont("times", "bold");
  doc.setFontSize(20);
  doc.setTextColor(30, 30, 40);
  doc.text(A.lettersTitle, MARGIN, y);
  y += 24;

  if (archive.letters.length === 0) {
    writeBlock(A.noLetters, { font: "italic", color: [120, 120, 130] });
  }

  for (const letter of archive.letters) {
    ensureSpace(60);
    writeBlock(A.weekOf(formatDate(letter.week_start, lang)), { size: 14, font: "bold", color: [30, 30, 40], gap: 2 });
    const meta: string[] = [];
    if (letter.tone) meta.push(letter.tone);
    if (letter.generated_at) meta.push(A.writtenOn(formatDate(letter.generated_at, lang)));
    if (meta.length) writeBlock(meta.join(" \u00b7 "), { size: 9, font: "italic", color: [140, 140, 150], gap: 8 });
    if (letter.check_in_echo) {
      writeBlock(letter.check_in_echo, { size: 10, font: "italic", color: [110, 110, 130], gap: 10 });
    }
    if (letter.body) {
      const paras = letter.body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
      for (const p of paras) writeBlock(p, { size: 11, gap: 8 });
    }
    if (letter.ritual) {
      writeBlock(A.ritual(letter.ritual), { size: 10, font: "italic", color: [110, 110, 130], gap: 16 });
    }
    // divider
    ensureSpace(20);
    doc.setDrawColor(220, 220, 225);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 18;
  }

  // Check-in summaries (weekly)
  doc.addPage();
  y = MARGIN;
  doc.setFont("times", "bold");
  doc.setFontSize(20);
  doc.setTextColor(30, 30, 40);
  doc.text(A.checkinsTitle, MARGIN, y);
  y += 10;
  writeBlock(A.grouped, { size: 10, font: "italic", color: [140, 140, 150], gap: 18 });

  const weeks = bucketCheckIns(archive.check_ins);
  if (weeks.length === 0) {
    writeBlock(A.noCheckins, { font: "italic", color: [120, 120, 130] });
  }

  for (const [weekStart, items] of weeks) {
    ensureSpace(40);
    writeBlock(A.weekOf(formatDate(weekStart, lang)), { size: 13, font: "bold", color: [30, 30, 40], gap: 2 });
    const scores = items.map((i) => i.mood_score).filter((n): n is number => typeof n === "number");
    const avg = scores.length ? scores.reduce((s, n) => s + n, 0) / scores.length : null;
    const tagCounts: Record<string, number> = {};
    for (const c of items) for (const t of c.emotion_tags ?? []) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
    const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);
    const summary = A.weekSummary(items.length, avg !== null ? avg.toFixed(1) : null, topTags.length ? topTags.join(", ") : null);
    writeBlock(summary, { size: 10, color: [90, 90, 110], gap: 8 });
    for (const c of items) {
      const date = formatDate(c.created_at, lang);
      const score = typeof c.mood_score === "number" ? `${c.mood_score}/10` : "\u2014";
      const tags = (c.emotion_tags ?? []).join(", ");
      const head = `${date} \u00b7 ${score}${tags ? ` \u00b7 ${tags}` : ""}`;
      writeBlock(head, { size: 10, font: "italic", color: [120, 120, 135], gap: 2 });
      if (c.note) writeBlock(c.note, { size: 11, gap: 6 });
      else y += 2;
    }
    ensureSpace(20);
    doc.setDrawColor(220, 220, 225);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 16;
  }

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("times", "italic");
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 170);
    doc.text(A.footer, MARGIN, PAGE_H - 24);
    doc.text(`${i} / ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 24, { align: "right" });
  }

  return doc.output("blob");
}
