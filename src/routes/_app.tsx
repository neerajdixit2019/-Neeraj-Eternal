import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Home, BookHeart, HeartHandshake, MessageCircle, LifeBuoy, Settings, Eye, EyeOff, Sparkles, Star, User, Phone, Hand, Wind, X } from "lucide-react";
import { usePrivacyMode } from "@/hooks/use-privacy";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProfile, listMoods } from "@/lib/data.functions";
import { roomFor, type RoomMood } from "@/lib/room-state";
import { CompanionCloud } from "@/components/CompanionCloud";

export const Route = createFileRoute("/_app")({ component: AppLayout });

// Desktop margin — the study's table of contents. Captions reveal on
// hover/focus so the margin stays quiet.
const nav = [
  { to: "/home", label: "today", icon: Home, desc: "how you're arriving" },
  { to: "/companion", label: "innermate", icon: MessageCircle, desc: "the companion" },
  { to: "/journal", label: "journal", icon: BookHeart, desc: "your private vault" },
  { to: "/insights", label: "insights", icon: Sparkles, desc: "check-in & your patterns" },
  { to: "/heal", label: "tools", icon: HeartHandshake, desc: "practices & gentle paths" },
  { to: "/memories", label: "memories", icon: Star, desc: "what you've kept" },
  { to: "/you", label: "you", icon: User, desc: "your week & controls" },
] as const;

// Mobile — five real slots. The fifth is STEADY: a permanent clay door to
// help, opening the half-sheet below. Memories stays one tap away via You.
const mobileNav = [
  { to: "/home", label: "Today", icon: Home },
  { to: "/companion", label: "InnerMate", icon: MessageCircle },
  { to: "/journal", label: "Journal", icon: BookHeart },
  { to: "/you", label: "You", icon: User },
] as const;

/** The Steady half-sheet — one calm door to every kind of help. */
function SteadySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
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
    <div ref={sheetRef} className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Steady — help right now">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/55"
      />
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-[20px] border-t px-5 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4 fade-in"
        style={{ background: "var(--card)", borderColor: "color-mix(in oklab, var(--clay) 35%, transparent)" }}
      >
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--clay)" }}>steady</p>
            <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground">
              <X className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>
          <p className="mt-1 font-serif text-[19px] font-light leading-snug">Whatever is happening, there's a door here.</p>
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
                <span className="block text-[15px] font-semibold text-foreground">I'm not safe right now</span>
                <span className="block text-[12.5px] text-muted-foreground">the steady room — breath, numbers, people</span>
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
                <span className="block text-[15px] font-semibold text-foreground">Call Tele-MANAS · 14416</span>
                <span className="block text-[12.5px] text-muted-foreground">free, 24×7, in your language</span>
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
                <span className="block text-[15px] font-semibold text-foreground">Pause an impulse</span>
                <span className="block text-[12.5px] text-muted-foreground">before the text, the call, the decision</span>
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
                <span className="block text-[15px] font-semibold text-foreground">Ground me gently</span>
                <span className="block text-[12.5px] text-muted-foreground">breathing & grounding practices</span>
              </span>
            </Link>
          </div>
          <p className="mt-4 text-center text-[11.5px] leading-relaxed text-muted-foreground">
            InnerMate is a companion, not an emergency service.
          </p>
        </div>
      </div>
    </div>
  );
}

function AppLayout() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [ready, setReady] = useState(false);
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
      if (!data.session) { navigate({ to: "/login" }); return; }
      const { data: p } = await supabase.from("profiles").select("onboarding_completed").eq("id", data.session.user.id).maybeSingle();
      if (!p?.onboarding_completed) { navigate({ to: "/onboarding" }); return; }
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      if (!session) {
        setReady(false);
        await queryClient.cancelQueries();
        queryClient.clear();
        navigate({ to: "/login", replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate, queryClient]);

  // The lamp being lit — never a bare ellipsis, least of all for someone
  // arriving in distress.
  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <CompanionCloud size={72} state="calm" />
        <p className="text-[13px] text-muted-foreground">opening your space</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen md:flex">
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
                    {n.label}
                  </span>
                </span>
                <span className="ml-7 mt-0.5 hidden text-[11px] leading-snug text-muted-foreground/80 group-hover:block group-focus-visible:block">
                  {n.desc}
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
            <LifeBuoy className="h-4 w-4" strokeWidth={1.7} />steady
          </Link>
          <Link to="/settings" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition hover:text-foreground">
            <Settings className="h-4 w-4" strokeWidth={1.6} />sanctuary
          </Link>
          <button
            onClick={toggle}
            className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition hover:text-foreground"
            aria-label={privacy ? "Disable screen privacy mode" : "Enable screen privacy mode"}
            title="Screen Privacy blurs sensitive text on screen. It is not encryption."
          >
            {privacy ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {privacy ? "privacy on" : "privacy off"}
          </button>
        </div>
      </aside>

      <button
        onClick={toggle}
        className="fixed right-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-full border bg-background/80 text-muted-foreground shadow-sm transition hover:text-foreground md:hidden"
        style={{ borderColor: "color-mix(in oklab, var(--ember) 40%, transparent)" }}
        aria-label={privacy ? "Disable screen privacy mode" : "Enable screen privacy mode"}
        title="Screen Privacy blurs text on screen. Not encryption."
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
      <main className={`flex-1 ${path.startsWith("/companion") ? "" : "pb-24"} md:pb-0`}>
        <Outlet />
      </main>

      {!path.startsWith("/companion") && (
        <nav
          aria-label="Primary"
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
                <span className={`leading-none tracking-tight transition-opacity duration-200 ${active ? "opacity-100" : "opacity-70"}`}>{n.label}</span>
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
            <span className="leading-none tracking-tight">Steady</span>
            <span aria-hidden="true" className="h-[2px] w-4 opacity-0" />
          </button>
        </nav>
      )}

      <SteadySheet open={steadyOpen} onClose={() => setSteadyOpen(false)} />
    </div>
  );
}
