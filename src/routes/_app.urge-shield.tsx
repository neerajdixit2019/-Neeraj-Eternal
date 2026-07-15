import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { saveJournal } from "@/lib/data.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Shield, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/_app/urge-shield")({
  component: UrgeShield,
  head: () => ({
    meta: [
      { title: "Urge Shield — a small pause | My Quiet Space" },
      { name: "description", content: "Before you check their profile or send the message, take a small pause with yourself." },
      { property: "og:title", content: "Urge Shield — a small pause" },
      { property: "og:description", content: "A gentle pause for impulsive moments. No streaks, no shame." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const BREATH_SECONDS = 10;
const WAVE_SECONDS = 90;

type Phase = "breath" | "name" | "cost" | "wave" | "done";

function UrgeShield() {
  const navigate = useNavigate();
  const save = useServerFn(saveJournal);
  const [phase, setPhase] = useState<Phase>("breath");
  const [target, setTarget] = useState("");
  const [cost, setCost] = useState("");
  const [breathLeft, setBreathLeft] = useState(BREATH_SECONDS);
  const [waveLeft, setWaveLeft] = useState(WAVE_SECONDS);
  const [saving, setSaving] = useState(false);

  useEffect(() => { track("urge_shield_started"); }, []);

  useEffect(() => {
    if (phase !== "breath") return;
    if (breathLeft <= 0) { setPhase("name"); return; }
    const t = setTimeout(() => setBreathLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, breathLeft]);

  useEffect(() => {
    if (phase !== "wave") return;
    if (waveLeft <= 0) return;
    const t = setTimeout(() => setWaveLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, waveLeft]);

  const waveMm = String(Math.floor(waveLeft / 60)).padStart(1, "0");
  const waveSs = String(waveLeft % 60).padStart(2, "0");

  const finish = async () => {
    setSaving(true);
    try {
      const body = [
        target ? `Urge: ${target}` : "Urge Shield session",
        cost ? `Cost tomorrow: ${cost}` : "",
        `The urge passed. I stayed.`,
      ].filter(Boolean).join("\n");
      await save({
        data: {
          id: null,
          title: "Urge Shield · a small pause",
          body,
          emotion_tags: ["urge_shield"],
          entry_type: "urge_shield",
        },
      });
      track("urge_shield_completed");
      setPhase("done");
    } catch (e) {
      toast.error((e as Error).message || "Could not save. The pause still counted.");
    } finally {
      setSaving(false);
    }
  };

  const exit = () => {
    toast("you paused. that counts.");
    navigate({ to: "/home" });
  };

  return (
    <div className="mx-auto max-w-xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex items-center justify-between">
        <Link to="/sos" className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">← SOS</Link>
        {phase !== "done" && (
          <button onClick={exit} className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground">
            step away
          </button>
        )}
      </div>
      <div className="mt-6 flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/70">
          <Shield className="h-4 w-4" strokeWidth={1.7} />
        </span>
        <div>
          <p className="qs-section-label">the anchor</p>
          <h1 className="mt-1 font-serif text-3xl font-light leading-tight tracking-tight">Pause before action.</h1>
        </div>
      </div>

      {phase === "breath" && (
        <div className="mt-10 flex flex-col items-center text-center">
          <div aria-hidden className="qs-shield h-36 w-36 rounded-full" />
          <p className="mt-8 font-serif text-2xl leading-snug">pause.</p>
          <p className="mt-2 text-sm text-muted-foreground">ten slow seconds before you do anything.</p>
          <p className="mt-6 font-serif text-6xl tabular-nums text-foreground/85">{breathLeft}</p>
          <button
            onClick={() => setPhase("name")}
            className="mt-8 text-xs italic text-muted-foreground/80 hover:text-foreground"
          >
            skip the breath
          </button>
        </div>
      )}

      {phase === "name" && (
        <div className="glass mt-8 rounded-[26px] p-6 sm:p-7">
          <p className="font-serif text-xl leading-snug">what's the urge?</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            one short line. when you finish, this is kept in your journal — only for you.
          </p>
          <Input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            maxLength={140}
            placeholder="text them. check their profile. send it."
            className="mt-4 h-12 rounded-2xl text-base"
          />
          <div className="mt-5 flex justify-end">
            <button className="qs-pill-cta" onClick={() => setPhase("cost")}>
              continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {phase === "cost" && (
        <div className="glass mt-8 rounded-[26px] p-6 sm:p-7">
          <p className="font-serif text-xl leading-snug">what would tomorrow-you pay for this?</p>
          <p className="mt-1.5 text-sm text-muted-foreground">no wrong answer. even a word helps.</p>
          <Textarea
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            rows={3}
            maxLength={400}
            placeholder="a day of overthinking. that heavy feeling again."
            className="mt-4 rounded-2xl"
          />
          <div className="mt-6 flex justify-end">
            <button className="qs-pill-cta" onClick={() => { setWaveLeft(WAVE_SECONDS); setPhase("wave"); }}>
              ride the wave
            </button>
          </div>
        </div>
      )}

      {phase === "wave" && (
        <div className="glass relative mt-8 overflow-hidden rounded-[26px] p-8 text-center sm:p-10">
          {/* TURNING DOWN THE LAMP — the whole room breathes with the wave:
              light dims toward the middle of the ninety seconds and re-warms
              as it passes. The numeral goes secondary; the light is the timer.
              Under reduced motion the room holds still and a dawnline fill
              carries the time. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 hidden motion-safe:block"
            style={{
              background: `radial-gradient(30rem 18rem at 50% 20%, color-mix(in oklab, var(--lamp) ${Math.round(13 - Math.sin(((WAVE_SECONDS - waveLeft) / WAVE_SECONDS) * Math.PI) * 10)}%, transparent), transparent 72%)`,
              transition: "background 1s linear",
            }}
          />
          <p className="qs-section-label relative">a wave, not a wall</p>
          <p className="relative mt-4 text-[17px] tabular-nums text-secondary-foreground" aria-live="off">{waveMm}:{waveSs}</p>
          <div className="relative mx-auto mt-5 h-1 w-56 overflow-hidden rounded-full motion-safe:hidden" style={{ background: "color-mix(in oklab, var(--dawnline) 20%, transparent)" }}>
            <div className="h-full rounded-full" style={{ width: `${Math.round(((WAVE_SECONDS - waveLeft) / WAVE_SECONDS) * 100)}%`, background: "var(--dawnline)" }} />
          </div>
          <p className="relative mx-auto mt-8 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
            it rises, peaks, and softens. you don't have to do anything with it.
          </p>
          <div className="relative mt-8 flex flex-col items-center gap-2">
            <button className="qs-pill-cta" onClick={finish} disabled={saving}>
              {saving ? "keeping…" : "the urge passed"}
            </button>
            <button
              onClick={finish}
              disabled={saving}
              className="text-xs text-muted-foreground/80 hover:text-foreground"
            >
              I'm ready
            </button>
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="glass mt-8 rounded-[26px] p-6 text-center sm:p-7">
          <p className="font-serif text-2xl leading-snug">you stayed with yourself.</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            that's it. no badge, no streak. whatever you choose next, you chose it slower.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => navigate({ to: "/home" })}>
              back to home
            </Button>
            <Button variant="ghost" className="rounded-full" onClick={() => navigate({ to: "/journal" })}>
              write a little more
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
