import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, GitBranch, Compass, ArrowRight, ShieldCheck } from "lucide-react";
import { CompanionCloud } from "@/components/CompanionCloud";

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
  { icon: Eye, title: "Understand", body: "Name what's here — even when it's tangled — and see it a little more clearly." },
  { icon: GitBranch, title: "Notice patterns", body: "What keeps returning becomes visible, gently, from your own words. Never a diagnosis." },
  { icon: Compass, title: "Move forward", body: "When you're ready, find the one small next step — not a checklist, not pressure." },
] as const;

/** How it works — three quiet beats. */
const STEPS = [
  { n: "01", title: "Begin with what's here", body: "One feeling, one sentence. You don't have to explain everything." },
  { n: "02", title: "InnerMate listens", body: "It reflects, asks one gentle question at a time, and stays at your pace." },
  { n: "03", title: "Your sky takes shape", body: "With your permission, what matters becomes a quiet constellation you can return to." },
] as const;

/** A tiny, fixed constellation preview for the landing — decorative only. */
const PREVIEW_STARS = [
  { x: 20, y: 34, r: 3.5, label: "work" },
  { x: 44, y: 20, r: 2.6, label: "" },
  { x: 62, y: 40, r: 4, label: "rest" },
  { x: 78, y: 26, r: 2.4, label: "" },
  { x: 52, y: 60, r: 3, label: "hope" },
  { x: 32, y: 66, r: 2.4, label: "" },
];

function HeartMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="hm" x1="0" y1="0" x2="24" y2="24">
          <stop offset="0%" stopColor="oklch(0.72 0.11 300)" />
          <stop offset="100%" stopColor="oklch(0.62 0.13 288)" />
        </linearGradient>
      </defs>
      <path d="M12 20.5c-.4 0-.8-.15-1.1-.43C6.3 15.9 3.5 13.3 3.5 9.9 3.5 7.4 5.4 5.5 7.8 5.5c1.5 0 2.9.7 3.7 1.9l.5.7.5-.7c.8-1.2 2.2-1.9 3.7-1.9 2.4 0 4.3 1.9 4.3 4.4 0 3.4-2.8 6-7.4 10.17-.3.28-.7.43-1.1.43Z" fill="url(#hm)" />
      <circle cx="18.5" cy="6" r="1.1" fill="oklch(0.86 0.06 85)" />
    </svg>
  );
}

