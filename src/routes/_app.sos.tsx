import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TactileCard } from "@/components/TactileCard";
import { Phone, Wind, Shield, MessageSquareOff, HeartPulse, Copy, ArrowRight } from "lucide-react";
import { toast } from "sonner";

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
  const [flow, setFlow] = useState<Flow>("choose");
  const [phase, setPhase] = useState<"idle" | "breathe">("idle");
  const [count, setCount] = useState(60);
  const [unsent, setUnsent] = useState("");

  useEffect(() => {
    if (phase !== "breathe") return;
    if (count <= 0) { setPhase("idle"); return; }
    const t = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, count]);

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
      <h1 className="font-serif text-3xl">You are here. That's enough for now.</h1>
      <p className="mt-2 text-muted-foreground">
        You don't have to solve your whole life tonight. Pick the one that fits this minute.
      </p>

      {/* Immediate action buttons — large, tappable, no reading required */}
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <a
          href="tel:14416"
          className="flex items-center justify-center gap-2 rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive ring-1 ring-destructive/30 transition hover:bg-destructive/15"
        >
          <Phone className="h-4 w-4" /> Call Tele-MANAS (14416)
        </a>
        <button
          onClick={() => {
            if (typeof window !== "undefined" && "contacts" in navigator) {
              window.location.href = "tel:";
            } else {
              window.location.href = "tel:";
            }
          }}
          className="flex items-center justify-center gap-2 rounded-2xl bg-card/70 px-4 py-3 text-sm font-medium text-foreground ring-1 ring-border/60 transition hover:bg-card"
        >
          <Phone className="h-4 w-4" /> Call someone I trust
        </button>
        <button
          onClick={() => { setFlow("body"); setCount(60); setPhase("breathe"); }}
          className="flex items-center justify-center gap-2 rounded-2xl bg-card/70 px-4 py-3 text-sm font-medium text-foreground ring-1 ring-border/60 transition hover:bg-card"
        >
          <Wind className="h-4 w-4" /> 60-second grounding
        </button>
        <button
          onClick={() => toast.success("Good. You're here. That's enough right now.")}
          className="flex items-center justify-center gap-2 rounded-2xl bg-card/70 px-4 py-3 text-sm font-medium text-foreground ring-1 ring-border/60 transition hover:bg-card"
        >
          <HeartPulse className="h-4 w-4" /> I am safe right now
        </button>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <FlowButton
          active={flow === "unsafe"}
          icon={<HeartPulse className="h-4 w-4" />}
          label="I feel unsafe with myself"
          onClick={() => setFlow("unsafe")}
          tone="rose"
        />
        <FlowButton
          active={flow === "impulse"}
          icon={<MessageSquareOff className="h-4 w-4" />}
          label="I might contact someone impulsively"
          onClick={() => setFlow("impulse")}
          tone="amber"
        />
        <FlowButton
          active={flow === "body"}
          icon={<Wind className="h-4 w-4" />}
          label="I need to calm my body"
          onClick={() => setFlow("body")}
          tone="sky"
        />
      </div>

      {flow === "choose" && (
        <p className="mt-8 text-center text-sm italic text-muted-foreground">
          Tap one above. Each opens a different short flow.
        </p>
      )}

      {flow === "unsafe" && (
        <div className="mt-8 space-y-5">
          <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6">
            <h2 className="flex items-center gap-2 font-serif text-xl"><Phone className="h-5 w-5" />Please talk to a person, not an app.</h2>
            <p className="mt-2 text-sm leading-relaxed">
              If there is any chance of harm to yourself or someone else, the kindest thing right now is a
              human voice. These lines are free, confidential, and answer 24/7.
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <p><strong>India — Tele-MANAS:</strong> <a href="tel:14416" className="underline">14416</a> · <a href="tel:18008914416" className="underline">1-800-891-4416</a></p>
              <p><strong>iCall (India):</strong> <a href="tel:+919152987821" className="underline">+91 9152987821</a></p>
              <p><strong>International:</strong> <a href="https://findahelpline.com" target="_blank" rel="noreferrer" className="underline">findahelpline.com</a></p>
            </div>
          </div>
          <TactileCard tint="sky">
            <h3 className="font-serif text-lg">While you wait — 5-4-3-2-1 grounding</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li><strong>5</strong> things you can see</li>
              <li><strong>4</strong> things you can feel</li>
              <li><strong>3</strong> things you can hear</li>
              <li><strong>2</strong> things you can smell</li>
              <li><strong>1</strong> small thing you can do now</li>
            </ul>
          </TactileCard>
        </div>
      )}

      {flow === "impulse" && (
        <div className="mt-8 space-y-5">
          <Link to="/urge-shield" className="block">
            <TactileCard tint="amber" className="transition hover:-translate-y-0.5">
              <div className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background/70">
                  <Shield className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-serif text-xl leading-snug">Open Urge Shield</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    Ten minutes with yourself before you check or message. No streaks, no shame.
                  </p>
                  <p className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    Begin the pause <ArrowRight className="h-3 w-3" />
                  </p>
                </div>
              </div>
            </TactileCard>
          </Link>

          <TactileCard tint="mint">
            <h2 className="font-serif text-xl">Write it here instead.</h2>
            <p className="mt-2 text-sm text-muted-foreground">Nobody will see this. It is not saved.</p>
            <Textarea
              aria-label="Write what you'd rather not send"
              className="mt-3 min-h-32 rounded-2xl"
              placeholder="Everything you want to send…"
              value={unsent}
              onChange={(e) => setUnsent(e.target.value)}
            />
          </TactileCard>

          <BoundaryScripts />
        </div>
      )}

      {flow === "body" && (
        <div className="mt-8 space-y-5">
          <div className="gradient-soft rounded-3xl p-8 text-center">
            <Wind className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-3 font-serif text-xl">60-second breath</p>
            {phase === "breathe" ? (
              <p className="mt-6 font-serif text-6xl tabular-nums">{count}</p>
            ) : (
              <Button className="mt-6 rounded-full" onClick={() => { setCount(60); setPhase("breathe"); }}>Begin</Button>
            )}
            <p className="mt-3 text-xs text-muted-foreground">In for 4, hold 4, out for 6. Slowly.</p>
          </div>
          <TactileCard tint="sky">
            <h3 className="font-serif text-lg">5-4-3-2-1 grounding</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li><strong>5</strong> things you can see</li>
              <li><strong>4</strong> things you can feel</li>
              <li><strong>3</strong> things you can hear</li>
              <li><strong>2</strong> things you can smell</li>
              <li><strong>1</strong> small thing you can do now</li>
            </ul>
          </TactileCard>
        </div>
      )}

      <p className="mt-12 text-center text-[12px] text-muted-foreground">
        My Quiet Space is a companion, not a clinician. See <Link to="/privacy" className="underline">Data & Privacy</Link>.
      </p>
    </div>
  );
}

