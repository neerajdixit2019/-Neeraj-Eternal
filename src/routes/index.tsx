import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { CompanionCloud } from "@/components/CompanionCloud";
import { useLang, setLang } from "@/lib/i18n";
import { tx } from "@/lib/i18n-strings";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "InnerMate — Enter your quiet space" },
      { name: "description", content: "You don't have to explain everything at once. InnerMate listens, remembers with permission, and helps you understand what is happening inside you." },
      { property: "og:title", content: "InnerMate — Enter your quiet space" },
      { property: "og:description", content: "Begin with what is here. A private companion that helps you understand your inner world." },
      { property: "og:url", content: "https://neeraj2019.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://neeraj2019.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "InnerMate",
          url: "https://neeraj2019.lovable.app",
        }),
      },
    ],
  }),
});

/** The three ways InnerMate helps — plain, not gamified. */
const VALUES = [
  { n: "1", title: "Understand", body: "Name what's here — even when it's tangled — and see it a little more clearly." },
  { n: "2", title: "Notice patterns", body: "What keeps returning becomes visible, gently, from your own words. Never a diagnosis." },
  { n: "3", title: "Move forward", body: "When you're ready, find the one small next step — not a checklist, not pressure." },
] as const;

/** How it works — three quiet beats. */
const STEPS = [
  { n: "01", title: "Begin with what's here", body: "One feeling, one sentence. You don't have to explain everything." },
  { n: "02", title: "InnerMate listens", body: "It reflects, asks one gentle question at a time, and stays at your pace." },
  { n: "03", title: "Your sky takes shape", body: "With your permission, what matters becomes a quiet constellation you can return to." },
] as const;

/** A tiny, fixed constellation preview — lives ONLY inside the etched window. */
const PREVIEW_STARS = [
  { x: 20, y: 34, r: 3.5, label: "work" },
  { x: 44, y: 20, r: 2.6, label: "" },
  { x: 62, y: 40, r: 4, label: "rest" },
  { x: 78, y: 26, r: 2.4, label: "" },
  { x: 52, y: 60, r: 3, label: "hope" },
  { x: 32, y: 66, r: 2.4, label: "" },
];

/* The brand mark (the lamplit doorway) lives in @/components/BrandMark —
 * shared with /favicon.svg and the PWA icons so the door on the tab and the
 * door on the page are the same door. */

