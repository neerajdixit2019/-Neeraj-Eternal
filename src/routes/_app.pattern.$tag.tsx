import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { listMoods } from "@/lib/data.functions";
import { ArrowLeft, ArrowRight, MoonStar, Hand, Wind, Feather } from "lucide-react";

/**
 * Insight detail — the reference boards' "Overthinking / evenings" screen,
 * built ENTIRELY from the user's own check-ins. Every number and quote here is
 * real: when the feeling appeared, how often, what it arrived alongside, and
 * the user's own words. The framing is deliberately cautious — a pattern to
 * notice, never a diagnosis. Nothing is invented.
 */
export const Route = createFileRoute("/_app/pattern/$tag")({
  component: PatternDetail,
  head: () => ({
    meta: [
      { title: "A pattern | My Quiet Space" },
      { name: "description", content: "A closer look at one feeling — when it tends to appear, and what it arrives alongside. Private to you." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Mood = {
  created_at: string;
  mood_score: number;
  emotion_tags?: string[] | null;
  trigger_tags?: string[] | null;
  note?: string | null;
};

const TIME_LABELS = ["Night", "Morning", "Midday", "Evening"] as const;
function timeBucket(h: number): (typeof TIME_LABELS)[number] {
  if (h < 6) return "Night";
  if (h < 12) return "Morning";
  if (h < 18) return "Midday";
  return "Evening";
}

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function daysAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  if (d < 14) return "last week";
  if (d < 60) return `${Math.round(d / 7)} weeks ago`;
  return `${Math.round(d / 30)} months ago`;
}

function PatternDetail() {
  const { tag } = Route.useParams();
  const decoded = decodeURIComponent(tag);
  const moodsFn = useServerFn(listMoods);
  const { data: moodsRaw, isLoading } = useQuery({ queryKey: ["moods"], queryFn: () => moodsFn() });
  const moods = (moodsRaw ?? []) as Mood[];

  const ev = useMemo(() => {
    const key = decoded.toLowerCase();
    const has = (arr?: string[] | null) => (arr ?? []).some((t) => t.toLowerCase() === key);
    // Canonical label as the user actually stored it (preserves their casing).
    let label = titleCase(decoded);
    const matches = moods.filter((m) => {
      const hit = has(m.emotion_tags) || has(m.trigger_tags);
      if (hit) {
        const found = [...(m.emotion_tags ?? []), ...(m.trigger_tags ?? [])].find((t) => t.toLowerCase() === key);
        if (found) label = found;
      }
      return hit;
    });

    const times: Record<string, number> = { Night: 0, Morning: 0, Midday: 0, Evening: 0 };
    const co = new Map<string, number>();
    const excerpts: { note: string; when: string }[] = [];
    for (const m of matches) {
      times[timeBucket(new Date(m.created_at).getHours())] += 1;
      for (const t of [...(m.emotion_tags ?? []), ...(m.trigger_tags ?? [])]) {
        if (t.toLowerCase() !== key) co.set(t, (co.get(t) ?? 0) + 1);
      }
      const note = (m.note ?? "").trim();
      if (note && excerpts.length < 3) excerpts.push({ note, when: daysAgo(m.created_at) });
    }

    const peakTime = (Object.entries(times).sort((a, b) => b[1] - a[1])[0] ?? ["", 0]) as [string, number];
    const topCo = [...co.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([l, c]) => ({ label: l, count: c }));
    const dates = matches.map((m) => new Date(m.created_at).getTime());
    const spanDays = dates.length ? Math.max(1, Math.round((Math.max(...dates) - Math.min(...dates)) / 86400000)) : 0;

    return { label, count: matches.length, times, peakTime, topCo, excerpts, spanDays, firstSeen: dates.length ? Math.min(...dates) : 0 };
  }, [moods, decoded]);

  const level = ev.count >= 4 ? "High" : ev.count >= 2 ? "Medium" : "Low";
  const timeMax = Math.max(1, ...Object.values(ev.times));

  // "What you can do" — a real practice, chosen from the real evidence.
  const action = (() => {
    const co = ev.topCo[0]?.label;
    const evening = ev.peakTime[0] === "Evening" || ev.peakTime[0] === "Night";
    if (co === "Sleep" || evening) return { to: "/wind-down" as const, title: "A night reset", line: "three slow breaths and one line set down before bed", icon: MoonStar };
    if (co === "Work") return { to: "/urge-shield" as const, title: "A pause before reacting", line: "meet the next wave with a pause instead of a reply", icon: Hand };
    const soothing = ["Anxious", "Overwhelmed", "Angry"].includes(ev.label);
    if (soothing) return { to: "/sos" as const, title: "Sixty seconds of calm", line: "let your body settle before your thoughts do", icon: Wind };
    return { to: "/checkin" as const, title: "A gentle check-in", line: "name it once more, and watch the pattern sharpen", icon: Feather };
  })();
  const ActionIcon = action.icon;

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8 sm:py-12">
      <Link to="/insights" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition hover:text-foreground">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.7} /> back to your sky
      </Link>

      {isLoading ? (
        <p className="mt-10 text-muted-foreground">…</p>
      ) : ev.count === 0 ? (
        <div className="mt-10">
          <h1 className="font-serif text-[1.8rem] font-light leading-snug">{titleCase(decoded)}</h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
            This one hasn't appeared in your check-ins yet — so there's nothing to read into. When it does,
            its pattern will gather here.
          </p>
          <Link to="/insights" className="qs-pill-cta mt-7">Back to check in</Link>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="mt-6 flex items-start justify-between gap-4">
            <div>
              <p className="qs-section-label">a pattern</p>
              <h1 className="mt-2 font-serif text-[2rem] font-light leading-tight tracking-tight">{ev.label}</h1>
              <p className="mt-2 text-[13.5px] text-muted-foreground">
                appeared {ev.count} {ev.count === 1 ? "time" : "times"}
                {ev.spanDays > 0 ? ` across ${ev.spanDays} ${ev.spanDays === 1 ? "day" : "days"}` : ""}
                {ev.count > 0 ? ` · first noticed ${daysAgo(new Date(ev.firstSeen).toISOString())}` : ""}
              </p>
            </div>
            <span
              className="shrink-0 rounded-full px-3 py-1 text-[11px] font-medium"
              style={{
                color: "color-mix(in oklab, var(--accent-primary) 75%, var(--foreground))",
                background: "color-mix(in oklab, var(--accent-primary) 14%, transparent)",
                border: "1px solid color-mix(in oklab, var(--accent-primary) 30%, transparent)",
              }}
            >
              {level}
            </span>
          </div>

          {/* When it tends to appear — real time-of-day distribution */}
          <div className="glass mt-7 rounded-3xl p-5">
            <p className="qs-section-label">when it tends to appear</p>
            <div className="mt-4 grid grid-cols-4 gap-3">
              {TIME_LABELS.map((t) => {
                const c = ev.times[t];
                const h = Math.max(6, Math.round((c / timeMax) * 56));
                const peak = ev.peakTime[0] === t && c > 0;
                return (
                  <div key={t} className="flex flex-col items-center gap-2">
                    <div className="flex h-14 items-end">
                      <div className="w-7 rounded-t-md" style={{ height: `${h}px`, background: peak ? "var(--accent-primary)" : "var(--foreground)", opacity: peak ? 0.9 : 0.22, transition: "height 400ms ease" }} aria-hidden />
                    </div>
                    <p className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">{t}</p>
                    <p className="text-[10.5px] text-foreground/60">{c}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* What it arrives alongside — real co-occurrence */}
          {ev.topCo.length > 0 && (
            <div className="glass mt-4 rounded-3xl p-5">
              <p className="qs-section-label">what it arrives alongside</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {ev.topCo.map((c) => (
                  <Link
                    key={c.label}
                    to="/pattern/$tag"
                    params={{ tag: c.label }}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition hover:-translate-y-0.5"
                    style={{ borderColor: "var(--border-subtle)", background: "color-mix(in oklab, var(--card) 45%, transparent)", color: "var(--text-secondary)" }}
                  >
                    {c.label}
                    <span className="text-[10.5px] text-muted-foreground">×{c.count}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* What this means / Why it matters — cautious, evidence-anchored */}
          <div className="glass mt-4 rounded-3xl p-5">
            <p className="qs-section-label">what this might mean</p>
            <p className="mt-2 text-[14px] leading-relaxed text-foreground/85">
              Across your check-ins, {ev.label.toLowerCase()} showed up most often in the{" "}
              <strong className="font-medium">{ev.peakTime[0].toLowerCase()}</strong>
              {ev.topCo[0] ? <>, and <strong className="font-medium">{ev.topCo[0].label.toLowerCase()}</strong> was named alongside it {ev.topCo[0].count} {ev.topCo[0].count === 1 ? "time" : "times"}</> : null}.
              That's a rhythm worth noticing — not a verdict, and not the whole of you.
            </p>
            <p className="qs-section-label mt-5">why it's worth seeing</p>
            <p className="mt-2 text-[14px] leading-relaxed text-foreground/85">
              Naming when a feeling tends to arrive, and what tends to arrive with it, is how it stops
              running quietly in the background. You're not trying to fix it. You're just letting it be seen.
            </p>
          </div>

          {/* What you can do — one real practice */}
          <Link to={action.to} className="glass mt-4 block rounded-3xl p-5 transition hover:-translate-y-0.5">
            <p className="qs-section-label">one thing you could try</p>
            <div className="mt-3 flex items-center gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-background/60">
                <ActionIcon className="h-5 w-5" strokeWidth={1.6} style={{ color: "var(--accent-primary)" }} />
              </span>
              <div className="min-w-0">
                <p className="font-serif text-[17px] leading-snug">{action.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{action.line}</p>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          </Link>

          {/* The user's own words — real excerpts */}
          {ev.excerpts.length > 0 && (
            <div className="mt-4">
              <p className="qs-section-label">in your own words</p>
              <div className="mt-3 space-y-2.5">
                {ev.excerpts.map((e, i) => (
                  <div key={i} className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border-subtle)", background: "color-mix(in oklab, var(--card) 40%, transparent)" }}>
                    <p className="font-serif text-[14px] italic leading-relaxed text-foreground/85">“{e.note}”</p>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">{e.when}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="mt-8 text-center text-[11.5px] italic leading-relaxed text-muted-foreground">
            Based only on your own check-ins — {ev.count} {ev.count === 1 ? "moment" : "moments"}
            {ev.spanDays > 0 ? ` across ${ev.spanDays} ${ev.spanDays === 1 ? "day" : "days"}` : ""}. Not a diagnosis.
          </p>
        </>
      )}
    </div>
  );
}
