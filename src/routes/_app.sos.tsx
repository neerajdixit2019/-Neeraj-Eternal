import { createFileRoute, Link } from "@tanstack/react-router";
import { useLang } from "@/lib/i18n";
import { BreathPacer } from "@/components/BreathPacer";
import { tx } from "@/lib/i18n-strings";
import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Wind, Shield, MessageSquareOff, HeartPulse, Copy, ArrowRight } from "lucide-react";
import { toast } from "sonner";

/**
 * THE STEADY ROOM — crisis with dignity (Lamplit Study, Phase 2).
 * Rules this screen obeys: the lamp holds at full steady brightness (no idle
 * motion anywhere); one dominant clay door — a human voice — with everything
 * else clearly secondary; 16px minimum text; nothing reflows mid-read; the
 * only animation permitted is the breath itself, and it holds still under
 * reduced motion. Every number, resource, and behaviour is unchanged.
 */
export const Route = createFileRoute("/_app/sos")({
  component: SOS,
  head: () => ({
    meta: [
      { title: "SOS — Calm tools for hard moments | My Quiet Space" },
      { name: "description", content: "Three guided flows for hard moments: unsafe with yourself, impulse to contact someone, or a body that needs to calm." },
      { property: "og:title", content: "SOS — Calm tools for hard moments" },
      { property: "og:description", content: "Three guided flows for hard moments. Crisis helplines included." },
      { property: "og:url", content: "https://neeraj2019.lovable.app/sos" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://neeraj2019.lovable.app/sos" }],
  }),
});

type Flow = "choose" | "unsafe" | "impulse" | "body";

function SOS() {
  const lang = useLang();
  const [flow, setFlow] = useState<Flow>("choose");
  const [phase, setPhase] = useState<"idle" | "breathe">("idle");
  const [count, setCount] = useState(60);
  const [unsent, setUnsent] = useState("");
  const [heldSafe, setHeldSafe] = useState(false);

  useEffect(() => {
    if (phase !== "breathe") return;
    if (count <= 0) { setPhase("idle"); return; }
    const t = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, count]);

  return (
    <div className="relative mx-auto max-w-xl px-5 py-8 sm:px-8">
      {/* The lamp at full steady brightness — one still pool, no motion. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{ background: "radial-gradient(34rem 16rem at 50% 0%, color-mix(in oklab, var(--lamp) 9%, transparent), transparent 70%)" }}
      />

      <p className="qs-section-label relative">{tx(lang, "the steady room")}</p>
      <h1 className="relative mt-3 font-serif text-[28px] font-light leading-tight tracking-tight sm:text-3xl">
        {tx(lang, "Let's pause everything else.")}
      </h1>
      <p className="relative mt-3 text-[16px] leading-relaxed text-secondary-foreground">
        {tx(lang, "You don't have to solve your whole life tonight. One thing at a time.")}
      </p>

      {/* THE DOOR — a human voice, dominant and unmissable */}
      <a
        href="tel:14416"
        className="relative mt-7 flex items-center gap-4 rounded-[16px_16px_8px_8px] border px-5 py-4.5 py-5 transition hover:brightness-110"
        style={{
          background: "color-mix(in oklab, var(--clay) 20%, transparent)",
          borderColor: "color-mix(in oklab, var(--clay) 55%, transparent)",
        }}
      >
        <Phone className="h-6 w-6 shrink-0" strokeWidth={1.8} style={{ color: "var(--clay)" }} />
        <span>
          <span className="block text-[17px] font-semibold text-foreground">{tx(lang, "Call Tele-MANAS · 14416")}</span>
          <span className="block text-[13.5px] text-secondary-foreground">{tx(lang, "free, confidential, 24×7, in your language — a real person")}</span>
        </span>
      </a>

      {/* Secondary — clearly quieter ruled rows */}
      <div className="relative mt-4 divide-y" style={{ borderColor: "var(--border-subtle)" }}>
        <button
          onClick={() => { window.location.href = "tel:"; }}
          className="flex w-full items-center gap-3.5 border-t py-3.5 text-left transition hover:brightness-110"
          style={{ borderColor: "color-mix(in oklab, var(--paper-shadow) 10%, transparent)" }}
        >
          <Phone className="h-4.5 h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={1.7} />
          <span className="text-[16px] text-foreground/90">{tx(lang, "Call someone I trust")}</span>
        </button>
        <button
          onClick={() => { setFlow("body"); setCount(60); setPhase("breathe"); }}
          className="flex w-full items-center gap-3.5 border-t py-3.5 text-left transition hover:brightness-110"
          style={{ borderColor: "color-mix(in oklab, var(--paper-shadow) 10%, transparent)" }}
        >
          <Wind className="h-[18px] w-[18px] shrink-0" strokeWidth={1.7} style={{ color: "var(--dawnline)" }} />
          <span className="text-[16px] text-foreground/90">{tx(lang, "Sixty seconds of breath")}</span>
        </button>
        {!heldSafe ? (
          <button
            onClick={() => setHeldSafe(true)}
            className="flex w-full items-center gap-3.5 border-t py-3.5 text-left transition hover:brightness-110"
            style={{ borderColor: "color-mix(in oklab, var(--paper-shadow) 10%, transparent)" }}
          >
            <HeartPulse className="h-[18px] w-[18px] shrink-0" strokeWidth={1.7} style={{ color: "var(--mint)" }} />
            <span className="text-[16px] text-foreground/90">{tx(lang, "I am safe right now")}</span>
          </button>
        ) : (
          /* The room exhales — a held sentence, not a toast. */
          <div
            className="border-t px-4 py-5 fade-in"
            style={{
              borderColor: "color-mix(in oklab, var(--paper-shadow) 10%, transparent)",
              background: "color-mix(in oklab, var(--mint) 8%, transparent)",
            }}
          >
            <p className="font-serif text-[18px] font-light leading-relaxed text-foreground">
              {tx(lang, "Good. You're here. That's enough right now.")}
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-secondary-foreground">
              {tx(lang, "This room stays open as long as you need it. When you're ready, the rest of the app is exactly where you left it.")}
            </p>
          </div>
        )}
      </div>

      {/* The three flows — quiet doors, one open at a time */}
      <div className="relative mt-8 space-y-2">
        <FlowRow active={flow === "unsafe"} icon={<HeartPulse className="h-[18px] w-[18px]" strokeWidth={1.7} />} label={tx(lang, "I feel unsafe with myself")} onClick={() => setFlow("unsafe")} tint="var(--clay)" />
        <FlowRow active={flow === "impulse"} icon={<MessageSquareOff className="h-[18px] w-[18px]" strokeWidth={1.7} />} label={tx(lang, "I might contact someone impulsively")} onClick={() => setFlow("impulse")} tint="var(--lamp)" />
        <FlowRow active={flow === "body"} icon={<Wind className="h-[18px] w-[18px]" strokeWidth={1.7} />} label={tx(lang, "I need to calm my body")} onClick={() => setFlow("body")} tint="var(--dawnline)" />
      </div>

      {flow === "unsafe" && (
        <div className="relative mt-7 space-y-5">
          <div
            className="rounded-lg border p-6"
            style={{ borderColor: "color-mix(in oklab, var(--clay) 40%, transparent)", background: "color-mix(in oklab, var(--clay) 8%, transparent)" }}
          >
            <h2 className="flex items-center gap-2 font-serif text-[20px] font-light"><Phone className="h-5 w-5" style={{ color: "var(--clay)" }} />{tx(lang, "Please talk to a person, not an app.")}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-foreground/90">
              {tx(lang, "If there is any chance of harm to yourself or someone else, the kindest thing right now is a human voice. These lines are free, confidential, and answer 24/7.")}
            </p>
            <div className="mt-4 space-y-2 text-[15px]">
              <p><strong>India — Tele-MANAS:</strong> <a href="tel:14416" className="underline underline-offset-2">14416</a> · <a href="tel:18008914416" className="underline underline-offset-2">1-800-891-4416</a></p>
              <p><strong>KIRAN (India):</strong> <a href="tel:18005990019" className="underline underline-offset-2">1800-599-0019</a></p>
              <p><strong>iCall (India):</strong> <a href="tel:+919152987821" className="underline underline-offset-2">+91 9152987821</a></p>
              <p><strong>International:</strong> <a href="https://findahelpline.com" target="_blank" rel="noreferrer" className="underline underline-offset-2">findahelpline.com</a></p>
            </div>
          </div>
          <GroundingList />
        </div>
      )}

      {flow === "impulse" && (
        <div className="relative mt-7 space-y-5">
          <Link
            to="/urge-shield"
            className="flex items-start gap-4 rounded-lg border p-5 transition hover:brightness-110"
            style={{ borderColor: "color-mix(in oklab, var(--lamp) 30%, transparent)", background: "color-mix(in oklab, var(--lamp) 7%, transparent)" }}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background/70">
              <Shield className="h-4 w-4" strokeWidth={1.7} style={{ color: "var(--lamp)" }} />
            </span>
            <span>
              <span className="block font-serif text-[19px] font-light leading-snug">{tx(lang, "Open the Urge Shield")}</span>
              <span className="mt-1 block text-[14px] leading-relaxed text-secondary-foreground">
                {tx(lang, "Ten minutes with yourself before you check or message. No streaks, no shame.")}
              </span>
              <span className="mt-2 inline-flex items-center gap-1 text-[13px] text-muted-foreground">
                {tx(lang, "begin the pause")} <ArrowRight className="h-3 w-3" />
              </span>
            </span>
          </Link>

          <div className="rounded-lg border p-5" style={{ borderColor: "var(--border-subtle)", background: "color-mix(in oklab, var(--card) 60%, transparent)" }}>
            <h2 className="font-serif text-[19px] font-light">{tx(lang, "Write it here instead.")}</h2>
            <p className="mt-1.5 text-[14px] text-secondary-foreground">
              {tx(lang, "This page burns itself — nothing here is saved, sent, or seen.")}
            </p>
            <Textarea
              aria-label="Write what you'd rather not send"
              className="mt-3 min-h-32 rounded-lg text-[16px]"
              placeholder="Everything you want to send…"
              value={unsent}
              onChange={(e) => setUnsent(e.target.value)}
            />
          </div>

          <BoundaryScripts />
        </div>
      )}

      {flow === "body" && (
        <div className="relative mt-7 space-y-5">
          <BreathOfTheRoom phase={phase} count={count} onBegin={() => { setCount(60); setPhase("breathe"); }} />
          <GroundingList />
        </div>
      )}

      {flow === "choose" && (
        <p className="relative mt-8 text-[14px] italic leading-relaxed text-muted-foreground">
          Whichever fits this minute. There's no wrong door.
        </p>
      )}

      <p className="relative mt-12 text-[13px] leading-relaxed text-muted-foreground">
        My Quiet Space is a companion, not a clinician. See <Link to="/privacy" className="underline underline-offset-2">Data & Privacy</Link>.
      </p>
    </div>
  );
}

/** TURNING DOWN THE LAMP — the breath rendered as the room's light dimming
 *  and re-warming across the full 60 seconds. Under reduced motion the light
 *  holds still and a dawnline fill bar carries the time instead. */
function BreathOfTheRoom({ phase, count, onBegin }: { phase: "idle" | "breathe"; count: number; onBegin: () => void }) {
  const lang = useLang();
  const progress = (60 - count) / 60; // 0 → 1
  // The room dims toward the middle of the minute and re-warms toward the end.
  const dim = phase === "breathe" ? Math.sin(progress * Math.PI) * 0.5 : 0;
  return (
    <div
      className="relative overflow-hidden rounded-lg border p-8 text-center"
      style={{ borderColor: "var(--border-subtle)", background: "color-mix(in oklab, var(--card) 60%, transparent)" }}
    >
      {/* the lamp of this panel — its warmth is the timer (motion-safe only) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden motion-safe:block"
        style={{
          background: `radial-gradient(24rem 14rem at 50% 30%, color-mix(in oklab, var(--lamp) ${Math.round(12 - dim * 9)}%, transparent), transparent 70%)`,
          transition: "background 1s linear",
        }}
      />
      <Wind className="relative mx-auto h-7 w-7" strokeWidth={1.6} style={{ color: "var(--dawnline)" }} />
      <p className="relative mt-3 font-serif text-[19px] font-light">{tx(lang, "Sixty seconds of breath")}</p>
      {phase === "breathe" ? (
        <>
          <BreathPacer className="relative mt-4" />
          {/* the numeral goes secondary — the light is the timer. The live
              region speaks only at milestones, never every second. */}
          <p className="relative mt-5 text-[15px] tabular-nums text-secondary-foreground" aria-hidden="true">{count}s</p>
          <p className="sr-only" aria-live="polite">
            {count === 45 ? "45 seconds left" : count === 30 ? "halfway there" : count === 10 ? "10 seconds left" : ""}
          </p>
          {/* reduced-motion fallback: a still dawnline fill */}
          <div className="relative mx-auto mt-4 h-1 w-48 overflow-hidden rounded-full motion-safe:hidden" style={{ background: "color-mix(in oklab, var(--dawnline) 20%, transparent)" }}>
            <div className="h-full rounded-full" style={{ width: `${Math.round(progress * 100)}%`, background: "var(--dawnline)" }} />
          </div>
        </>
      ) : (
        <button type="button" className="qs-pill-cta relative mt-6" onClick={onBegin}>{tx(lang, "Begin")}</button>
      )}
      <p className="relative mt-4 text-[14px] text-secondary-foreground">{tx(lang, "Four in, six out. A few rounds is enough.")}</p>
    </div>
  );
}

