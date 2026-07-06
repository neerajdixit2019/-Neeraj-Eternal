import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { exportMyData, deleteMyData, getProfile, setCompanionTone, setBackgroundAnimation, getStory, saveStoryField, setStoryReadable } from "@/lib/data.functions";
import { setWeeklyLetterPrefs, getPrivateArchive } from "@/lib/letters.functions";
import { buildPrivateArchivePdf } from "@/lib/export-pdf";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
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

function Settings() {
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
    if (!confirm("Delete all your journals, moods, conversations, memories, letters, and reflections? Only legally required consent/safety records will remain. This cannot be undone.")) return;
    setDeleting(true);
    try {
      await del();
      await qc.invalidateQueries();
      toast.success("Your data has been quietly cleared.");
      navigate({ to: "/home" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete your data.");
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
    <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14 space-y-5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Quiet controls</p>
        <h1 className="mt-3 font-serif text-3xl sm:text-[2.4rem] leading-tight">Settings</h1>
      </div>

      <Section title="Your data" desc="Yours alone. You can take it with you or clear it anytime.">
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
        <Button variant="outline" className="rounded-full text-destructive" onClick={wipe} disabled={deleting}>
          {deleting ? "Deleting…" : "Delete my data"}
        </Button>
        <p className="w-full text-xs text-muted-foreground italic">
          Delete removes everything you created — journals, moods, AI chats, memories, letters, reflections, paths.
          A minimal audit trail (consent, rights requests, safety events) is retained as legally required.
        </p>
      </Section>

      <PasswordSection />

      <ToneSection />

      <BackgroundAnimationSection />

      <SundayLetterSection />

      <MyStorySection />

      <Section title="Account">
        <Button variant="outline" className="rounded-full" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}>Sign out</Button>
      </Section>

      <Section title="A gentle disclaimer">
        <p className="text-sm text-muted-foreground">My Quiet Space is for self-reflection and emotional wellness. It is not therapy, medical advice, or emergency support. If you feel at risk, contact emergency services or a crisis helpline — India: Tele-MANAS 14416 / 1-800-891-4416.</p>
      </Section>
    </div>
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
    <Section title="Password" desc="Update your sign-in password.">
      <form onSubmit={submit} className="w-full space-y-4">
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
    </Section>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <TactileCard>
      <h2 className="font-serif text-xl">{title}</h2>
      {desc && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>}
      <div className="mt-4 flex flex-wrap gap-2">{children}</div>
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
      <h2 className="font-serif text-xl">Companion tone</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        Choose the voice that feels right for your next check-in. You can still change it anytime while chatting.
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
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">Preview</p>
          <p className="mt-1.5 text-sm italic leading-relaxed text-foreground/90">
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
      toast.success(!enabled ? "Background animation on." : "Background set to still.");
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
          <h2 className="font-serif text-xl">Background animation</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            A gentle shifting glow behind the app. Turn off for a completely still background — helpful for comfort, focus, or motion sensitivity.
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

function MyStorySection() {
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
      toast.success(!readable ? "Sharing on." : "Sharing off.");
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
      <h2 className="font-serif text-xl">My Story — help the companion understand you</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        Everything here is optional. Share only what feels right. You can edit or erase any of it, anytime.
      </p>

      <div className="mt-5 flex items-start justify-between gap-4 rounded-xl border border-border/50 bg-muted/20 p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">Quiet Companion may read My Story</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            When off, all fields stay saved but are never sent to the companion.
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

      <div className="mt-6 space-y-5">
        {STORY_FIELDS.map((f) => (
          <StoryField
            key={f.key}
            field={f.key}
            label={f.label}
            hint={f.hint}
            initial={(story?.[f.key] as string | null) ?? ""}
          />
        ))}
      </div>

      <div className="mt-7 rounded-xl border border-border/40 bg-muted/30 p-4">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80">What the companion can currently see</p>
        <p className="mt-2 whitespace-pre-wrap text-sm italic leading-relaxed text-foreground/85">
          {previewLines.length ? previewLines.join("\n") : "Nothing — sharing is off."}
        </p>
      </div>

      <p className="mt-5 text-xs leading-relaxed text-muted-foreground/90">
        This is stored privately, used only to shape how the companion speaks with you, never for anything else. Erase any field and it is gone.
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
      <h2 className="font-serif text-xl">The Sunday letter</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        A short, private letter from your companion, waiting for you each Sunday. It notices the week with care, and ends with one small ritual for the days ahead. Nothing is sent or shared.
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
            <p className="text-sm font-medium">May the letter draw from my memories and story</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              If on, the letter may gently reference one memory or detail you've already marked shareable. Never more than one.
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