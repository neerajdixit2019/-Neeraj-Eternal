import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, BellOff, ArrowRight, Sparkles, Check } from "lucide-react";
import { TactileCard } from "@/components/TactileCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const PROMPTS = [
  "Name one feeling, even if it's blurry.",
  "What's one thought looping today?",
  "Where in your body is the day sitting?",
  "One thing you're carrying you could set down for two minutes.",
  "If a kind friend asked 'how are you, really?' — what's the honest line?",
  "What did you need today that you didn't ask for?",
  "One small mercy you can give yourself in the next hour.",
  "What's the softest true thing you could say about right now?",
  "Name one tiny win — even 'I made tea.' counts.",
  "What part of today felt heavier than it looked?",
  "If today were a weather, what would it be?",
  "What's one urge you noticed and didn't act on?",
  "Who or what is on your mind more than you'd like?",
  "One sentence about how you're really doing.",
];

function dayIndex() {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const diff = Date.now() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

const STORE_TIME = "innermate.checkin.time"; // "HH:MM"
const STORE_LAST = "innermate.checkin.lastFired"; // YYYY-MM-DD
const STORE_DONE = "innermate.checkin.lastDone"; // YYYY-MM-DD

export function DailyCheckinReminder() {
  const prompt = useMemo(() => PROMPTS[dayIndex() % PROMPTS.length], []);
  const [reminderTime, setReminderTime] = useState<string>("");
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [doneToday, setDoneToday] = useState(false);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Hydrate from localStorage (client only).
  useEffect(() => {
    try {
      setReminderTime(localStorage.getItem(STORE_TIME) ?? "");
      setDoneToday(localStorage.getItem(STORE_DONE) === todayKey());
    } catch { /* ignore */ }
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    } else {
      setPermission("unsupported");
    }
  }, []);

  // Schedule next reminder while tab is open (best-effort).
  useEffect(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!reminderTime || permission !== "granted") return;

    const fire = () => {
      const last = (() => { try { return localStorage.getItem(STORE_LAST); } catch { return null; } })();
      if (last !== todayKey()) {
        try {
          new Notification("InnerMate — a two-minute check-in", {
            body: "A quiet pause. No streaks, no scores.",
            tag: "innermate-checkin",
          });
          localStorage.setItem(STORE_LAST, todayKey());
        } catch { /* ignore */ }
      }
      schedule();
    };

    const schedule = () => {
      const [h, m] = reminderTime.split(":").map((n) => parseInt(n, 10));
      if (Number.isNaN(h) || Number.isNaN(m)) return;
      const next = new Date();
      next.setHours(h, m, 0, 0);
      if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
      const delay = Math.min(next.getTime() - Date.now(), 2_147_000_000);
      timerRef.current = window.setTimeout(fire, delay);
    };

    // If today's reminder time already passed and we haven't fired yet, fire soon.
    const [h, m] = reminderTime.split(":").map((n) => parseInt(n, 10));
    const todayAt = new Date(); todayAt.setHours(h || 0, m || 0, 0, 0);
    const last = (() => { try { return localStorage.getItem(STORE_LAST); } catch { return null; } })();
    if (todayAt.getTime() <= Date.now() && last !== todayKey()) {
      timerRef.current = window.setTimeout(fire, 2000);
    } else {
      schedule();
    }
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [reminderTime, permission]);

  const enableReminder = async (time: string) => {
    if (permission === "unsupported") {
      toast.message("Your browser doesn't support reminders, but the prompt is here whenever you visit.");
    } else if (permission !== "granted" && "Notification" in window) {
      const p = await Notification.requestPermission();
      setPermission(p);
      if (p !== "granted") {
        toast.message("No reminder set — you can still check in any time.");
        return;
      }
    }
    try { localStorage.setItem(STORE_TIME, time); } catch { /* ignore */ }
    setReminderTime(time);
    toast.success(`Gentle nudge set for ${time} daily.`);
  };

  const turnOff = () => {
    try { localStorage.removeItem(STORE_TIME); } catch { /* ignore */ }
    setReminderTime("");
    toast.message("Reminder off. The prompt is still here when you want it.");
  };

  const markDone = () => {
    try { localStorage.setItem(STORE_DONE, todayKey()); } catch { /* ignore */ }
    setDoneToday(true);
    setOpen(false);
    toast.success("Noted. That counted.");
  };

  return (
    <TactileCard tint="mint" className="mt-6">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background/70">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Two-minute check-in
          </p>
          <p className="mt-1.5 font-serif text-xl leading-snug">{prompt}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            A small daily pause — under two minutes. {doneToday ? "Done for today." : "No streaks, no shame."}
          </p>

          {!open ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {!doneToday && (
                <Button variant="outline" className="rounded-full" onClick={() => setOpen(true)}>
                  Start the 2-minute check-in <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              )}
              <Link to="/insights" className="soft-arrow text-sm">
                Open full check-in <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <TwoMinuteFlow prompt={prompt} onDone={markDone} onCancel={() => setOpen(false)} />
          )}

          <div className="mt-5 rounded-2xl border border-border/50 bg-background/40 p-3">
            {reminderTime ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Browser reminder at <span className="text-foreground">{reminderTime}</span>
                </span>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => enableReminder(e.target.value)}
                  className="ml-auto rounded-full border border-border/60 bg-background/70 px-3 py-1 text-sm"
                  aria-label="Change reminder time"
                />
                <button onClick={turnOff} className="soft-arrow text-xs">
                  <BellOff className="h-3.5 w-3.5" /> Turn off
                </button>
                <p className="basis-full text-[11px] leading-relaxed text-muted-foreground/80">
                  Gentle browser reminders work while this app is open or allowed by your browser. They may not appear if the tab is closed or notifications are blocked.
                </p>
              </div>
            ) : (
              <ReminderSetup onEnable={enableReminder} disabled={permission === "unsupported"} />
            )}
          </div>
        </div>
      </div>
    </TactileCard>
  );
}

