import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { PerfDebugPanel } from "@/components/PerfDebugPanel";
import { Toaster } from "@/components/ui/sonner";
import { initOfflineSanctuary } from "@/lib/offline";
import { syncReadingSize } from "@/lib/reading-prefs";
import { syncDocLang, useLang } from "@/lib/i18n";
import { tx } from "@/lib/i18n-strings";

function NotFoundComponent() {
  const lang = useLang();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{tx(lang, "Page not found")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {tx(lang, "The page you're looking for doesn't exist or has been moved.")}
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {tx(lang, "Go home")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const lang = useLang();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {tx(lang, "This page didn't load")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {tx(lang, "Something went wrong on our end. You can try refreshing or head back home.")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {tx(lang, "Try again")}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {tx(lang, "Go home")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#0e121e" },
      { title: "My Quiet Space — A private space to feel, write, and heal" },
      { name: "description", content: "Write, breathe, understand your feelings, and heal one quiet step at a time. Private journal, mood check-in, healing paths, and a gentle AI reflection companion." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "My Quiet Space" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      // The lamplit doorway — same artwork as BrandMark and the PWA icons.
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "apple-touch-icon", href: "/icons/icon-192.png" },
      { rel: "preload", as: "image", href: "/night-mountains.jpg", type: "image/jpeg" },
      // Fonts are bundled via @fontsource (see router.tsx) — no requests to
      // Google leave the app. Privacy-first, and faster on first paint.
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "My Quiet Space",
          url: "https://innermate.lovable.app",
          description: "A private space to feel, write, and heal — journal, mood check-in, healing paths, and a gentle AI reflection companion.",
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        {/* Before first paint: reflect the reader's saved size and language
            onto <html>, so a large-text or Hindi reader never sees a flash of
            the defaults. Mirrors reading-prefs/i18n; kept tiny and dependency-
            free because it runs inline. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var d=document.documentElement,r=localStorage.getItem('mqs-reading');" +
              "if(r==='roomy'||r==='large'){d.dataset.reading=r;" +
              "d.style.setProperty('--reading-scale',r==='large'?'1.3':'1.15');}" +
              "if(localStorage.getItem('mqs-lang')==='hi')d.lang='hi';}catch(e){}",
          }}
        />
      </head>
      <body>
        <div className="app-bg" aria-hidden="true">
          <span className="app-bg-star" style={{ top: "7%", left: "16%", width: 2.5, height: 2.5, animationDelay: "0.8s", animationDuration: "4.6s" }} />
          <span className="app-bg-star" style={{ top: "13%", left: "79%", width: 2, height: 2, animationDelay: "2.2s", animationDuration: "5.8s" }} />
          <span className="app-bg-star" style={{ top: "4%", left: "56%", width: 1.5, height: 1.5, animationDelay: "4s", animationDuration: "6.6s" }} />
          <span className="app-bg-star" style={{ top: "19%", left: "32%", width: 1.5, height: 1.5, animationDelay: "1.4s", animationDuration: "7.2s" }} />
          <span className="app-bg-shoot" style={{ top: "9%", left: "-4%" }} />
        </div>
        {children}
        <Toaster position="top-center" />
        <PerfDebugPanel />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    initOfflineSanctuary(router);
    syncReadingSize();
    syncDocLang();
  }, [router]);

  useEffect(() => {
    const apply = () => {
      const h = new Date().getHours();
      const tod =
        h < 5 ? "tod-night"
        : h < 12 ? "tod-morning"
        : h < 17 ? "tod-afternoon"
        : h < 21 ? "tod-evening"
        : "tod-night";
      const body = document.body;
      body.classList.remove("tod-morning","tod-afternoon","tod-evening","tod-night");
      body.classList.add(tod);
    };
    apply();
    const id = window.setInterval(apply, 10 * 60 * 1000); // re-check every 10 min
    return () => window.clearInterval(id);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
