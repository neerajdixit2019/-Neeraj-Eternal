import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, ArrowLeft } from "lucide-react";
import { VerseQuote } from "@/components/VerseQuote";
import { dailyVerse } from "@/lib/verses";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "Reset password | My Quiet Space" },
      { name: "description", content: "Set a new password for your My Quiet Space account." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://neeraj2019.lovable.app/reset-password" }],
  }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when the user lands here from the email link.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Both passwords need to match.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. Welcome back.");
      navigate({ to: "/home" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    // The same wall as everywhere else — one quiet pool of lamplight, no
    // violet wash, no glass.
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(70% 50% at 50% 30%, color-mix(in oklab, var(--lamp) 8%, transparent), transparent 65%), var(--background)",
        }}
      />

      <div className="w-full max-w-md rounded-[20px_20px_10px_10px] border p-7 sm:p-9" style={{ borderColor: "var(--border-subtle)", background: "var(--card)" }}>
        <Link to="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> back to sign in
        </Link>
        <h1 className="mt-5 font-serif text-4xl tracking-tight">Set a new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {ready ? "Choose something you'll remember. At least 6 characters." : "Open this page from the link in your email."}
        </p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <div>
            <Label htmlFor="new-password">New password</Label>
            <div className="relative mt-1.5">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="new-password" type={showPw ? "text" : "password"} required minLength={6}
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl pl-10 pr-11 text-base"
                autoComplete="new-password"
              />
              <button
                type="button" onClick={() => setShowPw(s => !s)}
                aria-label={showPw ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground transition hover:text-foreground"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="confirm-password">Confirm password</Label>
            <div className="relative mt-1.5">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirm-password" type={showPw ? "text" : "password"} required minLength={6}
                value={confirm} onChange={(e) => setConfirm(e.target.value)}
                className="h-12 rounded-xl pl-10 text-base"
                autoComplete="new-password"
              />
            </div>
          </div>
          <Button type="submit" disabled={loading || !ready} className="h-12 w-full rounded-xl text-base">
            {loading ? "Saving…" : "Save new password"}
          </Button>
        </form>

        <div className="mt-8 rounded-2xl border border-border/60 bg-background/40 p-4">
          <VerseQuote initial={dailyVerse()} variant="plain" />
        </div>
      </div>
    </main>
  );
}