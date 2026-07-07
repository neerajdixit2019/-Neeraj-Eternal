import "@fontsource/sora/400.css";
import "@fontsource/sora/500.css";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "@fontsource/manrope/300.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
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
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
