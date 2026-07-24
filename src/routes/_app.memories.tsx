import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TactileCard } from "@/components/TactileCard";
import { LampSkeletonList } from "@/components/LampSkeleton";
import { toast } from "sonner";
import { listMemories, saveMemory, setMemoryReadable, deleteMemory, updateMemory } from "@/lib/data.functions";
import { listKeptLetters } from "@/lib/letters.functions";
import { useLang, type Lang } from "@/lib/i18n";
import { tx } from "@/lib/i18n-strings";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Flame, Plus, Sparkles, Video, X, Image as ImageIcon, Music, Pencil, Search } from "lucide-react";

export const Route = createFileRoute("/_app/memories")({
  component: MemoriesPage,
  head: () => ({
    meta: [
      { title: "Memory Keeper | My Quiet Space" },
      { name: "description", content: "A quiet shelf for the moments you want to keep — photos, videos, and the stories behind them." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const FEELINGS = [
  { value: "warm", label: "warm", tint: "rose" },
  { value: "bittersweet", label: "bittersweet", tint: "lavender" },
  { value: "heavy", label: "heavy", tint: "sky" },
  { value: "grateful", label: "grateful", tint: "amber" },
  { value: "longing", label: "longing", tint: "lavender" },
  { value: "peaceful", label: "peaceful", tint: "mint" },
] as const;
type Feeling = typeof FEELINGS[number]["value"];

// Feeling VALUES stay English in storage (the DB, the star math, the filters);
// this map is display-only, so a Hindi reader sees the feeling in Hindi while
// the tag saved to their data is unchanged. Covers the six pickable feelings
// plus the close cousins the star tints already know.
const FEELING_HI: Record<string, string> = {
  warm: "गर्माहट", bittersweet: "खट्टा-मीठा", heavy: "भारी",
  grateful: "आभार", longing: "तड़प", peaceful: "सुकून",
  tender: "कोमल", joyful: "खुशी", hopeful: "उम्मीद", calm: "शांत",
};
function feelingLabel(feeling: string | null | undefined, lang: Lang): string {
  if (!feeling) return "";
  if (lang === "en") return feeling;
  return FEELING_HI[feeling] ?? feeling;
}

// Selected-chip tints from the study's own tokens — no raw palette classes.
const FEELING_CHIP_STYLE: Record<Feeling, React.CSSProperties> = {
  warm:        { background: "color-mix(in oklab, var(--rose) 26%, var(--card))",     color: "var(--foreground)", borderColor: "color-mix(in oklab, var(--rose) 45%, transparent)" },
  bittersweet: { background: "color-mix(in oklab, var(--lavender) 26%, var(--card))", color: "var(--foreground)", borderColor: "color-mix(in oklab, var(--lavender) 45%, transparent)" },
  heavy:       { background: "color-mix(in oklab, var(--sky) 26%, var(--card))",      color: "var(--foreground)", borderColor: "color-mix(in oklab, var(--sky) 45%, transparent)" },
  grateful:    { background: "color-mix(in oklab, var(--amber) 26%, var(--card))",    color: "var(--foreground)", borderColor: "color-mix(in oklab, var(--amber) 45%, transparent)" },
  longing:     { background: "color-mix(in oklab, var(--lavender) 22%, var(--card))", color: "var(--foreground)", borderColor: "color-mix(in oklab, var(--lavender) 40%, transparent)" },
  peaceful:    { background: "color-mix(in oklab, var(--mint) 26%, var(--card))",     color: "var(--foreground)", borderColor: "color-mix(in oklab, var(--mint) 45%, transparent)" },
};

const MAX_BYTES = 50 * 1024 * 1024;

type MemoryRow = {
  id: string;
  title: string | null;
  story: string | null;
  feeling_tag: string | null;
  memory_date: string | null;
  media_path: string | null;
  media_type: string | null;
  is_ai_readable: boolean;
  created_at: string;
  media_url?: string | null;
};

/* ── The sky: deterministic star math (SSR must equal client) ─────────── */

// Feeling → star tint. Covers this app's feelings plus a few close cousins.
const STAR_TINT: Record<string, string> = {
  tender: "var(--rose)",
  warm: "var(--amber)",
  joyful: "var(--amber)",
  hopeful: "var(--sky)",
  heavy: "var(--sky)",
  bittersweet: "var(--lavender)",
  longing: "var(--lavender)",
  calm: "var(--mint)",
  peaceful: "var(--mint)",
  grateful: "var(--dawn)",
};
function tintFor(feeling: string | null | undefined): string {
  return (feeling && STAR_TINT[feeling]) || "var(--dawn)";
}

// How brightly each feeling burns (base px, jittered ±1, clamped 8–14).
const STAR_BASE_SIZE: Record<string, number> = {
  grateful: 13,
  warm: 12.5,
  peaceful: 11.5,
  bittersweet: 10.5,
  longing: 10,
  heavy: 9,
};

// The brightest feelings earn diffraction spikes — the ones that matter most
// literally shine brightest. Size threshold keeps spikes for the big stars only.
const BRIGHT_FEELINGS = new Set(["grateful", "warm", "peaceful"]);

// FNV-1a — stable hash of a memory id, same on server and client.
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type SkyStar = {
  memory: MemoryRow;
  hash: number;
  x: number;      // 8–92 (%)
  y: number;      // 10–72 (%)
  size: number;   // 8–14 (px)
  dur: number;    // twinkle 2.8–5.5s
  delay: number;  // 0–4.3s
  tint: string;
};

function starFor(memory: MemoryRow): SkyStar {
  const h = hashStr(memory.id);
  const x = Math.round((8 + ((h % 8401) / 8400) * 84) * 100) / 100;
  const y = Math.round((10 + (((h >>> 9) % 6301) / 6300) * 62) * 100) / 100;
  const base = STAR_BASE_SIZE[memory.feeling_tag ?? ""] ?? 9.5;
  const size = Math.min(14, Math.max(8, base + (((h >>> 16) % 21) - 10) / 10));
  const dur = Math.round((2.8 + ((h >>> 5) % 271) / 100) * 100) / 100;
  const delay = Math.round((((h >>> 13) % 431) / 100) * 100) / 100;
  return { memory, hash: h, x, y, size, dur, delay, tint: tintFor(memory.feeling_tag) };
}

// Fixed seed so the ambient sky is identical on every render, everywhere.
const SKY_SEED = 20260607;
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type BgStar = { left: number; top: number; size: number; opacity: number; twinkle: boolean; dur: number; delay: number };
const BG_STARS: BgStar[] = (() => {
  const rnd = mulberry32(SKY_SEED);
  return Array.from({ length: 110 }, (_, i) => ({
    left: Math.round(rnd() * 10000) / 100,
    top: Math.round(rnd() * 8600) / 100,
    size: Math.round((1 + rnd() * 1.3) * 100) / 100,
    opacity: Math.round((0.12 + rnd() * 0.48) * 100) / 100,
    twinkle: i % 6 === 0, // budget-Android: ~18 animating, the rest hold still
    dur: Math.round((2.6 + rnd() * 3.4) * 100) / 100,
    delay: Math.round(rnd() * 600) / 100,
  }));
})();

const FIREFLIES = [
  { left: "16%", top: "84%", delay: "0s" },
  { left: "57%", top: "88%", delay: "3.4s" },
  { left: "81%", top: "82%", delay: "7.1s" },
] as const;

function memoryDateLabel(m: MemoryRow, lang: Lang) {
  return m.memory_date
    ? new Date(m.memory_date).toLocaleDateString(lang === "hi" ? "hi-IN" : undefined, { month: "long", day: "numeric", year: "numeric" })
    : tx(lang, "undated");
}

/* ── Page ─────────────────────────────────────────────────────────────── */

function MemoriesPage() {
  const lang = useLang();
  const qc = useQueryClient();
  const listFn = useServerFn(listMemories);
  const { data: memories, isLoading } = useQuery({
    queryKey: ["memories"],
    queryFn: () => listFn() as Promise<MemoryRow[]>,
  });
  const [tab, setTab] = useState<"memories" | "letters">("memories");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeFeeling, setActiveFeeling] = useState<string | null>(null);
  const [reliveId, setReliveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const stars = useMemo(() => (memories ?? []).map(starFor), [memories]);
  const constellations = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of memories ?? []) {
      if (m.feeling_tag) counts.set(m.feeling_tag, (counts.get(m.feeling_tag) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [memories]);
  // The feeling that colours the sky most — a quiet line of self-knowledge.
  // Only when it genuinely leads (2+ and a clear margin over the runner-up).
  const dominantFeeling =
    constellations[0] && constellations[0][1] > 1 && constellations[0][1] > (constellations[1]?.[1] ?? 0)
      ? constellations[0][0]
      : null;

  // Wander: step into a memory the sky chooses. Serendipity, not search.
  const wander = () => {
    const pool = memories ?? [];
    if (pool.length === 0) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setReliveId(pick.id);
  };
  const activeStars = useMemo(
    () => (activeFeeling
      ? stars.filter((s) => (s.memory.feeling_tag ?? "") === activeFeeling).sort((a, b) => a.hash - b.hash)
      : []),
    [stars, activeFeeling],
  );
  const activeTint = tintFor(activeFeeling);

  const selectedStar = stars.find((s) => s.memory.id === selectedId) ?? null;
  const reliveMemory = (memories ?? []).find((m) => m.id === reliveId) ?? null;

  const n = memories?.length;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["memories"] });

  // One diff over the rows powers both ends of a star's life: first light
  // when a memory is kept, an ember sinking out when one is let go.
  const prevRowsRef = useRef<Map<string, MemoryRow> | null>(null);
  const [newbornId, setNewbornId] = useState<string | null>(null);
  const [ghostStar, setGhostStar] = useState<{ x: number; y: number; size: number; tint: string } | null>(null);
  useEffect(() => {
    if (!memories) return;
    const prev = prevRowsRef.current;
    const next = new Map(memories.map((m) => [m.id, m] as const));
    prevRowsRef.current = next;
    if (prev === null) return; // first load / hydration — nothing arrives or leaves
    const reduced =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.body.classList.contains("motion-reduced");
    if (reduced) return; // the star simply appears / is simply gone
    const born = memories.filter((m) => !prev.has(m.id));
    const gone = [...prev.values()].filter((m) => !next.has(m.id));
    const timers: number[] = [];
    if (born.length === 1) {
      setNewbornId(born[0].id);
      timers.push(window.setTimeout(() => setNewbornId(null), 1800));
    }
    if (gone.length === 1) {
      const g = starFor(gone[0]);
      setGhostStar({ x: g.x, y: g.y, size: g.size, tint: g.tint });
      timers.push(window.setTimeout(() => setGhostStar(null), 1300));
    }
    return () => { for (const t of timers) clearTimeout(t); };
  }, [memories]);

  return (
    <div className="motion-calm mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14 space-y-6">
      <div>
        <p className="qs-section-label">{tx(lang, "a sky of what stays")}</p>
        <h1 className="mt-3 font-serif font-light tracking-tight text-3xl sm:text-[2.4rem] leading-tight">{tx(lang, "Your night sky")}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {tx(lang, "Every memory you keep becomes a star. The ones that matter most shine brightest. Tap one to step back inside it.")}
        </p>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setTab("memories")} aria-pressed={tab === "memories"} className={`qs-chip ${tab === "memories" ? "qs-chip--active" : ""}`}>{tx(lang, "the sky")}</button>
        <button type="button" onClick={() => setTab("letters")} aria-pressed={tab === "letters"} className={`qs-chip ${tab === "letters" ? "qs-chip--active" : ""}`}>{tx(lang, "letters")}</button>
      </div>

      {tab === "letters" ? (
        <div className="space-y-4">
          <div>
            <p className="qs-section-label">{tx(lang, "the moon cycle")}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {tx(lang, "InnerMate's weekly letters — gentle notes written back to you.")}
            </p>
          </div>
          <LettersShelf />
        </div>
      ) : (
        <>
          {/* ── THE SKY — held in the study's etched window frame ───── */}
          <div>
          <div className="study-window">
          <div
            className="sky-panel h-[380px]"
            role="group"
            aria-label={
              typeof n === "number"
                ? (lang === "hi"
                    ? `आपका रात का आसमान — ${n} संजोई हुई ${n === 1 ? "याद" : "यादें"}, हर तारा एक है${dominantFeeling ? `, ज़्यादातर ${feelingLabel(dominantFeeling, lang)}` : ""}`
                    : `Your night sky — ${n} kept ${n === 1 ? "memory" : "memories"}, every star is one${dominantFeeling ? `, mostly ${dominantFeeling}` : ""}`)
                : tx(lang, "Your night sky — every star is a kept memory")
            }
          >
            {/* ambient layers */}
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              {/* milky way — a diagonal breath of light. Two blurred layers,
                  not three: budget-Android GPUs pay per blurred pixel. */}
              <div className="absolute -left-24 -right-12 top-[28%] h-44 -rotate-[18deg]">
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: "linear-gradient(90deg, transparent 0%, oklch(0.88 0.02 265 / 0.09) 30%, oklch(0.9 0.015 265 / 0.11) 55%, transparent 100%)",
                    filter: "blur(16px)",
                  }}
                />
                <div
                  className="absolute inset-x-24 top-14 h-9 rounded-full"
                  style={{
                    background: "linear-gradient(90deg, transparent, oklch(0.96 0.01 90 / 0.08), transparent)",
                    filter: "blur(10px)",
                  }}
                />
              </div>

              {/* one slow aurora */}
              <div
                className="absolute -left-8 top-10 h-28 w-4/5 rounded-full"
                style={{
                  background: "linear-gradient(100deg, transparent 5%, color-mix(in oklab, var(--mint) 20%, transparent) 35%, color-mix(in oklab, var(--lavender) 16%, transparent) 65%, transparent 95%)",
                  filter: "blur(18px)",
                  animation: "qs-aurora 18s ease-in-out infinite alternate",
                }}
              />

              {/* drifting field of far stars + one shooting star */}
              <div className="absolute inset-0" style={{ animation: "qs-skydrift 70s ease-in-out infinite alternate" }}>
                {BG_STARS.map((s, i) => (
                  <span
                    key={i}
                    className="absolute rounded-full"
                    style={{
                      background: "var(--moth)",
                      left: `${s.left}%`,
                      top: `${s.top}%`,
                      width: s.size,
                      height: s.size,
                      opacity: s.opacity,
                      animation: s.twinkle ? `qs-twinkle ${s.dur}s ease-in-out ${s.delay}s infinite` : undefined,
                    }}
                  />
                ))}
                <span
                  className="absolute left-[14%] top-[16%] h-px w-16 rounded-full opacity-0"
                  style={{
                    background: "linear-gradient(90deg, oklch(1 0 0 / 0.9), oklch(1 0 0 / 0))",
                    animation: "qs-shoot 11s linear infinite",
                  }}
                />
              </div>

              {/* the moon — a cratered disc lit from the upper right, soft terminator on the left */}
              <div className="absolute right-6 top-5 h-11 w-11">
                <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible" aria-hidden>
                  <defs>
                    {/* spherical surface shading (sunlit upper-right) */}
                    <radialGradient id="moonBody" cx="64%" cy="36%" r="72%">
                      <stop offset="0%" stopColor="oklch(0.97 0.02 95)" />
                      <stop offset="55%" stopColor="oklch(0.9 0.025 95)" />
                      <stop offset="82%" stopColor="oklch(0.79 0.03 92)" />
                      <stop offset="100%" stopColor="oklch(0.66 0.03 88)" />
                    </radialGradient>
                    {/* night side — a soft, curved terminator toward the left */}
                    <radialGradient id="moonNight" cx="14%" cy="52%" r="96%">
                      <stop offset="0%" stopColor="oklch(0.15 0.03 250 / 0.94)" />
                      <stop offset="50%" stopColor="oklch(0.15 0.03 250 / 0.5)" />
                      <stop offset="76%" stopColor="oklch(0.15 0.03 250 / 0)" />
                    </radialGradient>
                    <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="52%" stopColor="oklch(0.92 0.05 95 / 0.4)" />
                      <stop offset="100%" stopColor="oklch(0.92 0.05 95 / 0)" />
                    </radialGradient>
                    <filter id="moonSoft" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="1.2" />
                    </filter>
                    <clipPath id="moonClip"><circle cx="50" cy="50" r="38" /></clipPath>
                  </defs>

                  {/* halo */}
                  <circle cx="50" cy="50" r="50" fill="url(#moonGlow)" />
                  {/* the disc */}
                  <circle cx="50" cy="50" r="38" fill="url(#moonBody)" />

                  <g clipPath="url(#moonClip)">
                    {/* maria — the soft dark seas */}
                    <g filter="url(#moonSoft)" fill="oklch(0.71 0.03 90 / 0.5)">
                      <ellipse cx="58" cy="40" rx="12" ry="9" />
                      <ellipse cx="45" cy="61" rx="9" ry="7" />
                      <ellipse cx="67" cy="59" rx="5" ry="4.5" />
                    </g>
                    {/* craters — a shaded bowl with a sunlit rim on the upper-right */}
                    {([
                      [62, 33, 5], [70, 49, 3.4], [55, 55, 4.2], [48, 41, 3], [62, 66, 2.6], [41, 50, 2.2],
                    ] as const).map(([cx, cy, r], i) => (
                      <g key={i}>
                        <circle cx={cx} cy={cy} r={r} fill="oklch(0.64 0.03 88 / 0.55)" />
                        <circle cx={cx + r * 0.3} cy={cy - r * 0.3} r={r * 0.8} fill="oklch(0.96 0.02 95 / 0.32)" />
                        <circle cx={cx} cy={cy} r={r * 0.55} fill="oklch(0.58 0.03 86 / 0.45)" />
                      </g>
                    ))}
                    {/* the shadowed left limb */}
                    <circle cx="50" cy="50" r="38" fill="url(#moonNight)" />
                  </g>

                  {/* a thin lit rim on the sunward edge */}
                  <circle cx="50" cy="50" r="38" fill="none" stroke="oklch(0.98 0.02 95 / 0.45)" strokeWidth="0.5" />
                </svg>
              </div>

              {/* treeline along the bottom */}
              <svg className="absolute inset-x-0 bottom-0 h-14 w-full" viewBox="0 0 400 56" preserveAspectRatio="none">
                <path
                  d="M0 56 L0 34 L14 40 L26 24 L38 37 L54 29 L68 40 L84 24 L98 36 L114 30 L128 41 L146 26 L162 38 L182 20 L200 37 L218 30 L234 42 L252 28 L268 39 L286 24 L302 37 L322 30 L338 42 L356 28 L372 38 L388 31 L400 37 L400 56 Z"
                  fill="oklch(0.19 0.045 278 / 0.85)"
                />
                <path
                  d="M0 56 L0 44 L18 49 L32 38 L48 49 L66 42 L82 51 L100 40 L118 50 L136 43 L154 52 L174 39 L192 50 L212 44 L232 53 L252 43 L272 52 L292 45 L312 53 L332 43 L352 51 L372 44 L390 51 L400 46 L400 56 Z"
                  fill="oklch(0.13 0.032 275)"
                />
              </svg>

              {/* fireflies near the treeline */}
              {FIREFLIES.map((f, i) => (
                <span key={i} className="qs-firefly" style={{ left: f.left, top: f.top, animationDelay: f.delay }} />
              ))}
            </div>

            {/* constellation name, written in the corner of the sky */}
            {activeFeeling && (
              <div className="fade-in pointer-events-none absolute left-5 top-4 z-[7]">
                <p
                  className="font-serif italic text-[26px] leading-none"
                  style={{ color: "color-mix(in oklab, var(--moth) 92%, white)", textShadow: `0 0 20px ${activeTint}` }}
                >
                  {feelingLabel(activeFeeling, lang)}
                </p>
                <p className="mt-1.5 text-[9.5px] uppercase tracking-[0.24em]" style={{ color: "color-mix(in oklab, var(--moth) 74%, transparent)" }}>
                  {tx(lang, "constellation")} · {activeStars.length}
                </p>
              </div>
            )}

            {/* faint lines between kin stars */}
            {activeStars.length > 1 && (
              <svg aria-hidden className="pointer-events-none absolute inset-0 z-[4] h-full w-full">
                {activeStars.slice(0, -1).map((s, i) => {
                  const next = activeStars[i + 1];
                  return (
                    <line
                      key={s.memory.id}
                      x1={`${s.x}%`} y1={`${s.y}%`} x2={`${next.x}%`} y2={`${next.y}%`}
                      stroke={activeTint} strokeOpacity={0.32} strokeWidth={1} strokeDasharray="2 5"
                    />
                  );
                })}
              </svg>
            )}

            {/* the memories themselves */}
            {stars.map((s) => {
              const dim = activeFeeling !== null && (s.memory.feeling_tag ?? "") !== activeFeeling;
              const isSelected = s.memory.id === selectedId;
              const active = isSelected || s.memory.id === hoveredId;
              const bright = BRIGHT_FEELINGS.has(s.memory.feeling_tag ?? "");
              const isNewborn = s.memory.id === newbornId;
              const label = s.memory.title
                || (s.memory.story ?? "").split("\n")[0].slice(0, 40)
                || tx(lang, "an untitled moment");
              return (
                <button
                  key={s.memory.id}
                  type="button"
                  aria-label={label}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedId(isSelected ? null : s.memory.id)}
                  onMouseEnter={() => setHoveredId(s.memory.id)}
                  onMouseLeave={() => setHoveredId((id) => (id === s.memory.id ? null : id))}
                  onFocus={() => setHoveredId(s.memory.id)}
                  onBlur={() => setHoveredId((id) => (id === s.memory.id ? null : id))}
                  className="group absolute z-[6] flex h-10 w-10 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  style={{
                    left: `${s.x}%`,
                    top: `${s.y}%`,
                    marginLeft: -20,
                    marginTop: -20,
                    opacity: dim ? 0.22 : 1,
                    zIndex: active ? 9 : 6,
                    transition: "opacity 480ms ease",
                  }}
                >
                  {/* name, revealed on hover or keyboard focus */}
                  <span
                    className="qs-star-label transition-opacity duration-200"
                    style={{ opacity: active ? 1 : 0 }}
                  >
                    {label}
                  </span>
                  <span
                    className="relative block transition-transform duration-300 group-hover:scale-[1.35] group-focus-visible:scale-[1.35]"
                    style={{ width: s.size, height: s.size }}
                  >
                    {/* diffraction spikes for the brightest feelings */}
                    {bright && (
                      <span
                        aria-hidden
                        className={`qs-spike${isNewborn ? " qs-first-light-spike" : ""}`}
                        style={{
                          // @ts-expect-error css var
                          "--spike": s.tint,
                          opacity: active ? 0.9 : 0.5,
                          transition: "opacity 300ms ease",
                        }}
                      />
                    )}
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-full"
                      onAnimationEnd={isNewborn ? () => setNewbornId(null) : undefined}
                      style={{
                        background: `radial-gradient(circle at 38% 34%, oklch(1 0 0 / 0.98) 0%, ${s.tint} 58%, color-mix(in oklab, ${s.tint} 30%, transparent) 100%)`,
                        boxShadow: `0 0 ${Math.round(s.size * (active ? 2.4 : 1.7))}px ${active ? 2 : 1}px color-mix(in oklab, ${s.tint} 65%, transparent)`,
                        animation: isNewborn
                          ? "qs-first-light 1.4s ease-out both"
                          : `qs-twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
                        transition: "box-shadow 300ms ease",
                      }}
                    />
                    {isSelected && (
                      <span
                        aria-hidden
                        className="absolute -inset-1.5 rounded-full"
                        style={{
                          boxShadow: "0 0 0 1px color-mix(in oklab, var(--moth) 88%, transparent)",
                          animation: "qs-sel-ring 2.4s ease-in-out infinite",
                        }}
                      />
                    )}
                  </span>
                </button>
              );
            })}

            {/* a star going out — the burn ritual's ghost, one flare then an
                ember sinking toward the treeline */}
            {ghostStar && (
              <span
                aria-hidden
                className="qs-star-out pointer-events-none absolute z-[5] rounded-full"
                style={{
                  left: `${ghostStar.x}%`,
                  top: `${ghostStar.y}%`,
                  width: ghostStar.size,
                  height: ghostStar.size,
                  marginLeft: -ghostStar.size / 2,
                  marginTop: -ghostStar.size / 2,
                  background: `radial-gradient(circle at 38% 34%, oklch(1 0 0 / 0.98) 0%, ${ghostStar.tint} 58%, transparent 100%)`,
                  boxShadow: `0 0 ${Math.round(ghostStar.size * 1.7)}px 1px color-mix(in oklab, ${ghostStar.tint} 65%, transparent)`,
                }}
              />
            )}

            {/* an empty sky, still listening */}
            {!isLoading && stars.length === 0 && (
              <div className="pointer-events-none absolute inset-0 z-[6] flex flex-col items-center justify-center gap-4 px-8">
                <span className="qs-seed-star" aria-hidden />
                <p className="text-center font-serif italic text-sm leading-relaxed" style={{ color: "color-mix(in oklab, var(--moth) 82%, transparent)" }}>
                  {tx(lang, "your sky is waiting for its first star.")}
                  <br />
                  {tx(lang, "keep a moment below, and watch it light up here.")}
                </p>

              </div>
            )}

            {/* the windowsill note — the star's details on a slip of paper
                resting on the sill, not a pane of glass */}
            {selectedStar && (
              <div className="sill-note rise-in absolute inset-x-3 bottom-3 z-10 p-4">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ background: `color-mix(in oklab, ${selectedStar.tint} 18%, transparent)` }}
                  >
                    {selectedStar.memory.media_type === "video" ? (
                      <Video className="h-4 w-4" strokeWidth={1.7} style={{ color: selectedStar.tint }} />
                    ) : selectedStar.memory.media_type === "audio" ? (
                      <Music className="h-4 w-4" strokeWidth={1.7} style={{ color: selectedStar.tint }} />
                    ) : selectedStar.memory.media_url ? (
                      <ImageIcon className="h-4 w-4" strokeWidth={1.7} style={{ color: selectedStar.tint }} />
                    ) : (
                      <Sparkles className="h-4 w-4" strokeWidth={1.7} style={{ color: selectedStar.tint }} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "color-mix(in oklab, var(--ink) 80%, transparent)" }}>
                      {memoryDateLabel(selectedStar.memory, lang)}
                      {selectedStar.memory.feeling_tag ? ` · ${feelingLabel(selectedStar.memory.feeling_tag, lang)}` : ""}
                    </p>
                    <p className="truncate font-serif text-[15px] leading-snug" style={{ color: "var(--ink)" }}>
                      {selectedStar.memory.title || tx(lang, "an untitled moment")}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex min-h-11 shrink-0 items-center rounded-full border px-3.5 text-[12.5px] font-medium transition hover:-translate-y-0.5"
                    style={{ borderColor: "color-mix(in oklab, var(--ink) 35%, transparent)", color: "var(--ink)" }}
                    onClick={() => setReliveId(selectedStar.memory.id)}
                  >
                    {tx(lang, "relive")}
                  </button>
                  <button
                    type="button"
                    aria-label={tx(lang, "Close")}
                    onClick={() => setSelectedId(null)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]"
                  >
                    <X className="h-4 w-4" strokeWidth={1.7} style={{ color: "color-mix(in oklab, var(--ink) 65%, transparent)" }} />
                  </button>
                </div>
              </div>
            )}
          </div>
          </div>
          {/* the engraving on the sill — the sky's facts, inscribed not headlined */}
          {typeof n === "number" && n > 0 && (
            <p className="study-sill-note" aria-hidden="true">
              {lang === "hi"
                ? `${n} ${n === 1 ? "तारा" : "तारे"}${dominantFeeling ? ` · ज़्यादातर ${feelingLabel(dominantFeeling, lang)}` : ""}`
                : `${n} star${n === 1 ? "" : "s"}${dominantFeeling ? ` · mostly ${dominantFeeling}` : ""}`}
            </p>
          )}
          </div>

          {/* wander — let the sky pick a memory to step back into */}
          {(memories?.length ?? 0) >= 2 && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={wander}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] transition hover:brightness-110"
                style={{
                  color: "var(--dawn)",
                  background: "color-mix(in oklab, var(--dawn) 8%, transparent)",
                  border: "1px solid color-mix(in oklab, var(--dawn) 30%, transparent)",
                }}
              >
                <Sparkles className="h-3.5 w-3.5" strokeWidth={1.7} />
                {tx(lang, "let the sky surprise you")}
              </button>
            </div>
          )}

          {/* constellations — the sky, sorted by feeling */}
          {constellations.length > 0 && (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label={tx(lang, "Constellations")}>
              {constellations.map(([feeling, count]) => (
                <button
                  key={feeling}
                  type="button"
                  aria-pressed={activeFeeling === feeling}
                  onClick={() => setActiveFeeling(activeFeeling === feeling ? null : feeling)}
                  className={`qs-chip shrink-0 ${activeFeeling === feeling ? "qs-chip--active" : ""}`}
                >
                  {feelingLabel(feeling, lang)} · {count}
                </button>
              ))}
            </div>
          )}

          <NewMemory onSaved={invalidate} />

          {/* walk among them */}
          {(memories?.length ?? 0) > 0 && (() => {
            const q = query.trim().toLowerCase();
            const walk = (memories ?? []).filter((m) => {
              if (activeFeeling && (m.feeling_tag ?? "") !== activeFeeling) return false;
              if (!q) return true;
              return `${m.title ?? ""} ${m.story ?? ""} ${m.feeling_tag ?? ""}`.toLowerCase().includes(q);
            });
            return (
            <section aria-label={tx(lang, "Walk among your memories")} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="qs-section-label">{tx(lang, "walk among them")}</p>
                <label className="flex items-center gap-2 rounded-full border border-border/50 bg-card/40 px-3 py-1.5">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} aria-hidden />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={tx(lang, "search your memories")}
                    aria-label={tx(lang, "Search your memories")}
                    className="w-32 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground sm:w-44"
                  />
                  {query && (
                    <button type="button" onClick={() => setQuery("")} aria-label={tx(lang, "Clear search")} className="text-muted-foreground transition hover:text-foreground">
                      <X className="h-3.5 w-3.5" strokeWidth={1.8} />
                    </button>
                  )}
                </label>
              </div>
              {walk.length === 0 ? (
                <p className="py-4 text-[13.5px] italic text-muted-foreground">{lang === "hi" ? `“${query}” से अभी कुछ मेल नहीं खाता।` : `nothing matches “${query}” yet.`}</p>
              ) : (
              <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
                {walk.map((m) => {
                  const label = m.title || (m.story ?? "").split("\n")[0].slice(0, 40) || tx(lang, "an untitled moment");
                  const when = m.memory_date
                    ? new Date(m.memory_date).toLocaleDateString(lang === "hi" ? "hi-IN" : undefined, { month: "short", year: "numeric" })
                    : tx(lang, "undated");
                  const tint = tintFor(m.feeling_tag);
                  const hasImage = !!m.media_url && m.media_type === "image";
                  const MediaIcon = m.media_type === "video" ? Video : m.media_type === "audio" ? Music : null;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setReliveId(m.id)}
                      className="parchment group relative flex aspect-[3/4] w-32 shrink-0 flex-col justify-end overflow-hidden p-3 text-left transition hover:-translate-y-0.5"
                    >
                      {hasImage ? (
                        <img
                          src={m.media_url!}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover opacity-70"
                          loading="lazy"
                        />
                      ) : (
                        // No photo? Let the feeling paint the card, with a small star.
                        <>
                          <div
                            aria-hidden
                            className="absolute inset-0"
                            style={{ background: `radial-gradient(120% 90% at 50% 8%, color-mix(in oklab, ${tint} 30%, transparent) 0%, transparent 62%)` }}
                          />
                          <span
                            aria-hidden
                            className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full transition-transform duration-300 group-hover:scale-125"
                            style={{
                              background: `radial-gradient(circle at 38% 34%, oklch(1 0 0 / 0.95) 0%, ${tint} 60%, transparent 100%)`,
                              boxShadow: `0 0 10px 1px color-mix(in oklab, ${tint} 60%, transparent)`,
                            }}
                          />
                          {MediaIcon && (
                            <span className="absolute left-3 top-3 text-foreground/55" aria-hidden>
                              <MediaIcon className="h-3.5 w-3.5" strokeWidth={1.7} />
                            </span>
                          )}
                        </>
                      )}
                      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/40 to-transparent" />
                      <div className="relative">
                        {m.feeling_tag && (
                          <p className="text-[9px] uppercase tracking-[0.16em]" style={{ color: `color-mix(in oklab, ${tint} 55%, var(--foreground))` }}>
                            {feelingLabel(m.feeling_tag, lang)}
                          </p>
                        )}
                        <p className="mt-0.5 font-serif text-[13px] leading-tight line-clamp-2">{label}</p>
                        <p className="mt-1 text-[10px] italic text-muted-foreground">{when}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              )}
            </section>
            );
          })()}

          <p className="pt-1 text-center font-serif italic text-sm text-muted-foreground">
            {tx(lang, "what you keep here, keeps shining.")}
          </p>

          {reliveMemory && (
            <ReliveDialog
              memory={reliveMemory}
              onOpenChange={(v) => { if (!v) setReliveId(null); }}
              onChanged={invalidate}
            />
          )}
        </>
      )}
    </div>
  );
}

type LetterRow = {
  id: string;
  week_start: string;
  tone: "gentle" | "tender";
  ritual: string | null;
  body: string;
  generated_at: string;
};

function LettersShelf() {
  const lang = useLang();
  const listFn = useServerFn(listKeptLetters);
  const { data: letters, isLoading } = useQuery({
    queryKey: ["kept-letters"],
    queryFn: () => listFn() as Promise<LetterRow[]>,
  });

  if (isLoading) return <LampSkeletonList rows={2} rowClassName="h-28 w-full rounded-2xl" />;
  if (!letters || letters.length === 0) {
    return (
      <TactileCard>
        <p className="font-serif text-lg leading-relaxed">{tx(lang, "No letters kept yet. That's allowed.")}</p>
        <p className="mt-2 text-sm text-muted-foreground">{tx(lang, "If Sunday letters are on in Settings, one will arrive at week's end.")}</p>
      </TactileCard>
    );
  }

  return (
    <div className="space-y-4">
      {letters.map((l, i) => {
        const date = new Date(l.week_start + "T00:00:00").toLocaleDateString(lang === "hi" ? "hi-IN" : undefined, { month: "long", day: "numeric", year: "numeric" });
        const preview = l.body.split(/\n\n+/)[1]?.slice(0, 160) ?? l.body.slice(0, 160);
        return (
          <Link key={l.id} to="/letter/$id" params={{ id: l.id }} className="block">
            {/* stagger the shelf: each kept letter rises in a beat after the last */}
            <TactileCard className="transition hover:-translate-y-0.5" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">{lang === "hi" ? `${date} का हफ़्ता` : `Week of ${date}`}</p>
              <p className="mt-2 font-serif text-lg leading-snug">{tx(lang, "A quiet letter")}</p>
              <p className="mt-2 text-sm italic leading-relaxed text-muted-foreground line-clamp-3">{preview}…</p>
            </TactileCard>
          </Link>
        );
      })}
    </div>
  );
}

/* ── hang a new star — the compose flow ───────────────────────────────── */

function NewMemory({ onSaved }: { onSaved: () => void }) {
  const lang = useLang();
  const saveFn = useServerFn(saveMemory);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [feeling, setFeeling] = useState<Feeling | "">("");
  const [memoryDate, setMemoryDate] = useState("");
  const [aiReadable, setAiReadable] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<"image" | "video" | "audio">("image");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTitle(""); setStory(""); setFeeling(""); setMemoryDate("");
    setAiReadable(false); setFile(null); setKind("image");
    if (fileRef.current) fileRef.current.value = "";
  };

  // Photo / Video / Audio — one tap opens the native picker filtered to that kind.
  const pick = (k: "image" | "video" | "audio") => {
    setKind(k);
    setFile(null);
    const input = fileRef.current;
    if (input) {
      input.value = "";
      input.accept = k === "image" ? "image/*" : k === "video" ? "video/*" : "audio/*";
      input.click();
    }
  };

  const submit = async () => {
    if (!file) { toast.error(tx(lang, "Choose a photo, video, or audio clip to keep.")); return; }
    if (file.size > MAX_BYTES) { toast.error(tx(lang, "File is over 50MB.")); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(tx(lang, "Not signed in"));
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("memories").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (upErr) throw upErr;
      await saveFn({ data: {
        title: title.trim() || null,
        story: story.trim() || null,
        feeling_tag: (feeling || null) as Feeling | null,
        memory_date: memoryDate || null,
        media_path: path,
        media_type: file.type.startsWith("video")
          ? "video"
          : file.type.startsWith("audio")
            ? "audio"
            : "image",
        is_ai_readable: aiReadable,
      }});
      toast.success(tx(lang, "Kept. Look up — it's already shining."));
      reset();
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <div className="flex justify-center">
        <button type="button" onClick={() => setOpen(true)} className="qs-pill-cta inline-flex items-center gap-2">
          <Plus className="h-4 w-4" strokeWidth={1.9} />
          {tx(lang, "hang a new star")}
        </button>
      </div>
    );
  }

  return (
    <TactileCard>
      <p className="qs-section-label">{tx(lang, "hang a new star")}</p>
      <h2 className="mt-2 font-serif text-xl">{tx(lang, "What should this one hold?")}</h2>
      <div className="mt-5 space-y-4">
        <div>
          <Label>{tx(lang, "What are you keeping? (max 50MB)")}</Label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {([
              { k: "image", label: "Photo", Icon: ImageIcon },
              { k: "video", label: "Video", Icon: Video },
              { k: "audio", label: "Audio", Icon: Music },
            ] as const).map(({ k, label, Icon }) => {
              const active = kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => pick(k)}
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium transition ${
                    active ? "text-foreground" : "border-border/50 text-muted-foreground hover:border-border/80"
                  }`}
                  style={active ? {
                    borderColor: "color-mix(in oklab, var(--dawn) 45%, transparent)",
                    background: "color-mix(in oklab, var(--dawn) 10%, transparent)",
                    color: "var(--dawn)",
                  } : undefined}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.6} />
                  {tx(lang, label)}
                </button>
              );
            })}
          </div>
          {/* the picker itself stays hidden; the three cards drive it */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="sr-only"
            aria-hidden
            tabIndex={-1}
          />
          {file ? (
            <p className="mt-2.5 flex items-center gap-2 text-[13px]">
              <span className="truncate text-foreground">{file.name}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {(file.size / (1024 * 1024)).toFixed(1)}MB
              </span>
            </p>
          ) : (
            <p className="mt-2.5 text-[12px] text-muted-foreground">
              {tx(lang, "Tap Photo, Video, or Audio to choose from your device.")}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="m-title">{tx(lang, "Title (optional)")}</Label>
          <Input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="mt-1.5 rounded-xl" />
        </div>
        <div>
          <Label htmlFor="m-story">{tx(lang, "The story behind this")}</Label>
          <Textarea
            id="m-story"
            value={story}
            onChange={(e) => setStory(e.target.value)}
            maxLength={4000}
            placeholder={tx(lang, "What does this moment hold?")}
            className="mt-1.5 min-h-[120px] rounded-xl"
          />
        </div>
        <div>
          <Label>{tx(lang, "How it feels")}</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {FEELINGS.map((f) => {
              const active = feeling === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFeeling(active ? "" : f.value)}
                  aria-pressed={active}
                  className="rounded-full border px-3 py-1.5 text-xs transition"
                  style={active ? FEELING_CHIP_STYLE[f.value] : { background: "color-mix(in oklab, var(--muted) 50%, transparent)", color: "var(--muted-foreground)", borderColor: "transparent" }}
                >
                  {feelingLabel(f.value, lang)}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <Label htmlFor="m-date">{tx(lang, "When did this happen?")}</Label>
          <Input id="m-date" type="date" value={memoryDate} onChange={(e) => setMemoryDate(e.target.value)} className="mt-1.5 rounded-xl" />
        </div>
        <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={aiReadable}
              onChange={(e) => setAiReadable(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm">
              <span className="font-medium">{tx(lang, "Let InnerMate know about this memory")}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {tx(lang, "If on, InnerMate may gently remember the story you wrote here. It never sees the photo, video, or audio itself, only your words about it.")}
              </span>
            </span>
          </label>
        </div>
        <div className="flex gap-2 pt-2">
          <Button onClick={submit} disabled={saving} className="rounded-full">
            {saving ? tx(lang, "Hanging it…") : tx(lang, "Hang this star")}
          </Button>
          <Button variant="outline" className="rounded-full" onClick={() => { reset(); setOpen(false); }}>
            {tx(lang, "Not now")}
          </Button>
        </div>
      </div>
    </TactileCard>
  );
}

/* ── relive — step back inside a star ─────────────────────────────────── */

function ReliveDialog({
  memory, onOpenChange, onChanged,
}: {
  memory: MemoryRow;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}) {
  const lang = useLang();
  const toggleFn = useServerFn(setMemoryReadable);
  const delFn = useServerFn(deleteMemory);
  const editFn = useServerFn(updateMemory);
  const [burning, setBurning] = useState(false);
  const [working, setWorking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(memory.title ?? "");
  const [story, setStory] = useState(memory.story ?? "");

  const saveEdits = async () => {
    setWorking(true);
    try {
      await editFn({ data: { id: memory.id, title: title.trim() || null, story: story.trim() || null } });
      setEditing(false);
      onChanged();
    } catch (e) { toast.error((e as Error).message); }
    finally { setWorking(false); }
  };

  const toggle = async () => {
    setWorking(true);
    try {
      await toggleFn({ data: { id: memory.id, is_ai_readable: !memory.is_ai_readable } });
      onChanged();
    } catch (e) { toast.error((e as Error).message); }
    finally { setWorking(false); }
  };

  const performBurn = async () => {
    setWorking(true);
    try {
      await delFn({ data: { id: memory.id } });
      // let the ember animation play, then let the star go out
      setTimeout(() => { onOpenChange(false); onChanged(); }, 900);
    } catch (e) {
      toast.error((e as Error).message);
      setWorking(false);
    }
  };

  const tint = tintFor(memory.feeling_tag);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className={`max-h-[85vh] overflow-y-auto sm:max-w-lg ${working ? "ember-burn" : ""}`}>
        <DialogHeader className="sr-only">
          <DialogTitle>{memory.title || tx(lang, "A kept memory")}</DialogTitle>
          <DialogDescription>{tx(lang, "Step back inside this memory.")}</DialogDescription>
        </DialogHeader>

        {memory.media_url && (
          memory.media_type === "audio" ? (
            <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
              <div className="mb-3 flex items-center gap-2 text-[12px] text-muted-foreground">
                <Music className="h-4 w-4" strokeWidth={1.7} style={{ color: tint }} />
                {tx(lang, "a sound you kept")}
              </div>
              <audio src={memory.media_url} controls className="w-full" />
            </div>
          ) : (
            <div className="-mx-6 -mt-6 overflow-hidden bg-muted/40 sm:rounded-t-lg">
              {memory.media_type === "video" ? (
                <video src={memory.media_url} muted controls playsInline className="w-full" />
              ) : (
                <img src={memory.media_url} alt={memory.title ?? tx(lang, "memory")} className="w-full object-cover" loading="lazy" />
              )}
            </div>
          )
        )}

        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
            {memoryDateLabel(memory, lang)}
            {memory.feeling_tag && <span style={{ color: tint }}>{` · ${feelingLabel(memory.feeling_tag, lang)}`}</span>}
          </p>
          {editing ? (
            <div className="mt-2 space-y-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder={tx(lang, "a title (optional)")}
                aria-label={tx(lang, "Memory title")}
                className="w-full rounded-xl border border-border/60 bg-card/50 px-3 py-2 font-serif text-lg leading-snug outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
              <textarea
                value={story}
                onChange={(e) => setStory(e.target.value)}
                maxLength={4000}
                rows={5}
                placeholder={tx(lang, "the words you want to keep")}
                aria-label={tx(lang, "Memory story")}
                className="w-full resize-y rounded-xl border border-border/60 bg-card/50 px-3 py-2 text-[15px] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
              <div className="flex gap-2">
                <button type="button" onClick={saveEdits} disabled={working} className="inline-flex min-h-11 items-center rounded-full border px-4 text-[13px] font-medium transition hover:brightness-110 disabled:opacity-60" style={{ borderColor: "var(--border-active)", color: "var(--text-primary)", background: "color-mix(in oklab, var(--violet) 14%, transparent)" }}>
                  {working ? tx(lang, "saving…") : tx(lang, "save changes")}
                </button>
                <button type="button" onClick={() => { setEditing(false); setTitle(memory.title ?? ""); setStory(memory.story ?? ""); }} className="rounded-full px-3 py-2 text-[13px] text-muted-foreground transition hover:text-foreground">
                  {tx(lang, "cancel")}
                </button>
              </div>
            </div>
          ) : (
            <>
              {memory.title && <h3 className="mt-1.5 font-serif text-xl leading-snug">{memory.title}</h3>}
              {memory.story && (
                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90">{memory.story}</p>
              )}
            </>
          )}
        </div>

        <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={memory.is_ai_readable}
              onChange={toggle}
              disabled={working}
              className="mt-1"
            />
            <span className="text-sm">
              <span className="font-medium">{tx(lang, "Share with InnerMate")}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {tx(lang, "If on, InnerMate may gently remember the story you wrote here. It never sees the photo, video, or audio itself, only your words about it.")}
              </span>
            </span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-1">
          <button type="button" className="qs-pill-cta" onClick={() => onOpenChange(false)}>
            {tx(lang, "Sit with this a moment")}
          </button>
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.7} />
              {tx(lang, "edit")}
            </button>
          )}
          <button
            type="button"
            onClick={() => setBurning(true)}
            disabled={working}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/80 transition hover:text-[color:oklch(0.68_0.14_38)]"
          >
            <Flame className="h-3.5 w-3.5" strokeWidth={1.7} />
            {tx(lang, "let it go")}
          </button>
        </div>
        <p className="text-[11px] italic leading-relaxed text-muted-foreground">
          {tx(lang, "letting go is a true goodbye. the memory and whatever you kept with it leave your sky for good.")}
        </p>

        <BurnRitual
          open={burning}
          onOpenChange={setBurning}
          title={memory.title}
          onBurn={performBurn}
        />
      </DialogContent>
    </Dialog>
  );
}

function BurnRitual({
  open, onOpenChange, title, onBurn,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string | null;
  onBurn: () => Promise<void>;
}) {
  const lang = useLang();
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [line, setLine] = useState("");

  // reset when reopened
  useMemo(() => { if (open) { setStep(0); setLine(""); } return null; }, [open]);

  const next = async () => {
    if (step === 0) return setStep(1);
    if (step === 1) return setStep(2);
    if (step === 2) {
      setStep(3);
      await onBurn();
      // close after the animation
      setTimeout(() => onOpenChange(false), 2400);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{tx(lang, "Burn a memory")}</DialogTitle>
          <DialogDescription>{tx(lang, "A small ritual for letting a memory go.")}</DialogDescription>
        </DialogHeader>

        {/* Ember visual */}
        <div className="relative mx-auto mt-2 h-32 w-32">
          <div
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 50% 60%, oklch(0.85 0.19 40) 0%, oklch(0.62 0.2 30) 40%, transparent 72%)",
              filter: "blur(6px)",
            }}
          />
          <div
            aria-hidden
            className="ember-flame absolute inset-6 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 50% 55%, oklch(0.96 0.14 90) 0%, oklch(0.78 0.2 45) 55%, oklch(0.55 0.18 25) 100%)",
            }}
          />
          {/* sparks */}
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              aria-hidden
              className="ember-spark absolute left-1/2 top-1/2 h-1 w-1 rounded-full bg-[oklch(0.9_0.16_70)]"
              style={{
                // @ts-expect-error css var
                "--ex": `${(i - 1.5) * 12}px`,
                animationDelay: `${i * 0.35}s`,
              }}
            />
          ))}
        </div>

        <div className="mt-3 text-center">
          <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">{tx(lang, "A quiet ritual")}</p>

          {step === 0 && (
            <>
              <h3 className="mt-2 font-serif text-xl leading-snug">
                {lang === "hi" ? (
                  <><span className="italic">{title || tx(lang, "this memory")}</span> को अलविदा कहें?</>
                ) : (
                  <>Say goodbye to <span className="italic">{title || tx(lang, "this memory")}</span>?</>
                )}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {tx(lang, "Nothing is undone by burning it. But sometimes it helps to mark the moment you chose to release it.")}
              </p>
            </>
          )}

          {step === 1 && (
            <>
              <h3 className="mt-2 font-serif text-xl leading-snug">{tx(lang, "Read it once, slowly.")}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {tx(lang, "Give it the attention it asked for, one last time. Then come back.")}
              </p>
            </>
          )}

          {step === 2 && (
            <>
              <h3 className="mt-2 font-serif text-xl leading-snug">{tx(lang, "One line, if you want.")}</h3>
              <Textarea
                autoFocus
                value={line}
                onChange={(e) => setLine(e.target.value)}
                placeholder={tx(lang, "What this memory taught you, or what you're choosing now.")}
                className="mt-3 min-h-[88px] rounded-xl text-sm leading-relaxed"
                maxLength={280}
              />
              <p className="mt-1.5 text-[11px] italic text-muted-foreground">
                {tx(lang, "This line isn't kept — it burns with the memory.")}
              </p>
            </>
          )}

          {step === 3 && (
            <>
              <h3 className="mt-2 font-serif text-xl leading-snug">{tx(lang, "Let it turn to embers.")}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {tx(lang, "Warm, quiet, gone.")}
              </p>
            </>
          )}
        </div>

        {step < 3 && (
          <div className="mt-5 flex items-center justify-center gap-2">
            <Button variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)}>
              {tx(lang, "Keep it")}
            </Button>
            <Button
              className="rounded-full"
              onClick={() => { void next(); }}
            >
              {step === 0 ? tx(lang, "Begin") : step === 1 ? tx(lang, "I've read it") : tx(lang, "Burn it gently")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
