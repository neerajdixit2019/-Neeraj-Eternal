// The Lamplit Study type stack, bundled locally — no Google Fonts requests
// leave the app (privacy-first). Fraunces = letterpress display, Newsreader =
// reading prose, Spline Sans = UI utility.
import "@fontsource-variable/fraunces/index.css";
import "@fontsource-variable/newsreader/index.css";
import "@fontsource-variable/newsreader/wght-italic.css";
import "@fontsource-variable/spline-sans/index.css";
import { QueryCache, MutationCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { supabase } from "@/integrations/supabase/client";

let redirecting = false;
function handleUnauthorized(error: unknown) {
  if (typeof window === "undefined") return;
  // Dev-only walkthrough mode intentionally runs without a session —
  // don't bounce it to /login. Stripped from production builds.
  if (import.meta.env.DEV && window.localStorage.getItem("mqs-dev-preview") === "1") return;
  const msg = error instanceof Error ? error.message : String(error ?? "");
  if (!/unauthorized/i.test(msg)) return;
  if (redirecting) return;
  if (window.location.pathname === "/login") return;
  redirecting = true;
  // Best-effort sign-out, then redirect with a clear reason.
  void supabase.auth.signOut().finally(() => {
    window.location.replace("/login?reason=session-expired");
  });
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: handleUnauthorized }),
    mutationCache: new MutationCache({ onError: handleUnauthorized }),
    // One quiet minute of freshness app-wide: screens share query keys
    // (moods, profile, journal), and without this every navigation refired
    // every server function on budget connections.
    defaultOptions: { queries: { staleTime: 60_000 } },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
