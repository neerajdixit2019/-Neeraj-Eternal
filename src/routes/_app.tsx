import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { flushSync } from "react-dom";
import { LatchGate, Veil } from "@/components/LatchGate";
import { latchEnabled, noteHidden, readHiddenAt, clearHidden, shouldRelatch, clearPin } from "@/lib/latch";
import { clearMorningPosture } from "@/lib/morning";
import { Home, BookHeart, HeartHandshake, MessageCircle, LifeBuoy, Settings, Eye, EyeOff, Sparkles, Star, User, Phone, Hand, Wind, X } from "lucide-react";
import { usePrivacyMode } from "@/hooks/use-privacy";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProfile, listMoods } from "@/lib/data.functions";
import { roomFor, type RoomMood } from "@/lib/room-state";
import { useT } from "@/lib/i18n";
import type { StringKey } from "@/lib/i18n-strings";
import { CompanionCloud } from "@/components/CompanionCloud";

export const Route = createFileRoute("/_app")({ component: AppLayout });

// useLayoutEffect on the client so the latch gate paints before any content
// does on a cold open — a glance must not win the first frame. Plain
// useEffect on the server, where neither runs.
const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// Desktop margin — the study's table of contents. Captions reveal on
// hover/focus so the margin stays quiet.
const nav = [
  { to: "/home", k: "today", icon: Home },
  { to: "/companion", k: "companion", icon: MessageCircle },
  { to: "/journal", k: "journal", icon: BookHeart },
  { to: "/insights", k: "insights", icon: Sparkles },
  { to: "/heal", k: "tools", icon: HeartHandshake },
  { to: "/memories", k: "memories", icon: Star },
  { to: "/you", k: "you", icon: User },
] as const;

// Mobile — five real slots. The fifth is STEADY: a permanent clay door to
// help, opening the half-sheet below. Memories stays one tap away via You.
const mobileNav = [
  { to: "/home", k: "today", icon: Home },
  { to: "/companion", k: "companion", icon: MessageCircle },
  { to: "/journal", k: "journal", icon: BookHeart },
  { to: "/you", k: "you", icon: User },
] as const;

/** The Steady half-sheet — one calm door to every kind of help. */
function SteadySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const firstRef = useRef<HTMLAnchorElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    // aria-modal means it: keep Tab inside the sheet, and hand focus back to
    // the trigger when the door closes — this is a crisis surface.
    const returnTo = document.activeElement as HTMLElement | null;
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !sheetRef.current) return;
      const focusables = sheetRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      returnTo?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div ref={sheetRef} className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={t("steady.dialogLabel")}>
      <button
        type="button"
        aria-label={t("action.close")}
        onClick={onClose}
        className="absolute inset-0 bg-black/55"
      />
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-[20px] border-t px-5 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4 fade-in"
        style={{ background: "var(--card)", borderColor: "color-mix(in oklab, var(--clay) 35%, transparent)" }}
      >
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--clay)" }}>{t("steady.label")}</p>
            <button type="button" onClick={onClose} aria-label={t("action.close")} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground">
              <X className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>
          <p className="mt-1 font-serif text-[19px] font-light leading-snug">{t("steady.title")}</p>
          <div className="mt-4 space-y-2.5">
            <Link
              ref={firstRef}
              to="/sos"
              onClick={onClose}
              className="flex items-center gap-3.5 rounded-[14px_14px_8px_8px] border px-4 py-3.5 transition"
              style={{ background: "color-mix(in oklab, var(--clay) 16%, transparent)", borderColor: "color-mix(in oklab, var(--clay) 45%, transparent)" }}
            >
              <LifeBuoy className="h-5 w-5 shrink-0" strokeWidth={1.7} style={{ color: "var(--clay)" }} />
              <span>
                <span className="block text-[15px] font-semibold text-foreground">{t("steady.unsafe")}</span>
                <span className="block text-[12.5px] text-muted-foreground">{t("steady.unsafe.desc")}</span>
              </span>
            </Link>
            <a
              href="tel:14416"
              onClick={onClose}
              className="flex items-center gap-3.5 rounded-xl border px-4 py-3.5 transition"
              style={{ borderColor: "var(--border-subtle)", background: "color-mix(in oklab, var(--card) 55%, transparent)" }}
            >
              <Phone className="h-5 w-5 shrink-0" strokeWidth={1.7} style={{ color: "var(--clay)" }} />
              <span>
                <span className="block text-[15px] font-semibold text-foreground">{t("steady.call")}</span>
                <span className="block text-[12.5px] text-muted-foreground">{t("steady.call.desc")}</span>
              </span>
            </a>
            <Link
              to="/urge-shield"
              onClick={onClose}
              className="flex items-center gap-3.5 rounded-xl border px-4 py-3.5 transition"
              style={{ borderColor: "var(--border-subtle)", background: "color-mix(in oklab, var(--card) 55%, transparent)" }}
            >
              <Hand className="h-5 w-5 shrink-0" strokeWidth={1.7} style={{ color: "var(--lamp)" }} />
              <span>
                <span className="block text-[15px] font-semibold text-foreground">{t("steady.pause")}</span>
                <span className="block text-[12.5px] text-muted-foreground">{t("steady.pause.desc")}</span>
              </span>
            </Link>
            <Link
              to="/heal"
              onClick={onClose}
              className="flex items-center gap-3.5 rounded-xl border px-4 py-3.5 transition"
              style={{ borderColor: "var(--border-subtle)", background: "color-mix(in oklab, var(--card) 55%, transparent)" }}
            >
              <Wind className="h-5 w-5 shrink-0" strokeWidth={1.7} style={{ color: "var(--dawnline)" }} />
              <span>
                <span className="block text-[15px] font-semibold text-foreground">{t("steady.ground")}</span>
                <span className="block text-[12.5px] text-muted-foreground">{t("steady.ground.desc")}</span>
              </span>
            </Link>
          </div>
          <p className="mt-4 text-center text-[11.5px] leading-relaxed text-muted-foreground">
            {t("steady.footer")}
          </p>
        </div>
      </div>
    </div>
  );
}