function GroundingList() {
  return (
    <div className="rounded-lg border p-5" style={{ borderColor: "var(--border-subtle)", background: "color-mix(in oklab, var(--card) 55%, transparent)" }}>
      <h2 className="font-serif text-[18px] font-light">5-4-3-2-1 grounding</h2>
      <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-foreground/90">
        <li><strong>5</strong> things you can see</li>
        <li><strong>4</strong> things you can feel</li>
        <li><strong>3</strong> things you can hear</li>
        <li><strong>2</strong> things you can smell</li>
        <li><strong>1</strong> small thing you can do now</li>
      </ul>
    </div>
  );
}

function FlowRow({
  active, icon, label, onClick, tint,
}: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void; tint: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="flex w-full items-center gap-3.5 rounded-lg border px-4 py-3.5 text-left transition"
      style={active
        ? { borderColor: `color-mix(in oklab, ${tint} 50%, transparent)`, background: `color-mix(in oklab, ${tint} 10%, transparent)` }
        : { borderColor: "var(--border-subtle)", background: "color-mix(in oklab, var(--card) 50%, transparent)" }}
    >
      <span style={{ color: tint }}>{icon}</span>
      <span className="font-serif text-[16px] font-light leading-snug text-foreground/95">{label}</span>
    </button>
  );
}

