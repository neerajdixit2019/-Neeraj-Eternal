import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, HeartPulse, BookHeart, ArrowRight, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "My Quiet Space — A private place to pause and reflect" },
      { name: "description", content: "A private place to pause, write, and feel a little clearer. Mood check-in, journaling, and calm tools — no account needed to begin." },
      { property: "og:title", content: "My Quiet Space — A private place to pause and reflect" },
      { property: "og:description", content: "A private place to pause, write, and feel a little clearer. Mood check-in, journaling, and calm tools — no account needed to begin." },
      { property: "og:url", content: "https://neeraj2019.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://neeraj2019.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "My Quiet Space",
          url: "https://neeraj2019.lovable.app",
        }),
      },
    ],
  }),
});

const VALUE_CARDS = [
  {
    icon: MessageCircle,
    title: "Talk to InnerMate",
    body: "A gentle companion who listens — never judges, never rushes.",
    tint: "var(--lavender)",
  },
  {
    icon: HeartPulse,
    title: "Track your mood",
    body: "One minute, no streaks. Notice how the week is actually moving.",
    tint: "var(--rose)",
  },
  {
    icon: BookHeart,
    title: "Reflect privately",
    body: "Write what you couldn't say out loud. Yours alone.",
    tint: "var(--sky)",
  },
] as const;

function Landing() {
  return (
    <main className="relative min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 pb-16 pt-10 sm:px-8 sm:pt-16">
        {/* Hero */}
        <section className="fade-in flex flex-col items-center text-center">
          <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground" style={{ textShadow: "0 1px 8px oklch(0 0 0 / 0.5)" }}>
            My Quiet Space
          </p>
          <h1 className="mt-5 font-serif text-[2.1rem] font-light leading-[1.1] tracking-tight text-foreground sm:text-[2.75rem]" style={{ textShadow: "0 2px 16px oklch(0 0 0 / 0.35)" }}>
            A quiet space to understand
            <br className="hidden sm:block" />{" "}
            <span className="italic text-primary/85">what you feel.</span>
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground" style={{ textShadow: "0 1px 10px oklch(0 0 0 / 0.4)" }}>
            A private room inside your phone — for the days that feel heavy,
            tender, or simply too much to hold alone.
          </p>

          <div className="mt-9 flex w-full max-w-sm flex-col items-center gap-3">
            <Link
              to="/login"
              className="cta-glow group inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary px-8 text-[15px] font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Enter My Quiet Space
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm text-muted-foreground transition hover:text-foreground"
            >
              See how it works
            </a>
          </div>
        </section>

        {/* Value cards */}
        <section
          id="how-it-works"
          aria-labelledby="value-heading"
          className="mt-16 sm:mt-24"
        >
          <h2
            id="value-heading"
            className="sr-only"
          >
            What you can do here
          </h2>
          <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            {VALUE_CARDS.map((c, i) => (
              <article
                key={c.title}
                className="tactile flex flex-col gap-3 p-6"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full"
                  style={{
                    background: `color-mix(in oklab, ${c.tint} 55%, transparent)`,
                  }}
                  aria-hidden="true"
                >
                  <c.icon className="h-5 w-5 text-foreground/80" />
                </span>
                <h3 className="font-serif text-[17px] font-medium leading-snug text-foreground">
                  {c.title}
                </h3>
                <p className="text-[14px] leading-relaxed text-muted-foreground">
                  {c.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Trust */}
        <section className="mt-14 flex flex-col items-center text-center fade-in sm:mt-20">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary"
            aria-hidden="true"
          >
            <ShieldCheck className="h-4 w-4 text-primary/80" />
          </span>
          <p className="mt-4 max-w-sm font-serif text-[17px] italic leading-relaxed text-foreground/85">
            Private by design. Not therapy. Not judgment. Just space.
          </p>
          <p className="mt-3 max-w-xs text-[11.5px] leading-relaxed text-muted-foreground/80">
            InnerMate is a reflective companion — not a clinician, and not for
            emergencies.
          </p>
        </section>

        <div className="mt-auto pt-12 text-center">
          <p className="font-serif text-[13px] italic text-muted-foreground/60">
            Made for the moments between feeling something and doing something about it.
          </p>
        </div>
      </div>
    </main>
  );
}
