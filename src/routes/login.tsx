import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LangToggle } from "@/components/LangToggle";
import { useLang } from "@/lib/i18n";
import { tx } from "@/lib/i18n-strings";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: z.object({
    reason: z.enum(["session-expired"]).optional(),
  }),
  head: () => ({
    meta: [
      { title: "Sign in | My Quiet Space" },
      { name: "description", content: "Sign in to your private My Quiet Space account to continue journaling and reflecting." },
      { property: "og:title", content: "Sign in — My Quiet Space" },
      { property: "og:description", content: "Sign in to your private My Quiet Space account." },
      { property: "og:url", content: "https://neeraj2019.lovable.app/login" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://neeraj2019.lovable.app/login" }],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const lang = useLang();
  const { reason } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home" });
    });
  }, [navigate]);

  useEffect(() => {
    if (reason === "session-expired") {
      toast.info(tx(lang, "Your session expired. Please sign in again."));
    }
  }, [reason]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) {
        navigate({ to: "/home" });
        return;
      }
      // Unknown account? Create one on the fly.
      if (/invalid login credentials/i.test(error.message)) {
        const { error: signUpError, data } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/onboarding" },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          navigate({ to: "/home" });
        } else {
          toast.success(tx(lang, "Check your email to confirm your new account."));
        }
        return;
      }
      throw error;
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setLoading(false); }
  };

  const signInWithGoogle = async () => {
    // Lovable's OAuth proxy (/~oauth) only exists on the published site —
    // on a local dev server that redirect dead-ends in a 404.
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      toast.info(
        tx(lang, "Google sign-in only works on the published site. Here, use email and password below — a new account is created automatically."),
      );
      return;
    }
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/home",
      });
      if (result.error) {
        toast.error(result.error.message ?? tx(lang, "Could not sign in with Google."));
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/home" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (error) throw error;
      toast.success(tx(lang, "A reset link is on its way. Check your inbox."));
      setResetOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-md">
        {reason === "session-expired" && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-sm text-foreground"
          >
            {tx(lang, "Your session expired for your safety. Please sign in again to continue.")}
          </div>
        )}
        {/* The language sits with the brand — a Hindi reader who chose Hindi on
            the door keeps it here, and one arriving straight at /login can pick
            it before signing in. */}
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/"
            className="font-serif text-[13px] tracking-[0.18em] uppercase text-muted-foreground transition hover:text-foreground"
          >
            My Quiet Space
          </Link>
          <LangToggle />
        </div>
        <h1 className="mt-8 font-serif text-[2.6rem] leading-[1.05] tracking-tight sm:text-[3.2rem]">
          {resetOpen ? tx(lang, "A reset, gently.") : tx(lang, "A quiet place to put things down.")}
        </h1>
        <p className="mt-5 max-w-md text-[15.5px] leading-relaxed text-muted-foreground">
          {resetOpen
            ? tx(lang, "Enter your email and we'll send a fresh link.")
            : tx(lang, "Whatever you're carrying today — it can rest here. Sign in to continue, or just begin.")}
        </p>

        <div
          className="mt-10 rounded-[28px] p-7 sm:p-9"
          style={{
            background: "linear-gradient(140deg, color-mix(in oklab, var(--sand) 14%, var(--card)) 0%, var(--card) 100%)",
            boxShadow: "0 24px 60px -36px color-mix(in oklab, var(--foreground) 26%, transparent)",
          }}
        >

        {resetOpen ? (
          <form onSubmit={sendReset} className="space-y-5">
            <div>
              <Label htmlFor="reset-email">{tx(lang, "Email")}</Label>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="reset-email" type="email" autoComplete="email" required
                  value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
                  className="h-12 rounded-xl pl-10 text-base"
                  placeholder="you@somewhere.com"
                />
              </div>
            </div>
            <Button type="submit" disabled={resetLoading} className="h-12 w-full rounded-xl text-base">
              {resetLoading ? tx(lang, "One quiet moment…") : tx(lang, "Send me a link")}
            </Button>
            <button
              type="button"
              onClick={() => setResetOpen(false)}
              className="w-full text-sm text-muted-foreground transition hover:text-foreground"
            >
              {tx(lang, "← back")}
            </button>
          </form>
        ) : (
          <>
            <Button
              type="button"
              onClick={signInWithGoogle}
              disabled={loading}
              variant="outline"
              className="h-12 w-full rounded-xl text-base"
            >
              <GoogleIcon /> {tx(lang, "Continue with Google")}
            </Button>

            <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70">
              <span className="h-px flex-1 bg-border/70" /> {tx(lang, "or")} <span className="h-px flex-1 bg-border/70" />
            </div>

            <form onSubmit={submit} className="space-y-5">
              <div>
                <Label htmlFor="email">{tx(lang, "Email")}</Label>
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email" type="email" autoComplete="email" required
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    className="h-12 rounded-xl pl-10 text-base"
                    placeholder="you@somewhere.com"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{tx(lang, "Password")}</Label>
                  <button
                    type="button"
                    onClick={() => { setResetEmail(email); setResetOpen(true); }}
                    className="text-xs text-muted-foreground transition hover:text-foreground"
                  >
                    {tx(lang, "forgot it?")}
                  </button>
                </div>
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password" type={showPw ? "text" : "password"}
                    autoComplete="current-password"
                    required minLength={6}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    className="h-12 rounded-xl pl-10 pr-11 text-base"
                    placeholder={tx(lang, "At least 6 characters")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(s => !s)}
                    aria-label={showPw ? tx(lang, "Hide password") : tx(lang, "Show password")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground transition hover:text-foreground"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl text-base">
                {loading ? tx(lang, "One quiet moment…") : tx(lang, "Begin")}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs italic text-muted-foreground">
              {tx(lang, "New here? Just continue — we'll create your space.")}
            </p>

            {import.meta.env.DEV && (
              <button
                type="button"
                onClick={() => {
                  window.localStorage.setItem("mqs-dev-preview", "1");
                  navigate({ to: "/home" });
                }}
                className="mt-4 w-full text-center text-xs text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline"
              >
                developer: preview the app without an account
              </button>
            )}
          </>
        )}
        </div>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4-5.5 4-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.7 2.3 2.5 6.6 2.5 12s4.2 9.7 9.5 9.7c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}