function AppLayout() {
  const navigate = useNavigate();
  const t = useT();
  const path = useRouterState({ select: (s) => s.location.pathname });
  // The steady room answers before any gate: it carries no personal data,
  // and someone arriving in crisis — offline, signed out, whatever — must
  // never wait on an auth roundtrip or be bounced away from it.
  const isSanctuary = path === "/sos";
  const [ready, setReady] = useState(false);

  // THE LATCH — optional glance protection for a held phone. Locked on cold
  // open when armed; the veil drops when the app is hidden or loses focus
  // (best-effort against app-switcher snapshots — the platform can't
  // guarantee the race); hidden past the grace window relatches.
  // The sanctuary is exempt from all of it (render guards below).
  const [latchLocked, setLatchLocked] = useState(false);
  const [veiled, setVeiled] = useState(false);
  useClientLayoutEffect(() => {
    if (latchEnabled()) setLatchLocked(true);
  }, []);
  useEffect(() => {
    const cover = () => {
      if (!latchEnabled()) return;
      noteHidden(Date.now());
      // flushSync so the veil is in the DOM before the browser's next
      // paint opportunity — the last one a switcher snapshot might use.
      flushSync(() => setVeiled(true));
    };
    const uncover = () => {
      if (!latchEnabled()) return;
      if (shouldRelatch(readHiddenAt(), Date.now())) setLatchLocked(true);
      clearHidden();
      setVeiled(false);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") cover();
      else uncover();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", cover);
    window.addEventListener("blur", cover);
    window.addEventListener("focus", uncover);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", cover);
      window.removeEventListener("blur", cover);
      window.removeEventListener("focus", uncover);
    };
  }, []);
  const [devPreview, setDevPreview] = useState(false);
  const [steadyOpen, setSteadyOpen] = useState(false);
  const { enabled: privacy, toggle } = usePrivacyMode();
  const profileFn = useServerFn(getProfile);
  const queryClient = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => profileFn(),
    enabled: ready,
    retry: false,
  });

  const bgEnabled = (profile as { background_animation_enabled?: boolean | null } | null)?.background_animation_enabled ?? true;

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("animate-background", bgEnabled);
    document.body.classList.toggle("motion-reduced", !bgEnabled);
    return () => {
      document.body.classList.remove("animate-background");
      document.body.classList.remove("motion-reduced");
    };
  }, [bgEnabled]);

  // THE ROOM THAT RESPONDS — the atmosphere is chosen from real check-in
  // signals, and applied only when the user moves between rooms: the path is
  // the sole trigger, so the room never shifts under someone mid-view. The
  // freshest moods ride along in a ref without re-running the effect.
  const moodsFn = useServerFn(listMoods);
  const { data: roomMoods } = useQuery({
    queryKey: ["moods"],
    queryFn: () => moodsFn(),
    enabled: ready && !devPreview,
    staleTime: 60_000,
    retry: false,
  });
  const roomMoodsRef = useRef<RoomMood[] | undefined>(undefined);
  roomMoodsRef.current = roomMoods as RoomMood[] | undefined;
  useEffect(() => {
    if (typeof document === "undefined" || !ready) return;
    const room = roomFor(roomMoodsRef.current ?? [], new Date());
    document.body.setAttribute("data-room", room);
    return () => { document.body.removeAttribute("data-room"); };
  }, [path, ready]);

  useEffect(() => {
    // Dev-only walkthrough mode: view every screen without an account.
    // import.meta.env.DEV is false in production builds, so this whole
    // branch is stripped from the deployed app.
    if (import.meta.env.DEV && window.localStorage.getItem("mqs-dev-preview") === "1") {
      setDevPreview(true);
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { if (!isSanctuary) navigate({ to: "/login" }); return; }
      const { data: p, error } = await supabase.from("profiles").select("onboarding_completed").eq("id", data.session.user.id).maybeSingle();
      // A failed fetch (offline, flaky network) means "unknown", never
      // "not onboarded" — nobody gets dumped into onboarding by a dead
      // connection, and the offline sanctuary stays reachable.
      if (error) { setReady(true); return; }
      if (!p?.onboarding_completed) { navigate({ to: "/onboarding" }); return; }
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      if (!session) {
        // Every way a session ends — settings sign-out, expiry, revocation —
        // takes device-local personal state with it, so the next person to
        // sign in on a shared phone inherits nothing: not the latch key, not
        // a morning line someone left on Today.
        clearPin();
        clearMorningPosture();
        setReady(false);
        await queryClient.cancelQueries();
        queryClient.clear();
        // Never pull someone out of the steady room — signed out or not,
        // the crisis surface stays under their feet.
        if (!isSanctuary) navigate({ to: "/login", replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate, queryClient, isSanctuary]);

  // The lamp being lit — never a bare ellipsis, least of all for someone
  // arriving in distress. The sanctuary skips even this: it renders on the
  // server too, so its cached page is the real room, not a spinner.
  if (!ready && !isSanctuary) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <CompanionCloud size={72} state="calm" />
        <p className="text-[13px] text-muted-foreground">{t("app.opening")}</p>
      </div>
    );
  }

  const covered = (latchLocked || veiled) && !isSanctuary;

  return (
    <>
      {/* THE LATCH — never over the sanctuary */}
      {latchLocked && !isSanctuary && (
        <LatchGate onOpen={() => { setLatchLocked(false); clearHidden(); }} />
      )}
      {veiled && !latchLocked && !isSanctuary && <Veil />}

    {/* inert while covered: the study behind the gate leaves the tab
        order, find-in-page, and the screen-reader tree entirely */}
    <div className="min-h-screen md:flex" inert={covered || undefined}>
      {/* the first tab-stop on every page — skip the margin, reach the words */}
      <a href="#main-content" className="qs-skip-link">{t("skip.toContent")}</a>
      {/* THE MARGIN — the study's table of contents */}
      <aside className="hidden md:flex md:w-[220px] md:flex-col md:border-r md:px-4 md:py-6" style={{ borderColor: "color-mix(in oklab, var(--paper-shadow) 10%, transparent)" }}>
        <Link to="/home" className="px-3 font-serif text-[15px] font-black uppercase tracking-[0.18em]" style={{ color: "var(--foreground)" }}>
          My Quiet Space
        </Link>
        <nav className="mt-9 flex flex-col gap-0.5">
          {nav.map((n) => {
            const active = path === n.to || path.startsWith(n.to + "/");
            return (
              <Link
                key={n.to}
                to={n.to}
                className="group relative flex flex-col rounded-md px-3 py-2.5 outline-none transition focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                {/* the hung bullet in the gutter */}
                <span
                  aria-hidden
                  className="absolute -left-1 top-[17px] h-1.5 w-1.5 rounded-full transition-opacity"
                  style={{ background: "var(--lamp)", boxShadow: "0 0 8px color-mix(in oklab, var(--lamp) 60%, transparent)", opacity: active ? 1 : 0 }}
                />
                <span className="flex items-center gap-3">
                  <n.icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2 : 1.6} style={{ color: active ? "var(--foreground)" : "var(--muted-foreground)" }} />
                  <span className="text-[14px] lowercase tracking-[0.02em]" style={{ color: active ? "var(--foreground)" : "var(--muted-foreground)", fontWeight: active ? 600 : 400 }}>
                    {t(("nav." + n.k) as StringKey)}
                  </span>
                </span>
                <span className="ml-7 mt-0.5 hidden text-[11px] leading-snug text-muted-foreground/80 group-hover:block group-focus-visible:block">
                  {t(("nav." + n.k + ".desc") as StringKey)}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          <Link
            to="/sos"
            className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition hover:brightness-110"
            style={{ color: "var(--clay)" }}
          >
            <LifeBuoy className="h-4 w-4" strokeWidth={1.7} />{t("steady.label")}
          </Link>
          <Link to="/settings" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition hover:text-foreground">
            <Settings className="h-4 w-4" strokeWidth={1.6} />{t("nav.sanctuary")}
          </Link>
          <button
            onClick={toggle}
            className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition hover:text-foreground"
            aria-label={privacy ? t("privacy.disable") : t("privacy.enable")}
            title={t("privacy.note")}
          >
            {privacy ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {privacy ? t("privacy.on") : t("privacy.off")}
          </button>
        </div>
      </aside>

      <button
        onClick={toggle}
        className="fixed right-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-full border bg-background/80 text-muted-foreground shadow-sm transition hover:text-foreground md:hidden"
        style={{ borderColor: "color-mix(in oklab, var(--ember) 40%, transparent)" }}
        aria-label={privacy ? t("privacy.disable") : t("privacy.enable")}
        title={t("privacy.note")}
      >
        {privacy ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>

      {devPreview && (
        <button
          onClick={() => { window.localStorage.removeItem("mqs-dev-preview"); window.location.href = "/login"; }}
          className="fixed left-1/2 top-3 z-50 -translate-x-1/2 rounded-full border px-3.5 py-1.5 text-[11px] backdrop-blur"
          style={{
            borderColor: "color-mix(in oklab, var(--amber) 40%, transparent)",
            background: "color-mix(in oklab, var(--background) 80%, transparent)",
            color: "var(--amber)",
          }}
        >
          dev preview — nothing saves · tap to exit
        </button>
      )}
      <main id="main-content" tabIndex={-1} className={`flex-1 outline-none ${path.startsWith("/companion") ? "" : "pb-24"} md:pb-0`}>
        <Outlet />
      </main>

      {!path.startsWith("/companion") && (
        <nav
          aria-label={t("nav.primaryLabel")}
          className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t pb-[max(env(safe-area-inset-bottom),0.25rem)] md:hidden"
          style={{ borderColor: "color-mix(in oklab, var(--paper-shadow) 10%, transparent)", background: "color-mix(in oklab, var(--background) 97%, var(--foreground))" }}
        >
          {mobileNav.map((n) => {
            const active = path === n.to || path.startsWith(n.to + "/");
            return (
              <Link
                key={n.to}
                to={n.to}
                aria-current={active ? "page" : undefined}
                className={`group relative flex min-h-[58px] flex-col items-center justify-center gap-1 px-1 py-2 text-[9.5px] font-medium outline-none transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60 ${
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center transition-transform duration-200 ease-out group-active:scale-95">
                  <n.icon className="h-[20px] w-[20px]" strokeWidth={active ? 2 : 1.6} aria-hidden="true" focusable="false" />
                </span>
                <span className={`leading-none tracking-tight transition-opacity duration-200 ${active ? "opacity-100" : "opacity-70"}`}>{t(("nav." + n.k) as StringKey)}</span>
                {/* the nib-mark under the active page */}
                <span
                  aria-hidden="true"
                  className={`h-[2px] w-4 rounded-full transition-opacity duration-200 ${active ? "opacity-100" : "opacity-0"}`}
                  style={{ background: "var(--lamp)" }}
                />
              </Link>
            );
          })}
          {/* STEADY — the permanent door to help */}
          <button
            type="button"
            onClick={() => setSteadyOpen(true)}
            aria-haspopup="dialog"
            className="group relative flex min-h-[58px] flex-col items-center justify-center gap-1 px-1 py-2 text-[9.5px] font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-inset"
            style={{ color: "var(--clay)" }}
          >
            <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center transition-transform duration-200 group-active:scale-95">
              <LifeBuoy className="h-[20px] w-[20px]" strokeWidth={1.8} aria-hidden="true" focusable="false" />
            </span>
            <span className="leading-none tracking-tight">{t("nav.steady")}</span>
            <span aria-hidden="true" className="h-[2px] w-4 opacity-0" />
          </button>
        </nav>
      )}

      <SteadySheet open={steadyOpen} onClose={() => setSteadyOpen(false)} />
    </div>
    </>
  );
}
