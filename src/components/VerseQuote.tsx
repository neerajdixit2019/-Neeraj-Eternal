import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { VERSES, type Verse, type VerseAccent } from "@/lib/verses";
import { useLang } from "@/lib/i18n";
import { tx } from "@/lib/i18n-strings";

const ACCENT_VAR: Record<VerseAccent, string> = {
  lavender: "var(--lavender)",
  rose: "var(--rose)",
  amber: "var(--amber)",
  mint: "var(--mint)",
  sky: "var(--sky)",
};

export function VerseQuote({
  initial,
  rotate = false,
  variant = "card",
  className = "",
}: {
  initial?: Verse;
  rotate?: boolean;
  /** "card" = full image background; "plain" = text only (no image) */
  variant?: "card" | "plain";
  className?: string;
}) {
  const lang = useLang();
  const start = initial ?? VERSES[0];
  const [verse, setVerse] = useState<Verse>(start);
  const [fade, setFade] = useState(true);

  const swapTo = (next: Verse) => {
    setFade(false);
    setTimeout(() => { setVerse(next); setFade(true); }, 350);
  };

  // Each visit begins somewhere new (client-only so SSR and hydration
  // agree on the initial verse), then drifts onward every 12 seconds.
  useEffect(() => {
    if (!rotate) return;
    let i = Math.floor(Math.random() * VERSES.length);
    swapTo(VERSES[i]);
    const id = setInterval(() => {
      i = (i + 1) % VERSES.length;
      swapTo(VERSES[i]);
    }, 12000);
    return () => clearInterval(id);
  }, [rotate]);

  const shuffle = () => {
    const others = VERSES.filter((v) => v.text !== verse.text);
    swapTo(others[Math.floor(Math.random() * others.length)]);
  };

  if (variant === "plain") {
    return (
      <figure className={className}>
        <blockquote
          className={`font-serif text-lg leading-relaxed transition-opacity duration-300 sm:text-xl ${fade ? "opacity-100" : "opacity-0"}`}
        >
          "{verse.text}"
        </blockquote>
        <figcaption className="mt-3 flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-muted-foreground">
          <span>— {verse.author}</span>
          {rotate && (
            <button
              type="button"
              onClick={shuffle}
              aria-label={tx(lang, "Another quote")}
              title={tx(lang, "another")}
              className="rounded-full p-1 text-muted-foreground/70 transition hover:text-foreground"
            >
              <RefreshCw className="h-3 w-3" strokeWidth={1.7} />
            </button>
          )}
        </figcaption>
      </figure>
    );
  }

  const tint = ACCENT_VAR[verse.accent];
  return (
    <figure
      className={`relative overflow-hidden rounded-3xl border border-border/50 ${className}`}
      style={{ minHeight: 220 }}
    >
      <img
        src={verse.image}
        alt=""
        aria-hidden
        loading="lazy"
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${fade ? "opacity-60" : "opacity-0"}`}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, color-mix(in oklab, ${tint} 55%, transparent), color-mix(in oklab, var(--background) 80%, transparent))`,
        }}
      />
      <div
        className={`relative p-6 sm:p-8 transition-opacity duration-300 ${fade ? "opacity-100" : "opacity-0"}`}
      >
        <span
          className="inline-block h-1.5 w-10 rounded-full"
          style={{ background: tint }}
          aria-hidden
        />
        <blockquote className="mt-4 font-serif text-xl leading-relaxed text-foreground sm:text-2xl">
          "{verse.text}"
        </blockquote>
        <figcaption className="mt-4 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          — {verse.author}
        </figcaption>
      </div>
    </figure>
  );
}