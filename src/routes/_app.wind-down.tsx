import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { saveWindDown } from "@/lib/memories.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/wind-down")({
  component: WindDown,
  head: () => ({
    meta: [
      { title: "Wind down | My Quiet Space" },
      { name: "description", content: "A short, gentle wind-down before sleep — three breaths and one line to set down." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Phase = "breath" | "write" | "rest";

function WindDown() {
  const [phase, setPhase] = useState<Phase>("breath");
  const [line, setLine] = useState("");
  const [saving, setSaving] = useState(false);
  const save = useServerFn(saveWindDown);
  const navigate = useNavigate();

  // Auto-advance breathing after ~45s (4 in / 6 out × ~4.5 cycles).
  useEffect(() => {
    if (phase !== "breath") return;
    const t = setTimeout(() => setPhase("write"), 45000);
    return () => clearTimeout(t);
  }, [phase]);

  const submitLine = async () => {
    const v = line.trim();
    if (!v) {
      setPhase("rest");
      return;
    }
    setSaving(true);
    try {
      await save({ data: { line: v } });
      setPhase("rest");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6 text-center">
      {/* the drawn window at night — no photograph, no third sky: the same
          nightwall the whole study lives in, with one dawnline horizon */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 112%, color-mix(in oklab, var(--dawnline) 14%, transparent) 0%, transparent 55%)," +
            "linear-gradient(185deg, var(--background-deep) 10%, oklch(0.155 0.03 274) 60%, oklch(0.18 0.028 280) 100%)",
        }}
      />
      <Link to="/home" className="absolute right-5 top-5 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
        close
      </Link>
      <div className="pointer-events-none absolute inset-x-0 top-7 px-16">
        <p className="qs-section-label">the anchor · for the end of the day</p>
        <h1 className="mt-1.5 font-serif text-lg font-light text-foreground/80">Night reset</h1>
      </div>

      {phase === "breath" && (
        <div className="flex flex-col items-center">
          <div className="winddown-breath" aria-hidden />
          <p className="mt-10 font-serif text-xl text-foreground/80">Breathe in… and out.</p>
          <p className="mt-2 text-sm text-muted-foreground">Four in, six out. A few rounds is enough.</p>
          <button
            onClick={() => setPhase("write")}
            className="mt-10 text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
          >
            Continue
          </button>
        </div>
      )}

      {phase === "write" && (
        <div className="w-full max-w-md">
          <p className="font-serif text-2xl leading-snug text-foreground/90">
            What's one thing you want to set down before sleep?
          </p>
          <Textarea
            value={line}
            onChange={(e) => setLine(e.target.value)}
            aria-label="One thing to set down before sleep"
            placeholder="A sentence. Or none — that's allowed."
            maxLength={500}
            rows={3}
            className="mt-6 rounded-2xl border-border/60 bg-background/60 font-serif text-[16px] leading-relaxed"
            disabled={saving}
            autoFocus
          />
          <div className="mt-5 flex items-center justify-center gap-3">
            <Button variant="ghost" className="rounded-full text-muted-foreground" disabled={saving} onClick={() => setPhase("rest")}>
              Nothing tonight
            </Button>
            <Button variant="outline" className="rounded-full" disabled={saving} onClick={submitLine}>
              {saving ? "Setting it down…" : "Set it down"}
            </Button>
          </div>
        </div>
      )}

      {phase === "rest" && (
        <div className="flex flex-col items-center">
          <p className="font-serif text-3xl leading-snug text-foreground/90">It's held.</p>
          <p className="mt-3 font-serif text-lg italic text-muted-foreground">Rest now.</p>
          <Link
            to="/home"
            className="mt-12 text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
            onClick={() => navigate({ to: "/home" })}
          >
            back home
          </Link>
        </div>
      )}
    </div>
  );
}