function Landing() {
  const lang = useLang();
  return (
    <main className="relative min-h-dvh overflow-hidden">
      {/* One dark wall. The page's only pool of lamplight sits behind the hero
          CTA — no ambient starfield; stars live inside the window below. */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{
        background:
          "radial-gradient(90% 55% at 50% 24%, color-mix(in oklab, var(--lamp) 9%, transparent) 0%, transparent 62%)," +
          "var(--background-deep, var(--background))",
      }} />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-6 pb-16 pt-8 sm:px-8">
        {/* Top margin — the one quiet sign-in link */}
        <header className="flex items-center justify-between">
          <span className="flex items-center gap-2.5">
            <BrandMark size={30} />
            <span className="text-[17px] font-semibold tracking-tight text-foreground">InnerMate</span>
          </span>
          <div className="flex items-center gap-1">
            {/* Language, offered before the door — a Hindi reader is welcomed in
                Hindi from the first screen, not only after onboarding. The choice
                persists (localStorage) so login and the app inherit it. */}
            <div role="group" aria-label={tx(lang, "Choose your language")} className="mr-1 flex items-center rounded-full border p-0.5" style={{ borderColor: "var(--border-subtle)" }}>
              {(["en", "hi"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  className={`min-h-11 rounded-full px-3 text-[12.5px] transition ${lang === l ? "bg-[color-mix(in_oklab,var(--lamp)_22%,transparent)] text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {l === "en" ? "English" : "हिन्दी"}
                </button>
              ))}
            </div>
            <Link to="/login" className="inline-flex min-h-11 items-center rounded-full px-4 text-[14px] text-secondary-foreground/90 transition hover:text-foreground">
              {tx(lang, "sign in")}
            </Link>
          </div>
        </header>

        {/* Hero — one lamp, one promise, one door */}
        <section className="fade-in flex flex-1 flex-col items-center justify-center py-12 text-center">
          <CompanionCloud size={88} state="calm" />
          <h1 className="mt-7 max-w-[16ch] font-serif text-[2.15rem] font-light leading-[1.12] tracking-tight text-foreground sm:max-w-[20ch] sm:text-[3rem]">
            {tx(lang, "You don't have to explain everything at once.")}
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-secondary-foreground sm:text-[17px]">
            {tx(lang, "Begin with what is here. InnerMate listens, remembers with your permission, and helps you understand what is happening inside you.")}
          </p>
          <Link
            to="/login"
            className="qs-pill-cta group mt-9 inline-flex items-center justify-center gap-2"
            style={{ padding: "1rem 2.2rem", fontSize: "16px" }}
          >
            {tx(lang, "Enter your quiet space")}
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
          <p className="mt-6 inline-flex items-center gap-2 text-[13px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.8} />
            {tx(lang, "Private by design. Nothing is remembered without your permission.")}
          </p>
        </section>

        {/* Why — three short passages, numerals hung in the margin */}
        <section aria-labelledby="v-h" className="mt-10">
          <h2 id="v-h" className="sr-only">{tx(lang, "How InnerMate helps")}</h2>
          <div className="space-y-8">
            {VALUES.map((v) => (
              <article key={v.title} className="grid grid-cols-[3rem_1fr] gap-4 border-t pt-6" style={{ borderColor: "var(--border-subtle)" }}>
                <p aria-hidden className="font-serif text-[2rem] font-light leading-none" style={{ color: "color-mix(in oklab, var(--lamp) 55%, transparent)" }}>
                  {v.n}
                </p>
                <div>
                  <h3 className="text-[17px] font-semibold text-foreground">{tx(lang, v.title)}</h3>
                  <p className="mt-1.5 max-w-lg text-[14.5px] leading-relaxed text-secondary-foreground">{tx(lang, v.body)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* The window — an honest look into Insights */}
        <section className="mt-16 sm:mt-20">
          <div className="grid items-center gap-8 sm:grid-cols-2">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{tx(lang, "a look into Insights")}</p>
              <h2 className="mt-3 font-serif text-[1.7rem] font-light leading-snug text-foreground">
                {tx(lang, "What matters becomes a quiet constellation.")}
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-secondary-foreground">
                {tx(lang, "Not a score, not a chart pretending to measure you. Just the feelings and patterns you've named, gathered into a sky that grows as you do.")}
              </p>
            </div>
            <div className="study-window">
              <div className="relative aspect-[4/3] w-full overflow-hidden" style={{ background: "linear-gradient(180deg, oklch(0.15 0.032 268), oklch(0.135 0.030 285))" }}>
                <svg viewBox="0 0 100 75" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
                  {PREVIEW_STARS.slice(1).map((s, i) => (
                    <line key={i} x1={PREVIEW_STARS[i].x} y1={PREVIEW_STARS[i].y} x2={s.x} y2={s.y} stroke="oklch(1 0 0 / 0.16)" strokeWidth="0.4" strokeDasharray="1.5 2.5" />
                  ))}
                  {PREVIEW_STARS.map((s, i) => (
                    <g key={i}>
                      {/* CSS animation, not SMIL — SMIL ignores the reduced-motion
                          setting; this class variant honours it. */}
                      <circle
                        cx={s.x} cy={s.y} r={s.r} fill="var(--moth)" opacity="0.85"
                        className="motion-safe:animate-[qs-svg-twinkle_4.5s_ease-in-out_infinite]"
                        style={{ animationDelay: `${i * 0.6}s` }}
                      />
                      {s.label && <text x={s.x} y={s.y + s.r + 4} textAnchor="middle" fontSize="3.2" fill="oklch(0.8 0.03 290)" fontStyle="italic">{tx(lang, s.label)}</text>}
                    </g>
                  ))}
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* How it works — a numbered marginalia list */}
        <section className="mt-16 sm:mt-20">
          <h2 className="font-serif text-[1.5rem] font-light text-foreground">{tx(lang, "How InnerMate works")}</h2>
          <ol className="mt-5">
            {STEPS.map((s) => (
              <li key={s.n} className="grid grid-cols-[3rem_1fr] gap-4 border-t py-5" style={{ borderColor: "var(--border-subtle)" }}>
                <p aria-hidden className="pt-0.5 font-serif text-[13px]" style={{ color: "color-mix(in oklab, var(--lamp) 82%, transparent)" }}>{s.n}</p>
                <div>
                  <h3 className="text-[16px] font-semibold text-foreground">{tx(lang, s.title)}</h3>
                  <p className="mt-1.5 max-w-lg text-[14px] leading-relaxed text-secondary-foreground">{tx(lang, s.body)}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-8 font-serif text-[15px] italic text-muted-foreground">
            {tx(lang, "whenever you're ready — the door above is the only one you need.")}
          </p>
        </section>

        {/* The promises — legible, ruled, above the footer. Not footer dust. */}
        <div className="mt-16 border-t pt-6" style={{ borderColor: "var(--border-subtle)" }}>
          <p className="text-[13px] leading-relaxed text-secondary-foreground">
            {tx(lang, "InnerMate is a reflective companion — not a clinician, and not for emergencies. If you're in crisis, please reach a local emergency line or a trusted person right now.")}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-secondary-foreground">
            {tx(lang, "Private by design: your words stay in your account, and nothing is remembered without your permission.")}
          </p>
        </div>

        <footer className="mt-8 pb-2">
          <p className="text-[12px] text-muted-foreground/80">InnerMate · My Quiet Space</p>
        </footer>
      </div>
    </main>
  );
}
