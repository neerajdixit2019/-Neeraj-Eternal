import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listMoods, hidePattern } from "@/lib/data.functions";
import { ArrowLeft, ArrowRight, MoonStar, Hand, Wind, Feather, MessageCircle, Check, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useLang, tagLabel, type Lang } from "@/lib/i18n";
import { tx } from "@/lib/i18n-strings";
import { todLabel, type TodLabel } from "@/lib/pattern-map";

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

function daysAgo(iso: string, lang: Lang = "en") {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (lang === "hi") {
    if (d <= 0) return "आज";
    if (d === 1) return "कल";
    if (d < 7) return `${d} दिन पहले`;
    if (d < 14) return "पिछले हफ़्ते";
    if (d < 60) return `${Math.round(d / 7)} हफ़्ते पहले`;
    return `${Math.round(d / 30)} महीने पहले`;
  }
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
  const navigate = useNavigate();
  const lang = useLang();
  const qc = useQueryClient();
  const moodsFn = useServerFn(listMoods);
  const hideFn = useServerFn(hidePattern);
  const { data: moodsRaw, isLoading } = useQuery({ queryKey: ["moods"], queryFn: () => moodsFn() });
  const moods = (moodsRaw ?? []) as Mood[];
  const [confirmed, setConfirmed] = useState(false);
  const [hiding, setHiding] = useState(false);

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
    const excerpts: { note: string; iso: string }[] = [];
    for (const m of matches) {
      times[timeBucket(new Date(m.created_at).getHours())] += 1;
      for (const t of [...(m.emotion_tags ?? []), ...(m.trigger_tags ?? [])]) {
        if (t.toLowerCase() !== key) co.set(t, (co.get(t) ?? 0) + 1);
      }
      const note = (m.note ?? "").trim();
      if (note && excerpts.length < 3) excerpts.push({ note, iso: m.created_at });
    }

    const peakTime = (Object.entries(times).sort((a, b) => b[1] - a[1])[0] ?? ["", 0]) as [string, number];
    const topCo = [...co.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([l, c]) => ({ label: l, count: c }));
    const dates = matches.map((m) => new Date(m.created_at).getTime());
    const spanDays = dates.length ? Math.max(1, Math.round((Math.max(...dates) - Math.min(...dates)) / 86400000)) : 0;

    return { label, count: matches.length, times, peakTime, topCo, excerpts, spanDays, firstSeen: dates.length ? Math.min(...dates) : 0 };
  }, [moods, decoded]);

  // The old High/Medium/Low badge, spoken instead of stamped.
  const levelLine =
    ev.count >= 4
      ? (lang === "hi" ? "आपके चेक-इन में बार-बार आने वाला मेहमान।" : "a steady visitor in your check-ins.")
      : ev.count >= 2
        ? (lang === "hi" ? "दोहराव शुरू हो रहा है — थोड़ा ध्यान देने लायक।" : "beginning to repeat — worth keeping an eye on.")
        : (lang === "hi" ? "इसका ज़िक्र तो हुआ, पर कभी-कभार — इसे पैटर्न कहना अभी जल्दबाज़ी होगी।" : "noted, but rarely — too soon to call it a pattern.");
  const timeMax = Math.max(1, ...Object.values(ev.times));

  // Ink mixes for writing on the paper sheet. Faint ink stays AA-readable.
  const inkFaint = "color-mix(in oklab, var(--ink) 66%, var(--paper))";
  const inkSoft = "color-mix(in oklab, var(--ink) 80%, var(--paper))";
  const inkHair = "color-mix(in oklab, var(--ink) 16%, transparent)";

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

  const askInnerMate = () => {
    if (lang === "hi") {
      const co = ev.topCo[0] ? `, अक्सर ${tagLabel(ev.topCo[0].label, "hi")} के साथ` : "";
      const msg = `मैंने अपने चेक-इन में एक पैटर्न देखा: ${tagLabel(ev.label, "hi")} का ज़िक्र बार-बार आता है${co}। क्या हम इसे साथ मिलकर देख सकते हैं?`;
      try { sessionStorage.setItem("innermate.reflect", msg); } catch { /* noop */ }
    } else {
      const co = ev.topCo[0] ? `, often alongside ${ev.topCo[0].label.toLowerCase()}` : "";
      try { sessionStorage.setItem("innermate.reflect", `I noticed a pattern in my check-ins: ${ev.label.toLowerCase()} keeps coming up${co}. Can we look at it together?`); } catch { /* noop */ }
    }
    navigate({ to: "/companion" });
  };

  const doHide = async () => {
    if (hiding) return;
    setHiding(true);
    try {
      await hideFn({ data: { tag: ev.label, reasons: [] } });
      qc.invalidateQueries({ queryKey: ["hiddenPatterns"] });
      toast.success(tx(lang, "Set aside. You can bring it back anytime from Insights."));
      navigate({ to: "/insights" });
    } catch (e) {
      toast.error((e as Error).message);
      setHiding(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8 sm:py-12">
      <Link to="/insights" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition hover:text-foreground">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.7} /> {tx(lang, "back to your sky")}
      </Link>

      {isLoading ? (
        <p className="mt-10 text-muted-foreground">…</p>
      ) : ev.count === 0 ? (
        <div className="mt-10">
          <h1 className="font-serif text-[1.8rem] font-light leading-snug">{tagLabel(titleCase(decoded), lang)}</h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
            {tx(lang, "This one hasn't appeared in your check-ins yet — so there's nothing to read into. When it does, its pattern will gather here.")}
          </p>
          <Link to="/insights" className="qs-pill-cta mt-7">{tx(lang, "Back to check in")}</Link>
        </div>
      ) : (
        <>
          {/* THE FIELD NOTE — one sheet pulled from the notebook: everything the
              check-ins actually show, written in ink on paper. Interactive
              furniture (the door, the fit question) stays on the wall below. */}
          <div
            className="mt-6 rounded-[4px] p-6 sm:p-8"
            style={{ background: "var(--paper)", color: "var(--ink)", boxShadow: "0 16px 48px rgba(10, 8, 4, 0.5)" }}
          >
            <p className="font-serif text-[13px] italic" style={{ color: inkFaint }}>{tx(lang, "field notes")}</p>
            <h1 className="mt-1.5 font-serif text-[2rem] font-light leading-tight tracking-tight">{tagLabel(ev.label, lang)}</h1>
            <p className="mt-2 text-[13.5px]" style={{ color: inkSoft }}>
              {lang === "hi" ? (
                <>
                  {ev.count} बार
                  {ev.spanDays > 0 ? ` · ${ev.spanDays} ${ev.spanDays === 1 ? "दिन" : "दिनों"} में` : ""}
                  {ev.count > 0 ? ` · पहली बार ${daysAgo(new Date(ev.firstSeen).toISOString(), "hi")}` : ""}
                </>
              ) : (
                <>
                  appeared {ev.count} {ev.count === 1 ? "time" : "times"}
                  {ev.spanDays > 0 ? ` across ${ev.spanDays} ${ev.spanDays === 1 ? "day" : "days"}` : ""}
                  {ev.count > 0 ? ` · first noticed ${daysAgo(new Date(ev.firstSeen).toISOString())}` : ""}
                </>
              )}
            </p>
            <p className="mt-1 font-serif text-[14.5px] italic" style={{ color: inkSoft }}>{levelLine}</p>

            {/* When it tends to appear — real time-of-day distribution, printed in ink */}
            <div className="mt-6 border-t pt-5" style={{ borderColor: inkHair }}>
              <p className="text-[10.5px] uppercase tracking-[0.14em]" style={{ color: inkFaint }}>{tx(lang, "when it tends to appear")}</p>
              <div className="mt-4 grid grid-cols-4 gap-3">
                {TIME_LABELS.map((t) => {
                  const c = ev.times[t];
                  const h = Math.max(6, Math.round((c / timeMax) * 56));
                  const peak = ev.peakTime[0] === t && c > 0;
                  return (
                    <div key={t} className="flex flex-col items-center gap-2">
                      <div className="flex h-14 items-end">
                        <div className="w-7 rounded-t-[3px]" style={{ height: `${h}px`, background: "var(--ink)", opacity: peak ? 0.85 : 0.22, transition: "height 400ms ease" }} aria-hidden />
                      </div>
                      <p className="text-[10.5px] uppercase tracking-[0.12em]" style={{ color: peak ? inkSoft : inkFaint, fontWeight: peak ? 600 : 400 }}>{todLabel(t, lang)}</p>
                      <p className="text-[10.5px]" style={{ color: inkFaint }}>{c}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* What it arrives alongside — real co-occurrence, written as a sentence */}
            {ev.topCo.length > 0 && (
              <div className="mt-5 border-t pt-5" style={{ borderColor: inkHair }}>
                <p className="text-[10.5px] uppercase tracking-[0.14em]" style={{ color: inkFaint }}>{tx(lang, "what it arrives alongside")}</p>
                <p className="mt-2.5 text-[14px] leading-relaxed" style={{ color: inkSoft }}>
                  {ev.topCo.map((c, i) => (
                    <span key={c.label}>
                      {i === 0
                        ? (lang === "hi" ? "सबसे अक्सर " : "most often ")
                        : i === ev.topCo.length - 1
                          ? (lang === "hi" ? " और " : " and ")
                          : ", "}
                      <Link
                        to="/pattern/$tag"
                        params={{ tag: c.label }}
                        className="underline decoration-[1px] underline-offset-4 transition hover:opacity-70"
                        style={{ color: "var(--ink)", textDecorationColor: "color-mix(in oklab, var(--ink) 40%, transparent)" }}
                      >
                        {lang === "hi" ? tagLabel(c.label, "hi") : c.label.toLowerCase()}
                      </Link>
                      {` (×${c.count})`}
                    </span>
                  ))}
                  {lang === "hi" ? "।" : "."}
                </p>
              </div>
            )}

            {/* What this means / Why it matters — cautious, evidence-anchored */}
            <div className="mt-5 border-t pt-5" style={{ borderColor: inkHair }}>
              <p className="text-[10.5px] uppercase tracking-[0.14em]" style={{ color: inkFaint }}>{tx(lang, "what this might mean")}</p>
              <p className="mt-2.5 text-[14px] leading-relaxed" style={{ color: inkSoft }}>
                {lang === "hi" ? (
                  <>
                    आपके चेक-इन में, {tagLabel(ev.label, "hi")} का ज़िक्र सबसे अक्सर{" "}
                    <strong className="font-medium" style={{ color: "var(--ink)" }}>{todLabel(ev.peakTime[0] as TodLabel, "hi")}</strong>{" "}
                    के समय आया
                    {ev.topCo[0] ? <>, और इसके साथ <strong className="font-medium" style={{ color: "var(--ink)" }}>{tagLabel(ev.topCo[0].label, "hi")}</strong> का नाम {ev.topCo[0].count} बार लिया गया</> : null}।{" "}
                    यह एक लय है जिसे देखना सही है — कोई फ़ैसला नहीं, और न आपकी पूरी कहानी।
                  </>
                ) : (
                  <>
                    Across your check-ins, {ev.label.toLowerCase()} showed up most often in the{" "}
                    <strong className="font-medium" style={{ color: "var(--ink)" }}>{ev.peakTime[0].toLowerCase()}</strong>
                    {ev.topCo[0] ? <>, and <strong className="font-medium" style={{ color: "var(--ink)" }}>{ev.topCo[0].label.toLowerCase()}</strong> was named alongside it {ev.topCo[0].count} {ev.topCo[0].count === 1 ? "time" : "times"}</> : null}.
                    That's a rhythm worth noticing — not a verdict, and not the whole of you.
                  </>
                )}
              </p>
              <p className="mt-3 text-[14px] leading-relaxed" style={{ color: inkSoft }}>
                {tx(lang, "Naming when a feeling tends to arrive, and what tends to arrive with it, is how it stops running quietly in the background. You're not trying to fix it. You're just letting it be seen.")}
              </p>
            </div>

            {/* The user's own words — real excerpts, quoted in the margin */}
            {ev.excerpts.length > 0 && (
              <div className="mt-5 border-t pt-5" style={{ borderColor: inkHair }}>
                <p className="text-[10.5px] uppercase tracking-[0.14em]" style={{ color: inkFaint }}>{tx(lang, "in your own words")}</p>
                <div className="mt-3 space-y-3">
                  {ev.excerpts.map((e, i) => (
                    <div key={i} className="border-l-2 pl-3.5" style={{ borderColor: "color-mix(in oklab, var(--ink) 28%, transparent)" }}>
                      <p className="font-serif text-[14.5px] italic leading-relaxed" style={{ color: inkSoft }}>“{e.note}”</p>
                      <p className="mt-1 text-[11px]" style={{ color: inkFaint }}>{daysAgo(e.iso, lang)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-6 border-t pt-4 text-[11.5px] italic leading-relaxed" style={{ borderColor: inkHair, color: inkFaint }}>
              {lang === "hi" ? (
                <>
                  सिर्फ़ आपके अपने चेक-इन के आधार पर — {ev.count} पल
                  {ev.spanDays > 0 ? `, ${ev.spanDays} ${ev.spanDays === 1 ? "दिन" : "दिनों"} में` : ""}। कोई निदान नहीं।
                </>
              ) : (
                <>
                  based only on your own check-ins — {ev.count} {ev.count === 1 ? "moment" : "moments"}
                  {ev.spanDays > 0 ? ` across ${ev.spanDays} ${ev.spanDays === 1 ? "day" : "days"}` : ""}. not a diagnosis.
                </>
              )}
            </p>
          </div>

          {/* What you can do — one real practice, a door on the wall beneath the note */}
          <Link to={action.to} className="glass mt-5 block rounded-3xl p-5 transition hover:-translate-y-0.5">
            <p className="qs-section-label">{tx(lang, "one thing you could try")}</p>
            <div className="mt-3 flex items-center gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-background/60">
                <ActionIcon className="h-5 w-5" strokeWidth={1.6} style={{ color: "var(--accent-primary)" }} />
              </span>
              <div className="min-w-0">
                <p className="font-serif text-[17px] leading-snug">{tx(lang, action.title)}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{tx(lang, action.line)}</p>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          </Link>

          {/* Does this fit you? — you decide, InnerMate doesn't. */}
          <div className="mt-8 rounded-3xl border p-5" style={{ borderColor: "var(--border-subtle)", background: "color-mix(in oklab, var(--card) 40%, transparent)" }}>
            <p className="qs-section-label">{tx(lang, "does this fit you?")}</p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-secondary-foreground">
              {tx(lang, "This is only what your check-ins show — you know your life better than any pattern does.")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmed(true)}
                disabled={confirmed}
                className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] transition disabled:opacity-70"
                style={confirmed
                  ? { background: "color-mix(in oklab, var(--state-success) 18%, transparent)", borderColor: "color-mix(in oklab, var(--state-success) 40%, transparent)", color: "var(--text-primary)" }
                  : { background: "transparent", borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
              >
                <Check className="h-3.5 w-3.5" strokeWidth={2} /> {confirmed ? tx(lang, "noted") : tx(lang, "this fits")}
              </button>
              <button
                type="button"
                onClick={askInnerMate}
                className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] transition"
                style={{ background: "transparent", borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
              >
                <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.8} /> {tx(lang, "ask InnerMate about this")}
              </button>
              <button
                type="button"
                onClick={doHide}
                disabled={hiding}
                className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] transition disabled:opacity-60"
                style={{ background: "transparent", borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
              >
                <EyeOff className="h-3.5 w-3.5" strokeWidth={1.8} /> {tx(lang, "this doesn't fit — set it aside")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
