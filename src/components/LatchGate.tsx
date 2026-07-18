import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { HeartHandshake, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { verifyPin, attemptDelayMs, clearPin, readMisses, noteMiss, clearMisses } from "@/lib/latch";
import { useLang } from "@/lib/i18n";
import { tx } from "@/lib/i18n-strings";

/**
 * The latch's door — a full-screen paper gate over the study.
 *
 * Two doors are ALWAYS open, whatever the key: the steady room (crisis
 * beats privacy, /sos is never latched) and signing out (the account is
 * the real lock; the latch only keeps glances out). Wrong tries are paced
 * gently — slowed, never barred — and the count survives reloads so the
 * pacing can't be reset by bouncing through a door.
 *
 * Sign-out clears the latch only AFTER it succeeds: clearing first would
 * let two offline taps disarm the latch while the session stayed alive.
 * Tab is trapped inside the gate (the app behind it is also inert).
 */
export function LatchGate({ onOpen }: { onOpen: () => void }) {
  const lang = useLang();
  const [pin, setPin] = useState("");
  const [misses, setMisses] = useState(() => 0);
  const [checking, setChecking] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const gateRef = useRef<HTMLDivElement>(null);
  // Refs, not effect state: an attempt must survive its own re-renders —
  // an effect keyed on `checking` would cancel the very work it started.
  const missesRef = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
    missesRef.current = readMisses();
    setMisses(missesRef.current);
    inputRef.current?.focus();
  }, []);

  const submit = async (candidate: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setChecking(true);
    const wait = attemptDelayMs(missesRef.current);
    if (wait) await new Promise((r) => setTimeout(r, wait));
    if (await verifyPin(candidate)) {
      clearMisses();
      onOpen();
      return;
    }
    missesRef.current = noteMiss();
    setMisses(missesRef.current);
    setPin("");
    setChecking(false);
    busyRef.current = false;
    inputRef.current?.focus();
  };

  const onPinChange = (value: string) => {
    if (busyRef.current) return;
    const next = value.replace(/\D/g, "").slice(0, 4);
    setPin(next);
    if (next.length === 4) void submit(next);
  };

  const signOut = () => {
    void supabase.auth.signOut().then(({ error }) => {
      if (error) {
        // Couldn't reach the server (offline?) — the latch stays armed.
        setSignOutFailed(true);
        return;
      }
      // The account is the real lock. Once it's re-proved by signing in
      // again, a forgotten latch must not bar the door — so it goes too.
      clearPin();
      window.location.replace("/login");
    });
  };

  // The gate is modal for real: Tab cycles its three doors and never
  // wanders into the covered study. Escape stays a no-op — there is
  // nothing safe to escape to.
  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const focusables = gateRef.current?.querySelectorAll<HTMLElement>("input, a[href], button");
    if (!focusables || focusables.length === 0) return;
    const list = [...focusables];
    const first = list[0];
    const last = list[list.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      ref={gateRef}
      onKeyDown={trapTab}
      className="fixed inset-0 z-[95] flex min-h-screen items-center justify-center px-5"
      style={{ background: "var(--background)" }}
      role="dialog"
      aria-modal="true"
      aria-label={tx(lang, "The latch")}
    >
      <div className="w-full max-w-sm text-center">
        <p className="qs-section-label">{tx(lang, "the latch")}</p>
        <h1 className="mt-3 font-serif text-[26px] font-light leading-tight tracking-tight">
          {tx(lang, "This room is latched.")}
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
          {tx(lang, "Your four-digit key opens it. It keeps glances out on this device — your words are already protected by your account.")}
        </p>

        <label htmlFor="latch-pin" className="sr-only">{tx(lang, "Your four-digit key")}</label>
        <input
          ref={inputRef}
          id="latch-pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={pin}
          readOnly={checking}
          onChange={(e) => onPinChange(e.target.value)}
          className="mt-6 h-14 w-40 rounded-xl border bg-transparent text-center font-serif text-[28px] tracking-[0.5em]"
          style={{ borderColor: "var(--border-subtle)", caretColor: "var(--lamp)" }}
        />
        {misses > 0 && !checking && (
          <p className="mt-3 text-[12.5px] italic text-muted-foreground" role="status">
            {tx(lang, "Not that one. Take your time — this door never locks for good.")}
          </p>
        )}
        {checking && pin.length === 4 && (
          <p className="mt-3 text-[12.5px] italic text-muted-foreground" role="status">
            {tx(lang, "a moment…")}
          </p>
        )}
        {signOutFailed && (
          <p className="mt-3 text-[12.5px] italic text-muted-foreground" role="status">
            {tx(lang, "Couldn't sign out just now — maybe offline. The latch stays on.")}
          </p>
        )}

        <div className="mt-9 space-y-1">
          <Link
            to="/sos"
            className="flex min-h-11 items-center justify-center gap-2.5 border-t py-3 text-[14px] transition hover:brightness-110"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <HeartHandshake className="h-4 w-4" strokeWidth={1.7} style={{ color: "var(--clay)" }} />
            {tx(lang, "Need steadying first? The steady room is never latched.")}
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="flex min-h-11 w-full items-center justify-center gap-2.5 border-t py-3 text-[13px] text-muted-foreground transition hover:text-foreground"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <LogOut className="h-4 w-4" strokeWidth={1.7} />
            {tx(lang, "Can't get in? Sign out — signing back in removes the latch.")}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The veil — an instant, fully opaque cover dropped while the app is
 * hidden (app switcher, a handed-over phone). No content, no motion.
 * Best-effort: the platform gives no guarantee a switcher snapshot is
 * taken after our paint, so this narrows the window rather than closing it.
 */
export function Veil() {
  return (
    <div
      className="fixed inset-0 z-[94]"
      style={{ background: "var(--background)" }}
      aria-hidden="true"
    />
  );
}
