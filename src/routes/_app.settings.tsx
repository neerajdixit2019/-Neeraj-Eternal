import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { exportMyData, deleteMyData, getProfile, setCompanionTone, setBackgroundAnimation, getStory, saveStoryField, setStoryReadable } from "@/lib/data.functions";
import { setWeeklyLetterPrefs, getPrivateArchive } from "@/lib/letters.functions";
import { listInsightSourceSettings, setInsightSourceEnabled } from "@/lib/insights.functions";
import { buildPrivateArchivePdf } from "@/lib/export-pdf";
import { crisisResourcesFor, formatCrisisPhone } from "@/lib/crisis-resources";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { useLang, useT, setLang } from "@/lib/i18n";
import { Eye, EyeOff, LifeBuoy, Lock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { TactileCard } from "@/components/TactileCard";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_app/settings")({
  component: Settings,
  head: () => ({
    meta: [
      { title: "Settings | My Quiet Space" },
      { name: "description", content: "Manage your profile, consent, data export, and account deletion." },
      { property: "og:title", content: "Settings" },
      { property: "og:description", content: "Manage your profile, consent, and data." },
      { property: "og:url", content: "https://neeraj2019.lovable.app/settings" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://neeraj2019.lovable.app/settings" }],
  }),
});

const CHAPTERS = [
  { id: "feel", label: "how it feels" },
  { id: "letters", label: "the moon cycle" },
  { id: "inner-map", label: "the inner map" },
  { id: "insight-sources", label: "insights" },
  { id: "vault", label: "the vault" },
  { id: "account", label: "account" },
  { id: "safety", label: "safety" },
] as const;

function Settings() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14 space-y-10">
      <header className="fade-in">
        <p className="qs-section-label">your space, your way</p>
        <h1 className="mt-3 font-serif font-light tracking-tight text-3xl sm:text-[2.4rem] leading-tight">Sanctuary</h1>
        {/* the steady line — crisis support lives at the top of this room, always */}
        <Link
          to="/sos"
          className="mt-4 flex min-h-11 items-center gap-2.5 border-l-2 py-1.5 pl-3.5 text-[13px] transition hover:brightness-110"
          style={{ borderColor: "var(--clay)", color: "var(--rose)" }}
        >
          <LifeBuoy className="h-4 w-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
          in a hard moment? the steady room is one tap away — or call Tele-MANAS 14416.
        </Link>
      </header>

      {/* the ledger's margin — a chapter list that stays in reach. On mobile it
          pins below the fixed privacy-eye button so nothing overlaps it. */}
      <nav
        aria-label="Sanctuary chapters"
        className="sticky top-14 z-20 -mx-5 -my-2 overflow-x-auto px-5 py-1 md:top-0 sm:-mx-8 sm:px-8"
        style={{
          background: "color-mix(in oklab, var(--background) 94%, transparent)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div className="flex gap-5 whitespace-nowrap">
          {CHAPTERS.map((c) => (
            <a
              key={c.id}
              href={`#${c.id}`}
              className="inline-flex min-h-11 items-center text-[11.5px] lowercase tracking-[0.14em] text-muted-foreground transition hover:text-foreground"
            >
              {c.label}
            </a>
          ))}
        </div>
      </nav>

      <SectionGroup id="feel" label="how it feels here">
        <LanguageSection />
        <BackgroundAnimationSection />
        <ToneSection />
      </SectionGroup>

      <SectionGroup id="letters" label="the moon cycle">
        <SundayLetterSection />
      </SectionGroup>

      <SectionGroup id="inner-map" label="the inner map — what InnerMate remembers">
        <InnerMapSection />
      </SectionGroup>

      <SectionGroup id="insight-sources" label="personal insights — what your sky may learn from">
        <InsightSourcesSection />
      </SectionGroup>

      <SectionGroup id="vault" label="your vault, your rules">
        <VaultSection />
      </SectionGroup>

      <SectionGroup id="account" label="account">
        <PasswordSection />
        <SignOutCard />
      </SectionGroup>

      <SectionGroup id="safety" label="safety">
        <SafetySection />
      </SectionGroup>

      <footer className="pt-2 pb-4">
        <p className="flex items-center justify-center gap-2 text-center font-serif text-sm italic text-muted-foreground">
          <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={1.7} aria-hidden="true" />
          everything you write and keep stays yours alone — never shared, never sold.
        </p>
      </footer>
    </div>
  );
}

const INSIGHT_SOURCES = [
  { key: "daily_checkin", title: "Check-ins", line: "The feelings and signals you select by hand — the clearest evidence." },
  { key: "journal", title: "Journal pages", line: "Only the emotion tags you chose on a page. The writing itself is never scanned." },
  { key: "memory", title: "Memories", line: "Only the feeling you attached to a kept memory." },
  { key: "innermate_chat", title: "InnerMate chats", line: "Your own words only, matched for feeling-words. Never InnerMate's replies, never safety moments. Marked as inferred, never as fact." },
] as const;

function InsightSourcesSection() {
  const qc = useQueryClient();
  const listFn = useServerFn(listInsightSourceSettings);
  const setFn = useServerFn(setInsightSourceEnabled);
  const { data: settings } = useQuery({ queryKey: ["insightSources"], queryFn: () => listFn() });
  const [busy, setBusy] = useState<string | null>(null);

  const flip = async (source: (typeof INSIGHT_SOURCES)[number]["key"], enabled: boolean) => {
    setBusy(source);
    try {
      await setFn({ data: { source, enabled } });
      await qc.invalidateQueries({ queryKey: ["insightSources"] });
      await qc.invalidateQueries({ queryKey: ["insightEvents"] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  return (
    <TactileCard tint="lavender">
      <h2 className="font-serif text-xl">What may your sky learn from?</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        Your Insights constellation is built only from sources you allow here. Turning one off removes
        its evidence immediately — nothing derived is ever stored, so there's nothing left behind to delete.
      </p>
      <div className="mt-5 space-y-3">
        {INSIGHT_SOURCES.map((s) => {
          const on = settings?.[s.key] ?? true;
          return (
            <div key={s.key} className="flex items-start justify-between gap-4 rounded-xl border border-border/50 bg-muted/20 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{s.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.line}</p>
              </div>
              <button
                role="switch" aria-checked={on} aria-label={`Use ${s.title} for personal insights`}
                disabled={busy === s.key || !settings}
                onClick={() => flip(s.key, !on)}
                className={`relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition disabled:opacity-60 ${on ? "border-primary/40 bg-primary/70" : "border-border/60 bg-muted"}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition ${on ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-[12px] italic leading-relaxed text-muted-foreground">
        every pattern on Insights shows "why am I seeing this?" — and any pattern can be set aside there.
      </p>
    </TactileCard>
  );
}

function LanguageSection() {
  const t = useT();
  const lang = useLang();
  return (
    <TactileCard>
      <p className="qs-section-label">{t("lang.section")}</p>
      <h2 className="mt-2 font-serif text-xl">{t("lang.title")}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t("lang.body")}</p>
      <div className="mt-4 flex gap-2" role="group" aria-label="Display language">
        {(["en", "hi"] as const).map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={lang === l}
            onClick={() => setLang(l)}
            className="inline-flex min-h-11 items-center rounded-full border px-4 text-[14px] transition"
            style={lang === l
              ? { background: "var(--surface-selected)", borderColor: "var(--border-active)", color: "var(--text-primary)", fontWeight: 600 }
              : { background: "transparent", borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
          >
            {t(l === "en" ? "lang.en" : "lang.hi")}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[12px] italic leading-relaxed text-muted-foreground">
        InnerMate already answers in the language you write to it — हिन्दी, Hinglish, or English.
      </p>
    </TactileCard>
  );
}

function SectionGroup({ id, label, children }: { id?: string; label: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32 space-y-4 md:scroll-mt-16">
      <p className="qs-section-label">{label}</p>
      {children}
    </section>
  );
}

function SignOutCard() {
  const navigate = useNavigate();
  return (
    <TactileCard>
      <h2 className="font-serif text-xl">Leaving for now</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        Your sanctuary stays exactly as you left it.
      </p>
      <div className="mt-4">
        <Button variant="outline" className="rounded-full" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}>Sign out</Button>
      </div>
    </TactileCard>
  );
}

function SafetySection() {
  // Crisis support itself lives as the steady line under the page title —
  // this chapter keeps the honest boundary statement. The numbers render
  // from the crisis-resources config, never typed here by hand.
  const helplines = crisisResourcesFor("IN")
    .map((r) => `${r.name} ${formatCrisisPhone(r.phone)}${r.altPhone ? ` / ${formatCrisisPhone(r.altPhone)}` : ""}`)
    .join(" · ");
  return (
    <TactileCard>
      <h2 className="font-serif text-xl">What this space is, and isn't</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        My Quiet Space is for self-reflection and emotional wellness. It is not therapy, medical advice, or emergency support. If you feel at risk, contact emergency services or a crisis helpline — India: {helplines}.
      </p>
    </TactileCard>
  );
}

function VaultSection() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const exp = useServerFn(exportMyData);
  const del = useServerFn(deleteMyData);
  const archive = useServerFn(getPrivateArchive);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [includeTagline, setIncludeTagline] = useState(true);
  const [tagline, setTagline] = useState("Private — for me alone.");
  const [includeDateRange, setIncludeDateRange] = useState(true);
  const [includeLastReflection, setIncludeLastReflection] = useState(false);
  const [includeLastMoodCheckin, setIncludeLastMoodCheckin] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // The page-turn confirm must not lose the keyboard.
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const keepThingsRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirmingDelete) keepThingsRef.current?.focus();
  }, [confirmingDelete]);
  const cancelDelete = () => {
    setConfirmingDelete(false);
    requestAnimationFrame(() => deleteTriggerRef.current?.focus());
  };

  const download = async () => {
    setExporting(true);
    try {
      const data = await exp();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "innermate-export.json"; a.click();
      URL.revokeObjectURL(url);
      toast.success("Your data has been exported.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not export your data.");
    } finally {
      setExporting(false);
    }
  };

  const wipe = async () => {
    setDeleting(true);
    try {
      await del();
      await qc.invalidateQueries();
      toast.success("Your data has been quietly cleared.");
      navigate({ to: "/home" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete your data.");
      // The buttons were disabled while deleting, which dropped keyboard
      // focus to <body> — put it back inside the open confirm.
      requestAnimationFrame(() => keepThingsRef.current?.focus());
    } finally {
      setDeleting(false);
    }
  };

  const downloadPdf = async () => {
    setPdfLoading(true);
    try {
      const data = await archive();
      const blob = buildPrivateArchivePdf(data, { includeTagline, tagline, includeDateRange, includeLastReflection, includeLastMoodCheckin });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `my-quiet-space-${stamp}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Your private archive is ready.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build PDF.");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <TactileCard>
      <h2 className="font-serif text-xl">Everything here is yours</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        Take it with you, or let it all go.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <div className="w-full space-y-3">
          <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-2.5">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <Checkbox checked={includeTagline} onCheckedChange={(v) => setIncludeTagline(v === true)} className="mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="text-sm">Include a privacy tagline on the cover</span>
                {includeTagline && (
                  <Input
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="Private — for me alone."
                    className="mt-2 h-9 rounded-lg text-sm"
                    maxLength={120}
                  />
                )}
              </div>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox checked={includeDateRange} onCheckedChange={(v) => setIncludeDateRange(v === true)} />
              <span className="text-sm">Include the date range of my entries</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox checked={includeLastReflection} onCheckedChange={(v) => setIncludeLastReflection(v === true)} />
              <span className="text-sm">Include my last check-in reflection as a cover note</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox checked={includeLastMoodCheckin} onCheckedChange={(v) => setIncludeLastMoodCheckin(v === true)} />
              <span className="text-sm">Include my last mood check-in (mood + tags) on the cover</span>
            </label>
          </div>
          <Button variant="outline" className="rounded-full" onClick={downloadPdf} disabled={pdfLoading}>
            {pdfLoading ? "Preparing PDF…" : "Download letters & check-ins (PDF)"}
          </Button>
        </div>
        <Button variant="outline" className="rounded-full" onClick={download} disabled={exporting}>
          {exporting ? "Exporting…" : "Export my data (JSON)"}
        </Button>
        <Button
          ref={deleteTriggerRef}
          variant="outline"
          className="rounded-full text-destructive"
          onClick={() => setConfirmingDelete(true)}
          disabled={deleting || confirmingDelete}
          aria-expanded={confirmingDelete}
        >
          Delete my data
        </Button>
        <Link
          to="/trusted-letter"
          className="inline-flex min-h-11 items-center rounded-full border px-4 text-[13px] transition hover:brightness-110"
          style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
        >
          a letter for someone you trust →
        </Link>
        <p className="w-full text-xs text-muted-foreground italic">
          Delete removes everything you created — journals, moods, AI chats, memories, letters, reflections, paths.
          A minimal audit trail (consent, rights requests, safety events) is retained as legally required.
        </p>
      </div>

      {/* the page-turn — deletion confirmed in-world, on paper, never in a
          browser dialog. Focus moves in (to the safe choice) and returns. */}
      {confirmingDelete && (
        <div
          role="alertdialog"
          aria-label="Confirm deleting your data"
          aria-describedby="delete-confirm-detail"
          onKeyDown={(e) => { if (e.key === "Escape" && !deleting) cancelDelete(); }}
          className="fade-in mt-5 rounded-[4px] p-5 sm:p-6"
          style={{ background: "var(--paper)", color: "var(--ink)", boxShadow: "0 14px 40px rgba(5, 4, 2, 0.5)" }}
        >
          <p className="font-serif text-[13px] italic" style={{ color: "color-mix(in oklab, var(--ink) 66%, var(--paper))" }}>
            before this book closes
          </p>
          <p className="mt-2 font-serif text-[19px] font-light leading-snug">
            Delete all your journals, moods, conversations, memories, letters, and reflections?
          </p>
          <p id="delete-confirm-detail" className="mt-2.5 text-[13.5px] leading-relaxed" style={{ color: "color-mix(in oklab, var(--ink) 80%, var(--paper))" }}>
            Only legally required consent/safety records will remain. This cannot be undone — it is a true goodbye
            to everything written here.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-6 border-t pt-4" style={{ borderColor: "color-mix(in oklab, var(--ink) 14%, transparent)" }}>
            <button
              ref={keepThingsRef}
              type="button"
              disabled={deleting}
              onClick={cancelDelete}
              className="inline-flex min-h-11 items-center text-[13.5px] font-medium underline-offset-4 transition hover:underline"
              style={{ color: "var(--ink)" }}
            >
              keep my things
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={wipe}
              className="inline-flex min-h-11 items-center text-[13.5px] underline-offset-4 transition hover:underline disabled:opacity-60"
              style={{ color: "color-mix(in oklab, var(--clay) 70%, var(--ink))" }}
            >
              {deleting ? "clearing…" : "yes — clear everything"}
            </button>
          </div>
        </div>
      )}
    </TactileCard>
  );
}

function PasswordSection() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Both passwords need to match.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated quietly.");
      setPassword("");
      setConfirm("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TactileCard>
      <h2 className="font-serif text-xl">A new password</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">Change the key to your sanctuary whenever you like.</p>
      <form onSubmit={submit} className="mt-4 w-full space-y-4">
        <div>
          <Label htmlFor="new-password">New password</Label>
          <div className="relative mt-1.5">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="new-password" type={showPw ? "text" : "password"} required minLength={6}
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="h-10 rounded-xl pl-10 pr-10"
              autoComplete="new-password"
            />
            <button
              type="button" onClick={() => setShowPw(s => !s)}
              aria-label={showPw ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition hover:text-foreground"
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
              className="h-10 rounded-xl pl-10 pr-10"
              autoComplete="new-password"
            />
          </div>
        </div>
        <Button type="submit" disabled={loading} variant="outline" className="rounded-full">
          {loading ? "Saving…" : "Update password"}
        </Button>
      </form>
    </TactileCard>
  );
}

const TONE_OPTIONS: { value: "gentle" | "poetic" | "practical"; label: string; description: string; preview: string }[] = [
  {
    value: "gentle",
    label: "Gentle",
    description: "Warm, soft, and patient — like a trusted friend sitting beside you.",
    preview: "That sounds difficult to carry. You don't have to figure it all out right now. What would feel kind to do for yourself in the next few minutes?",
  },
  {
    value: "poetic",
    label: "Poetic",
    description: "Lyrical and spacious — imagery, rhythm, and emotional resonance.",
    preview: "Some feelings arrive like weather — they do not need solving, only shelter. Let this one pass through you gently, like rain on a quiet roof.",
  },
  {
    value: "practical",
    label: "Practical",
    description: "Grounded and direct — concrete steps, clear framing, and actionable clarity.",
    preview: "Your mind may be trying to hold every task at once. Choose one thing you can move forward in the next ten minutes. What is the first visible step?",
  },
];

function ToneSection() {
  const qc = useQueryClient();
  const profileFn = useServerFn(getProfile);
  const setToneFn = useServerFn(setCompanionTone);
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });
  const [saving, setSaving] = useState(false);

  const currentTone = (profile as { companion_tone?: "gentle" | "poetic" | "practical" | null } | null)?.companion_tone ?? null;

  const select = async (tone: "gentle" | "poetic" | "practical" | null) => {
    setSaving(true);
    try {
      await setToneFn({ data: { tone } });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success(tone ? `${TONE_OPTIONS.find(t => t.value === tone)?.label} tone saved.` : "Default tone reset.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <TactileCard>
      <h2 className="font-serif text-xl">How InnerMate speaks with you</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        Choose the voice that feels right for your next conversation. You can change it anytime, even mid-chat.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {TONE_OPTIONS.map((t) => {
          const active = currentTone === t.value;
          return (
            <button
              key={t.value}
              onClick={() => select(active ? null : t.value)}
              disabled={saving}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                active
                  ? "border-primary/40 bg-primary/10"
                  : "border-border/60 bg-card/40 hover:border-primary/30 hover:bg-card"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{t.label}</span>
                {active && <span className="h-2 w-2 rounded-full bg-primary" />}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.description}</p>
            </button>
          );
        })}
      </div>
      {currentTone && (
        <div className="mt-4 rounded-xl border border-border/40 bg-muted/30 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">How it might sound</p>
          <p className="mt-1.5 font-serif text-sm italic leading-relaxed text-foreground/90">
            “{TONE_OPTIONS.find(t => t.value === currentTone)?.preview}”
          </p>
        </div>
      )}
    </TactileCard>
  );
}

function BackgroundAnimationSection() {
  const qc = useQueryClient();
  const profileFn = useServerFn(getProfile);
  const setBgFn = useServerFn(setBackgroundAnimation);
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });
  const [saving, setSaving] = useState(false);

  const enabled = (profile as { background_animation_enabled?: boolean | null } | null)?.background_animation_enabled ?? true;

  const toggle = async () => {
    setSaving(true);
    try {
      await setBgFn({ data: { enabled: !enabled } });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success(!enabled ? "The sky is drifting again." : "The sky is holding still.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <TactileCard>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-serif text-xl">The slow drift of the sky</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            A gentle shifting glow behind everything here. Turn it off for a completely still sky — kinder for comfort, focus, or motion sensitivity.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle background animation"
          onClick={toggle}
          disabled={saving}
          className={`relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition ${
            enabled ? "border-primary/40 bg-primary/70" : "border-border/60 bg-muted"
          } ${saving ? "opacity-60" : ""}`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground/80">
        Reduced-motion system settings are always respected.
      </p>
    </TactileCard>
  );
}

const STORY_FIELDS = [
  { key: "roots", label: "Where I come from", hint: "Places, family shape, anything about roots." },
  { key: "current_chapter", label: "What I'm carrying right now", hint: "The current chapter of your life." },
  { key: "people", label: "People who matter to me", hint: "Names and who they are to you." },
  { key: "healing_from", label: "What I'm healing from", hint: "Losses, endings, what brought you here." },
  { key: "speaking_preference", label: "How I like to be spoken to", hint: "e.g. \"be direct with me\", \"I need softness\", \"don't rush me\"." },
] as const;
type StoryKey = typeof STORY_FIELDS[number]["key"];

type StoryRow = {
  user_id: string;
  roots: string | null;
  current_chapter: string | null;
  people: string | null;
  healing_from: string | null;
  speaking_preference: string | null;
  is_ai_readable: boolean;
};

function InnerMapSection() {
  const qc = useQueryClient();
  const storyFn = useServerFn(getStory);
  const toggleFn = useServerFn(setStoryReadable);
  const { data: story } = useQuery({
    queryKey: ["user-story"],
    queryFn: () => storyFn() as Promise<StoryRow | null>,
  });

  const readable = story?.is_ai_readable ?? false;

  const toggle = async () => {
    try {
      await toggleFn({ data: { is_ai_readable: !readable } });
      await qc.invalidateQueries({ queryKey: ["user-story"] });
      toast.success(!readable ? "InnerMate may read your map." : "The map is quiet now.");
    } catch (e) { toast.error((e as Error).message); }
  };

  // Build companion preview
  const previewLines: string[] = [];
  if (story?.is_ai_readable) {
    if (story.roots) previewLines.push(`Roots: ${story.roots}`);
    if (story.current_chapter) previewLines.push(`Current chapter: ${story.current_chapter}`);
    if (story.people) previewLines.push(`People who matter: ${story.people}`);
    if (story.healing_from) previewLines.push(`Healing from: ${story.healing_from}`);
    if (story.speaking_preference) previewLines.push(`How they like to be spoken to: ${story.speaking_preference}`);
  }

  return (
    <TactileCard>
      <h2 className="font-serif text-xl">Landmarks you have chosen to share</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        This is the inner map — the parts of your story you have placed here yourself, so InnerMate can meet you where you actually are. Every landmark is optional. Share only what feels right.
      </p>

      <div className="mt-5 flex items-start justify-between gap-4 rounded-xl border border-border/50 bg-muted/20 p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">InnerMate may read this</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            When off, every landmark stays saved here — quiet, and never sent to InnerMate.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={readable}
          onClick={toggle}
          className={`relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition ${readable ? "border-primary/40 bg-primary/70" : "border-border/60 bg-muted"}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition ${readable ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>

      {/* five landmarks, five ruled entries in the ledger */}
      <div className="mt-4">
        {STORY_FIELDS.map((f) => (
          <div key={f.key} className="border-t py-5 first:border-t-0" style={{ borderColor: "var(--border-subtle)" }}>
            <StoryField
              field={f.key}
              label={f.label}
              hint={f.hint}
              initial={(story?.[f.key] as string | null) ?? ""}
            />
          </div>
        ))}
      </div>

      <div className="mt-7 rounded-xl border border-border/40 bg-muted/30 p-4">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80">What InnerMate can currently see</p>
        <p className="mt-2 whitespace-pre-wrap text-sm italic leading-relaxed text-foreground/85">
          {previewLines.length ? previewLines.join("\n") : "Nothing — the map is resting."}
        </p>
      </div>

      <p className="mt-5 text-xs leading-relaxed text-muted-foreground/90">
        You can view, edit, quiet, or erase any of this whenever you like. InnerMate only ever reads what you allow.
      </p>
    </TactileCard>
  );
}

function StoryField({ field, label, hint, initial }: { field: StoryKey; label: string; hint: string; initial: string }) {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveStoryField);
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setValue(initial); }, [initial]);

  const dirty = value !== initial;

  const save = async () => {
    setSaving(true);
    try {
      await saveFn({ data: { field, value } });
      await qc.invalidateQueries({ queryKey: ["user-story"] });
      toast.success("Kept.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  const erase = async () => {
    setValue("");
    setSaving(true);
    try {
      await saveFn({ data: { field, value: "" } });
      await qc.invalidateQueries({ queryKey: ["user-story"] });
      toast.success("Erased.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <Label className="font-serif text-base">{label}</Label>
      <p className="mt-0.5 text-xs text-muted-foreground/90">{hint}</p>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={600}
        className="mt-2 min-h-[88px] rounded-xl"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground/70">{value.length}/600</span>
        <div className="flex gap-2">
          {initial && (
            <Button variant="outline" size="sm" className="rounded-full" onClick={erase} disabled={saving}>Erase</Button>
          )}
          <Button size="sm" className="rounded-full" onClick={save} disabled={!dirty || saving}>
            {saving ? "Keeping…" : "Keep this"}
          </Button>
        </div>
      </div>
    </div>
  );
}

type LetterPrefsRow = {
  weekly_letter_enabled?: boolean | null;
  weekly_letter_uses_memories?: boolean | null;
};

function SundayLetterSection() {
  const qc = useQueryClient();
  const profileFn = useServerFn(getProfile);
  const prefsFn = useServerFn(setWeeklyLetterPrefs);
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });
  const p = profile as LetterPrefsRow | null;
  const enabled = !!p?.weekly_letter_enabled;
  const usesMemories = !!p?.weekly_letter_uses_memories;

  const flip = async (patch: { weekly_letter_enabled?: boolean; weekly_letter_uses_memories?: boolean }) => {
    try {
      await prefsFn({ data: patch });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Kept.");
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <TactileCard>
      <h2 className="font-serif text-xl">A letter from your week, every Sunday</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        A short, private letter from InnerMate, waiting for you each Sunday. It notices your week with care, and ends with one small ritual for the days ahead. Nothing is sent or shared.
      </p>

      <div className="mt-5 flex items-start justify-between gap-4 rounded-xl border border-border/50 bg-muted/20 p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">Receive a weekly letter</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            When on, an envelope quietly appears on Home each Sunday.
          </p>
        </div>
        <button
          role="switch" aria-checked={enabled}
          onClick={() => flip({ weekly_letter_enabled: !enabled })}
          className={`relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition ${enabled ? "border-primary/40 bg-primary/70" : "border-border/60 bg-muted"}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition ${enabled ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>

      {enabled && (
        <div className="mt-3 flex items-start justify-between gap-4 rounded-xl border border-border/50 bg-muted/20 p-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">May the letter walk among your stars?</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              If yes, the letter may gently reference one memory or detail you've already marked shareable. Never more than one.
            </p>
          </div>
          <button
            role="switch" aria-checked={usesMemories}
            onClick={() => flip({ weekly_letter_uses_memories: !usesMemories })}
            className={`relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition ${usesMemories ? "border-primary/40 bg-primary/70" : "border-border/60 bg-muted"}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition ${usesMemories ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
      )}
    </TactileCard>
  );
}