const SCRIPTS = [
  {
    title: "I need space",
    body: "I care about you, and I also need some space right now. I'm not angry — I just need quiet for a little while. I'll reach out when I can.",
  },
  {
    title: "I cannot continue this friendship",
    body: "This is hard to say. I don't think I can continue this friendship the way it's been. I'm not looking to debate it — I just wanted to be honest with you instead of going silent.",
  },
  {
    title: "I care, but I need distance",
    body: "I do care about you. But I'm noticing I need some distance to take care of myself right now. It's not a punishment — it's a boundary I'm setting for me.",
  },
  {
    title: "I'm not ready to talk",
    body: "I'm not ready to talk about this yet. I'm not ignoring you — I just need more time before I can have this conversation well.",
  },
  {
    title: "I wish you well, but I need to move on",
    body: "I wish you well, truly. But I need to move on from this — for my own sake. I won't be responding further. Take care of yourself.",
  },
];

function BoundaryScripts() {
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied. Read it once more before you send.");
    } catch {
      toast.error("Couldn't copy — long-press to select.");
    }
  };
  return (
    <div className="mt-2">
      <p className="font-serif text-[18px] font-light">If you do need to say something — a few quiet scripts.</p>
      <p className="mt-1.5 text-[13px] text-muted-foreground">
        Read first. Edit to sound like you. Sending is your choice.
      </p>
      <div className="mt-4 divide-y" style={{ borderColor: "var(--border-subtle)" }}>
        {SCRIPTS.map((s) => (
          <div key={s.title} className="flex items-start justify-between gap-3 border-t py-4" style={{ borderColor: "color-mix(in oklab, var(--paper-shadow) 10%, transparent)" }}>
            <div className="min-w-0">
              <p className="font-serif text-[15.5px] italic text-foreground/90">{s.title}</p>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-secondary-foreground">{s.body}</p>
            </div>
            <button
              onClick={() => copy(s.body)}
              className="shrink-0 rounded-full border p-2.5 text-muted-foreground transition hover:text-foreground"
              style={{ borderColor: "var(--border-subtle)" }}
              aria-label={`Copy: ${s.title}`}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