function Landing() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      {/* Cosmic backdrop — self-contained so the landing is premium on its own */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{
        background:
          "radial-gradient(120% 80% at 50% -10%, oklch(0.22 0.05 285) 0%, transparent 55%)," +
          "radial-gradient(90% 60% at 85% 110%, color-mix(in oklab, var(--violet) 18%, transparent) 0%, transparent 60%)," +
          "var(--background-deep, var(--background))",
      }} />
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {PREVIEW_STARS.concat(
          Array.from({ length: 30 }, (_, i) => ({ x: (i * 37) % 100, y: (i * 53) % 100, r: 1 + (i % 3) * 0.5, label: "" })),
        ).map((s, i) => (
          <span key={i} className="absolute rounded-full motion-safe:animate-[qs-twinkle_6s_ease-in-out_infinite]"
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.r, height: s.r, background: "oklch(0.95 0.01 90)", opacity: 0.18 + (i % 4) * 0.08, animationDelay: `${(i % 6) * 0.7}s` }} />
        ))}
      </div>

      <div className="relative mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-6 pb-16 pt-8 sm:px-8">
        {/* Top bar */}
        <header className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <HeartMark />
            <span className="text-[17px] font-semibold tracking-tight text-foreground">InnerMate</span>
          </span>
          <Link to="/login" className="rounded-full px-4 py-2 text-[14px] text-secondary-foreground/90 transition hover:text-foreground">
            Sign in
          </Link>
        </header>

        {/* Hero — fits the viewport on mobile */}
        <section className="fade-in flex flex-1 flex-col items-center justify-center py-10 text-center">
          <CompanionCloud size={88} state="calm" />
          <h1 className="mt-7 max-w-[16ch] font-serif text-[2.15rem] font-light leading-[1.12] tracking-tight text-foreground sm:max-w-[20ch] sm:text-[3rem]">
            You don't have to explain everything at once.
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-secondary-foreground sm:text-[17px]">
            Begin with what is here. InnerMate listens, remembers with your permission,
            and helps you understand what is happening inside you.
          </p>
          <div className="mt-8 flex w-full max-w-sm flex-col items-center gap-3">
            <Link to="/login" className="cta-glow group inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary px-8 text-[16px] font-medium text-primary-foreground transition hover:brightness-110">
              Enter your quiet space
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <Link to="/login" className="inline-flex h-11 items-center justify-center rounded-full px-5 text-[14px] text-secondary-foreground/90 transition hover:text-foreground">
              I already have an account
            </Link>
          </div>
          <p className="mt-6 inline-flex items-center gap-2 text-[13px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.8} />
            Private by design. Nothing is remembered without your permission.
          </p>
        </section>

        {/* Three value areas */}
        <section aria-labelledby="v-h" className="mt-8">
          <h2 id="v-h" className="sr-only">How InnerMate helps</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {VALUES.map((v) => (
              <article key={v.title} className="rounded-3xl border p-6"
                style={{ borderColor: "var(--border-subtle)", background: "color-mix(in oklab, var(--surface-primary, var(--card)) 55%, transparent)" }}>
                <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "color-mix(in oklab, var(--violet) 18%, transparent)" }}>
                  <v.icon className="h-5 w-5" strokeWidth={1.7} style={{ color: "oklch(0.82 0.08 295)" }} />
                </span>
                <h3 className="mt-4 text-[17px] font-semibold text-foreground">{v.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-secondary-foreground">{v.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Constellation preview */}
        <section className="mt-14 sm:mt-20">
          <div className="grid items-center gap-8 sm:grid-cols-2">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Your inner sky</p>
              <h2 className="mt-3 font-serif text-[1.7rem] font-light leading-snug text-foreground">
                What matters becomes a quiet constellation.
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-secondary-foreground">
                Not a score, not a chart pretending to measure you. Just the feelings and
                patterns you've named, gathered into a sky that grows as you do.
              </p>
            </div>
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border" style={{ borderColor: "var(--border-subtle)", background: "linear-gradient(180deg, oklch(0.15 0.032 268), oklch(0.135 0.030 285))" }}>
              <svg viewBox="0 0 100 75" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
                {PREVIEW_STARS.slice(1).map((s, i) => (
                  <line key={i} x1={PREVIEW_STARS[i].x} y1={PREVIEW_STARS[i].y} x2={s.x} y2={s.y} stroke="oklch(1 0 0 / 0.16)" strokeWidth="0.4" strokeDasharray="1.5 2.5" />
                ))}
                {PREVIEW_STARS.map((s, i) => (
                  <g key={i}>
                    <circle cx={s.x} cy={s.y} r={s.r} fill="var(--violet)" opacity="0.85">
                      <animate attributeName="opacity" values="0.55;1;0.55" dur="4.5s" begin={`${i * 0.6}s`} repeatCount="indefinite" />
                    </circle>
                    {s.label && <text x={s.x} y={s.y + s.r + 4} textAnchor="middle" fontSize="3.2" fill="oklch(0.8 0.03 290)" fontStyle="italic">{s.label}</text>}
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mt-16 sm:mt-24">
          <h2 className="text-center font-serif text-[1.5rem] font-light text-foreground">How InnerMate works</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-3xl border p-6" style={{ borderColor: "var(--border-subtle)", background: "color-mix(in oklab, var(--surface-primary, var(--card)) 45%, transparent)" }}>
                <p className="font-serif text-[13px] text-muted-foreground">{s.n}</p>
                <h3 className="mt-2 text-[16px] font-semibold text-foreground">{s.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-secondary-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="mt-16 flex flex-col items-center rounded-[2rem] border px-6 py-12 text-center sm:mt-24"
          style={{ borderColor: "var(--border-subtle)", background: "radial-gradient(120% 120% at 50% 0%, color-mix(in oklab, var(--violet) 16%, transparent), transparent 65%)" }}>
          <CompanionCloud size={64} state="listening" />
          <h2 className="mt-5 font-serif text-[1.7rem] font-light leading-snug text-foreground">Whenever you're ready.</h2>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-secondary-foreground">
            No pressure to perform, explain, or be okay. Just a quiet place to begin.
          </p>
          <Link to="/login" className="cta-glow mt-7 inline-flex h-14 items-center justify-center gap-2 rounded-full bg-primary px-8 text-[16px] font-medium text-primary-foreground transition hover:brightness-110">
            Enter your quiet space <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        <footer className="mt-16 border-t pt-8 text-center" style={{ borderColor: "var(--border-subtle)" }}>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            InnerMate is a reflective companion — not a clinician, and not for emergencies.
          </p>
          <p className="mt-2 text-[12px] text-muted-foreground/80">
            If you're in crisis, please reach a local emergency line or a trusted person right now.
          </p>
        </footer>
      </div>
    </main>
  );
}