function FlowButton({
  active, icon, label, onClick, tone,
}: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void; tone: "rose" | "amber" | "sky" }) {
  const tint = tone === "rose" ? "var(--rose)" : tone === "amber" ? "var(--amber)" : "var(--sky)";
  return (
    <button
      onClick={onClick}
      className={`tactile flex flex-col items-start gap-3 p-4 text-left text-sm transition hover:-translate-y-0.5 ${active ? "ring-2 ring-primary/40" : ""}`}
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full"
        style={{ background: `color-mix(in oklab, ${tint} 45%, transparent)` }}
      >
        {icon}
      </span>
      <span className="font-serif text-[15px] leading-snug">{label}</span>
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
      <p className="font-serif text-lg">If you do need to say something — a few quiet scripts.</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Read first. Edit to sound like you. Sending is your choice.
      </p>
      <div className="mt-4 space-y-3">
        {SCRIPTS.map((s) => (
          <TactileCard key={s.title} tint="lavender">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-serif text-[15px] italic text-foreground/85">{s.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
              <button
                onClick={() => copy(s.body)}
                className="shrink-0 rounded-full border border-border/60 bg-background/60 p-2 text-muted-foreground transition hover:text-foreground"
                aria-label={`Copy: ${s.title}`}
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </TactileCard>
        ))}
      </div>
    </div>
  );
}