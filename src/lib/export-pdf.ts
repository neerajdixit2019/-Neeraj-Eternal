import { jsPDF } from "jspdf";

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

function formatDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
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

function computeDateRange(archive: Archive): string | null {
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
  return `${formatDate(min.toISOString())} \u2014 ${formatDate(max.toISOString())}`;
}

export function buildPrivateArchivePdf(archive: Archive, cover: CoverOptions = {}): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = MARGIN;

  const ensureSpace = (need: number) => {
    if (y + need > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const writeBlock = (text: string, opts: { size?: number; font?: "normal" | "italic" | "bold"; color?: [number, number, number]; gap?: number } = {}) => {
    const size = opts.size ?? 11;
    doc.setFont("times", opts.font ?? "normal");
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
  doc.text("Private archive \u2014 for you alone", MARGIN, y);
  y += 28;

  doc.setFont("times", "bold");
  doc.setFontSize(28);
  doc.setTextColor(30, 30, 40);
  doc.text("My Quiet Space", MARGIN, y);
  y += 28;

  if (archive.display_name) {
    writeBlock(`Kept for ${archive.display_name}`, { size: 12, font: "italic", color: [90, 90, 100], gap: 4 });
  }
  writeBlock(`Exported ${formatDate(archive.exported_at)}`, { size: 10, color: [120, 120, 130], gap: 18 });
  writeBlock(`${archive.letters.length} letter${archive.letters.length === 1 ? "" : "s"} \u00b7 ${archive.check_ins.length} check-in${archive.check_ins.length === 1 ? "" : "s"}`, { size: 10, color: [120, 120, 130], gap: 30 });

  if (cover.includeDateRange) {
    const range = computeDateRange(archive);
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
      const date = formatDate(last.created_at);
      writeBlock(`A note from your last check-in${date ? ` (${date})` : ""}:`, { size: 10, font: "italic", color: [100, 100, 115], gap: 4 });
      writeBlock(last.note!.trim(), { size: 11, font: "italic", color: [60, 60, 75], gap: 18 });
    }
  }

  if (cover.includeLastMoodCheckin) {
    const last = archive.check_ins
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    if (last && (typeof last.mood_score === "number" || (last.emotion_tags && last.emotion_tags.length))) {
      const date = formatDate(last.created_at);
      const score = typeof last.mood_score === "number" ? `Mood: ${last.mood_score}/10` : "";
      const tags = (last.emotion_tags ?? []).join(", ");
      const line = [score, tags].filter(Boolean).join(" · ");
      writeBlock(`A snapshot from your last check-in${date ? ` (${date})` : ""}:`, { size: 10, font: "italic", color: [100, 100, 115], gap: 4 });
      writeBlock(line, { size: 11, font: "italic", color: [60, 60, 75], gap: 18 });
    }
  }

  // Letters
  doc.addPage();
  y = MARGIN;
  doc.setFont("times", "bold");
  doc.setFontSize(20);
  doc.setTextColor(30, 30, 40);
  doc.text("Sunday Letters", MARGIN, y);
  y += 24;

  if (archive.letters.length === 0) {
    writeBlock("No letters yet.", { font: "italic", color: [120, 120, 130] });
  }

  for (const letter of archive.letters) {
    ensureSpace(60);
    writeBlock(`Week of ${formatDate(letter.week_start)}`, { size: 14, font: "bold", color: [30, 30, 40], gap: 2 });
    const meta: string[] = [];
    if (letter.tone) meta.push(letter.tone);
    if (letter.generated_at) meta.push(`written ${formatDate(letter.generated_at)}`);
    if (meta.length) writeBlock(meta.join(" \u00b7 "), { size: 9, font: "italic", color: [140, 140, 150], gap: 8 });
    if (letter.check_in_echo) {
      writeBlock(letter.check_in_echo, { size: 10, font: "italic", color: [110, 110, 130], gap: 10 });
    }
    if (letter.body) {
      const paras = letter.body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
      for (const p of paras) writeBlock(p, { size: 11, gap: 8 });
    }
    if (letter.ritual) {
      writeBlock(`Ritual: ${letter.ritual}`, { size: 10, font: "italic", color: [110, 110, 130], gap: 16 });
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
  doc.text("Check-in Summaries", MARGIN, y);
  y += 10;
  writeBlock("Grouped by week, most recent first.", { size: 10, font: "italic", color: [140, 140, 150], gap: 18 });

  const weeks = bucketCheckIns(archive.check_ins);
  if (weeks.length === 0) {
    writeBlock("No check-ins yet.", { font: "italic", color: [120, 120, 130] });
  }

  for (const [weekStart, items] of weeks) {
    ensureSpace(40);
    writeBlock(`Week of ${formatDate(weekStart)}`, { size: 13, font: "bold", color: [30, 30, 40], gap: 2 });
    const scores = items.map((i) => i.mood_score).filter((n): n is number => typeof n === "number");
    const avg = scores.length ? scores.reduce((s, n) => s + n, 0) / scores.length : null;
    const tagCounts: Record<string, number> = {};
    for (const c of items) for (const t of c.emotion_tags ?? []) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
    const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);
    const summary = [
      `${items.length} check-in${items.length === 1 ? "" : "s"}`,
      avg !== null ? `average mood ${avg.toFixed(1)}/10` : null,
      topTags.length ? `feelings: ${topTags.join(", ")}` : null,
    ].filter(Boolean).join(" \u00b7 ");
    writeBlock(summary, { size: 10, color: [90, 90, 110], gap: 8 });
    for (const c of items) {
      const date = formatDate(c.created_at);
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
    doc.text("Private \u2014 My Quiet Space", MARGIN, PAGE_H - 24);
    doc.text(`${i} / ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 24, { align: "right" });
  }

  return doc.output("blob");
}
