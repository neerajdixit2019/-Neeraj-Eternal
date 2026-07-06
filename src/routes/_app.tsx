import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Home, BookHeart, HeartHandshake, MessageCircle, LifeBuoy, Settings, Eye, EyeOff, Images, Shield, HeartPulse } from "lucide-react";
import { usePrivacyMode } from "@/hooks/use-privacy";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProfile } from "@/lib/data.functions";

export const Route = createFileRoute("/_app")({ component: AppLayout });

// Desktop sidebar — full surface
const nav = [
  { to: "/home", label: "Home", icon: Home, desc: "Your quiet space, today" },
  { to: "/companion", label: "InnerMate", icon: MessageCircle, desc: "A gentle conversation" },
  { to: "/checkin", label: "Check-in", icon: HeartPulse, desc: "How you feel, in a minute" },
  { to: "/journal", label: "Journal", icon: BookHeart, desc: "Write what you can't say" },
  { to: "/heal", label: "Heal", icon: HeartHandshake, desc: "Gentle guided paths" },
  { to: "/memories", label: "Memories", icon: Images, desc: "A shelf for what stays" },
] as const;

// Mobile bottom — six thumb-friendly essentials
const mobileNav = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/checkin", label: "Check-in", icon: HeartPulse },
  { to: "/journal", label: "Journal", icon: BookHeart },
  { to: "/heal", label: "Heal", icon: HeartHandshake },
  { to: "/companion", label: "Companion", icon: MessageCircle },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function AppLayout() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [ready, setReady] = useState(false);
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

  useEffect(() => {
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

  if (!ready) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">…</div>;

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-border/40 md:px-4 md:py-6">
        <Link to="/home" className="px-3 font-serif text-xl">My Quiet Space</Link>
        <nav className="mt-8 flex flex-col gap-1.5">
          {nav.map((n) => {
            const active = path === n.to || path.startsWith(n.to + "/");
            return (
              <Link key={n.to} to={n.to} className={`flex items-start gap-3 rounded-xl px-3 py-3 text-sm transition ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}>
                <n.icon className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="flex flex-col">
                  <span className="font-medium leading-tight">{n.label}</span>
                  <span className="mt-0.5 text-xs text-muted-foreground/80 leading-snug">{n.desc}</span>
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-1">
        <Link to="/sos" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-muted/50 hover:text-foreground">
          <LifeBuoy className="h-4 w-4" />SOS
        </Link>
        <Link to="/privacy" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-muted/50 hover:text-foreground">
          <Shield className="h-4 w-4" />Data & Privacy
        </Link>
        <Link to="/settings" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-muted/50 hover:text-foreground">
          <Settings className="h-4 w-4" />Settings
        </Link>
        <button
          onClick={toggle}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
          aria-label={privacy ? "Disable screen privacy mode" : "Enable screen privacy mode"}
          title="Screen Privacy blurs sensitive text on screen. It is not encryption."
        >
          {privacy ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {privacy ? "Screen privacy on" : "Screen privacy off"}
        </button>
        </div>
      </aside>

      <button
        onClick={toggle}
        className="fixed right-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/80 backdrop-blur text-muted-foreground shadow-sm transition hover:text-foreground md:hidden"
        aria-label={privacy ? "Disable screen privacy mode" : "Enable screen privacy mode"}
        title="Screen Privacy blurs text on screen. Not encryption."
      >
        {privacy ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>

      <main className={`flex-1 ${path.startsWith("/companion") ? "" : "pb-24"} md:pb-0`}>
        <Outlet />
      </main>

      {!path.startsWith("/companion") && (
      <nav
        aria-label="Primary"
        className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-6 border-t border-border/60 bg-background/85 backdrop-blur-xl pb-[max(env(safe-area-inset-bottom),0.25rem)] md:hidden"
      >
        {mobileNav.map((n) => {
          const active = path === n.to || path.startsWith(n.to + "/");
          return (
            <Link
              key={n.to}
              to={n.to}
              aria-current={active ? "page" : undefined}
              className={`group relative flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium outline-none transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60 ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute top-0 h-[2px] w-8 rounded-full bg-primary transition-all duration-300 ease-out ${
                  active ? "opacity-100 scale-x-100" : "opacity-0 scale-x-50"
                }`}
              />
              <span
                aria-hidden="true"
                className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 ease-out group-active:scale-95 ${
                  active ? "bg-primary/10" : "bg-transparent group-hover:bg-muted/40"
                }`}
              >
                <n.icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" focusable="false" />
              </span>
              <span className="leading-none tracking-tight">{n.label}</span>
            </Link>
          );
        })}
      </nav>
      )}
    </div>
  );
}