function ReminderSetup({ onEnable, disabled }: { onEnable: (t: string) => void; disabled?: boolean }) {
  const [time, setTime] = useState("21:00");
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Bell className="h-4 w-4 text-muted-foreground" />
      <span className="text-muted-foreground">Gentle browser reminder at</span>
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-sm"
        aria-label="Choose reminder time"
        disabled={disabled}
      />
      <Button
        size="sm"
        variant="outline"
        className="ml-auto rounded-full"
        onClick={() => onEnable(time)}
        disabled={disabled}
      >
        Turn on
      </Button>
      <p className="basis-full text-[11px] leading-relaxed text-muted-foreground/80">
        Works while this app is open or allowed by your browser. May not appear when the tab is closed or notifications are blocked.
      </p>
    </div>
  );
}

function TwoMinuteFlow({ prompt, onDone, onCancel }: { prompt: string; onDone: () => void; onCancel: () => void }) {
  const steps = useMemo(
    () => [
      { label: "Breathe", body: "Three slow breaths. In through the nose, out through the mouth.", seconds: 30 },
      { label: "Notice", body: prompt, seconds: 45 },
      { label: "One kind line", body: "Say one kind, true sentence to yourself — out loud or silently.", seconds: 45 },
    ],
    [prompt],
  );
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(steps[0].seconds);

  useEffect(() => {
    setLeft(steps[i].seconds);
    const id = window.setInterval(() => {
      setLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [i, steps]);

  const next = () => (i < steps.length - 1 ? setI(i + 1) : onDone());

  return (
    <div className="mt-4 rounded-2xl border border-border/60 bg-background/60 p-4">
      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        Step {i + 1} of {steps.length} · {steps[i].label}
      </p>
      <p className="mt-2 font-serif text-lg leading-snug">{steps[i].body}</p>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-border/60">
        <div
          className="h-full bg-foreground/40 transition-all"
          style={{ width: `${100 - (left / steps[i].seconds) * 100}%` }}
        />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <button onClick={onCancel} className="text-xs text-muted-foreground">
          Close
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{left}s</span>
          <Button size="sm" variant="outline" className="rounded-full" onClick={next}>
            {i < steps.length - 1 ? "Next" : (<><Check className="mr-1 h-3.5 w-3.5" /> Done</>)}
          </Button>
        </div>
      </div>
    </div>
  );
}