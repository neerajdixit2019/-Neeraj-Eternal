import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TactileCard } from "@/components/TactileCard";
import { toast } from "sonner";
import { listMemories, saveMemory, setMemoryReadable, deleteMemory } from "@/lib/data.functions";
import { listKeptLetters } from "@/lib/letters.functions";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Flame } from "lucide-react";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/_app/memories")({
  component: MemoriesPage,
  head: () => ({
    meta: [
      { title: "Memory Keeper | My Quiet Space" },
      { name: "description", content: "A quiet shelf for the moments you want to keep — photos, videos, and the stories behind them." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const FEELINGS = [
  { value: "warm", label: "warm", tint: "rose" },
  { value: "bittersweet", label: "bittersweet", tint: "lavender" },
  { value: "heavy", label: "heavy", tint: "sky" },
  { value: "grateful", label: "grateful", tint: "amber" },
  { value: "longing", label: "longing", tint: "lavender" },
  { value: "peaceful", label: "peaceful", tint: "mint" },
] as const;
type Feeling = typeof FEELINGS[number]["value"];

const FEELING_CHIP: Record<Feeling, string> = {
  warm: "bg-rose-100/70 text-rose-900",
  bittersweet: "bg-violet-100/70 text-violet-900",
  heavy: "bg-sky-100/70 text-sky-900",
  grateful: "bg-amber-100/70 text-amber-900",
  longing: "bg-fuchsia-100/70 text-fuchsia-900",
  peaceful: "bg-emerald-100/70 text-emerald-900",
};

const MAX_BYTES = 50 * 1024 * 1024;

type MemoryRow = {
  id: string;
  title: string | null;
  story: string | null;
  feeling_tag: string | null;
  memory_date: string | null;
  media_path: string | null;
  media_type: string | null;
  is_ai_readable: boolean;
  created_at: string;
  media_url?: string | null;
};

function MemoriesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMemories);
  const { data: memories, isLoading } = useQuery({
    queryKey: ["memories"],
    queryFn: () => listFn() as Promise<MemoryRow[]>,
  });
  const [tab, setTab] = useState<"memories" | "letters">("memories");

  const grouped = useMemo(() => {
    const out: Record<string, MemoryRow[]> = {};
    for (const m of memories ?? []) {
      const y = m.memory_date ? new Date(m.memory_date).getFullYear().toString() : "Undated";
      (out[y] ??= []).push(m);
    }
    return Object.entries(out).sort((a, b) => {
      if (a[0] === "Undated") return 1;
      if (b[0] === "Undated") return -1;
      return Number(b[0]) - Number(a[0]);
    });
  }, [memories]);

  const pinned = useMemo(() => (memories ?? []).slice(0, 3), [memories]);
  useEffect(() => {
    if (pinned.length > 0) track("memory_pinned_viewed", { count: pinned.length });
  }, [pinned.length]);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14 space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">a shelf for what stays</p>
        <h1 className="mt-3 font-serif text-3xl sm:text-[2.4rem] leading-tight">Memory Keeper</h1>
        <p className="mt-3 font-serif italic text-sm leading-relaxed text-muted-foreground">
          the shelf is where things you want to remember live.
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          a photo, a clip, and the story behind it. yours alone — share with the companion only if you wish.
        </p>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab("memories")} className={`rounded-full px-4 py-1.5 text-sm transition ${tab === "memories" ? "bg-foreground/90 text-background" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>Memories</button>
        <button onClick={() => setTab("letters")} className={`rounded-full px-4 py-1.5 text-sm transition ${tab === "letters" ? "bg-foreground/90 text-background" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>Letters</button>
      </div>

      {tab === "letters" ? (
        <LettersShelf />
      ) : (
        <>
          <NewMemory onSaved={() => qc.invalidateQueries({ queryKey: ["memories"] })} />

          {pinned.length > 0 && (
            <section aria-label="Pinned memories" className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">on the shelf</p>
              <div className="grid grid-cols-3 gap-3">
                {pinned.map((m) => {
                  const label = m.title || (m.story ?? "").split("\n")[0].slice(0, 40) || "untitled";
                  const excerpt = (m.story ?? "").split("\n").find(Boolean)?.slice(0, 70) ?? "";
                  return (
                    <div
                      key={m.id}
                      className="parchment relative aspect-[3/4] overflow-hidden p-3 flex flex-col justify-end"
                    >
                      {m.media_url && m.media_type !== "video" && (
                        <img
                          src={m.media_url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover opacity-70"
                          loading="lazy"
                        />
                      )}
                      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/40 to-transparent" />
                      <div className="relative">
                        <p className="font-serif text-[13px] leading-tight line-clamp-2">{label}</p>
                        {excerpt && (
                          <p className="mt-1 text-[10px] italic text-muted-foreground line-clamp-2">{excerpt}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {isLoading ? (
        <p className="text-sm text-muted-foreground">…</p>
      ) : (memories?.length ?? 0) === 0 ? (
        <TactileCard>
          <p className="font-serif text-lg leading-relaxed">Nothing kept here yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">Some moments deserve a shelf of their own.</p>
        </TactileCard>
      ) : (
        <div className="space-y-8">
          {grouped.map(([year, items]) => (
            <section key={year} className="space-y-4">
              <h2 className="font-serif text-2xl text-muted-foreground/90">{year}</h2>
              <div className="space-y-4">
                {items.map((m) => (
                  <MemoryCard
                    key={m.id}
                    memory={m}
                    onChanged={() => qc.invalidateQueries({ queryKey: ["memories"] })}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );
}

type LetterRow = {
  id: string;
  week_start: string;
  tone: "gentle" | "tender";
  ritual: string | null;
  body: string;
  generated_at: string;
};

function LettersShelf() {
  const listFn = useServerFn(listKeptLetters);
  const { data: letters, isLoading } = useQuery({
    queryKey: ["kept-letters"],
    queryFn: () => listFn() as Promise<LetterRow[]>,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">…</p>;
  if (!letters || letters.length === 0) {
    return (
      <TactileCard>
        <p className="font-serif text-lg leading-relaxed">No letters kept yet. That's allowed.</p>
        <p className="mt-2 text-sm text-muted-foreground">If Sunday letters are on in Settings, one will arrive at week's end.</p>
      </TactileCard>
    );
  }

  return (
    <div className="space-y-4">
      {letters.map((l) => {
        const date = new Date(l.week_start + "T00:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
        const preview = l.body.split(/\n\n+/)[1]?.slice(0, 160) ?? l.body.slice(0, 160);
        return (
          <Link key={l.id} to="/letter/$id" params={{ id: l.id }} className="block">
            <TactileCard className="transition hover:-translate-y-0.5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">Week of {date}</p>
              <p className="mt-2 font-serif text-lg leading-snug">A quiet letter</p>
              <p className="mt-2 text-sm italic leading-relaxed text-muted-foreground line-clamp-3">{preview}…</p>
            </TactileCard>
          </Link>
        );
      })}
    </div>
  );
}

function NewMemory({ onSaved }: { onSaved: () => void }) {
  const saveFn = useServerFn(saveMemory);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [feeling, setFeeling] = useState<Feeling | "">("");
  const [memoryDate, setMemoryDate] = useState("");
  const [aiReadable, setAiReadable] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTitle(""); setStory(""); setFeeling(""); setMemoryDate("");
    setAiReadable(false); setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async () => {
    if (!file) { toast.error("Choose a photo or video to keep."); return; }
    if (file.size > MAX_BYTES) { toast.error("File is over 50MB."); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("memories").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (upErr) throw upErr;
      await saveFn({ data: {
        title: title.trim() || null,
        story: story.trim() || null,
        feeling_tag: (feeling || null) as Feeling | null,
        memory_date: memoryDate || null,
        media_path: path,
        media_type: file.type.startsWith("video") ? "video" : "image",
        is_ai_readable: aiReadable,
      }});
      toast.success("Kept.");
      reset();
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button variant="outline" className="rounded-full" onClick={() => setOpen(true)}>
        Keep a new memory
      </Button>
    );
  }

  return (
    <TactileCard>
      <h2 className="font-serif text-xl">A new memory</h2>
      <div className="mt-5 space-y-4">
        <div>
          <Label>Photo or short video (max 50MB)</Label>
          <Input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1.5 rounded-xl"
          />
        </div>
        <div>
          <Label htmlFor="m-title">Title (optional)</Label>
          <Input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="mt-1.5 rounded-xl" />
        </div>
        <div>
          <Label htmlFor="m-story">The story behind this</Label>
          <Textarea
            id="m-story"
            value={story}
            onChange={(e) => setStory(e.target.value)}
            maxLength={4000}
            placeholder="What does this moment hold?"
            className="mt-1.5 min-h-[120px] rounded-xl"
          />
        </div>
        <div>
          <Label>Feeling</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {FEELINGS.map((f) => {
              const active = feeling === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFeeling(active ? "" : f.value)}
                  className={`rounded-full px-3 py-1.5 text-xs transition ${active ? FEELING_CHIP[f.value] : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <Label htmlFor="m-date">When did this happen?</Label>
          <Input id="m-date" type="date" value={memoryDate} onChange={(e) => setMemoryDate(e.target.value)} className="mt-1.5 rounded-xl" />
        </div>
        <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={aiReadable}
              onChange={(e) => setAiReadable(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm">
              <span className="font-medium">Let Quiet Companion know about this memory</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                If on, the companion may gently remember the story you wrote here. It never sees the photo or video itself — only your words about it.
              </span>
            </span>
          </label>
        </div>
        <div className="flex gap-2 pt-2">
          <Button onClick={submit} disabled={saving} className="rounded-full">
            {saving ? "Keeping…" : "Keep this"}
          </Button>
          <Button variant="outline" className="rounded-full" onClick={() => { reset(); setOpen(false); }}>
            Not now
          </Button>
        </div>
      </div>
    </TactileCard>
  );
}

function MemoryCard({ memory, onChanged }: { memory: MemoryRow; onChanged: () => void }) {
  const toggleFn = useServerFn(setMemoryReadable);
  const delFn = useServerFn(deleteMemory);
  const [burning, setBurning] = useState(false);
  const [working, setWorking] = useState(false);
  const [gone, setGone] = useState(false);

  const toggle = async () => {
    setWorking(true);
    try {
      await toggleFn({ data: { id: memory.id, is_ai_readable: !memory.is_ai_readable } });
      onChanged();
    } catch (e) { toast.error((e as Error).message); }
    finally { setWorking(false); }
  };

  const performBurn = async () => {
    setWorking(true);
    try {
      await delFn({ data: { id: memory.id } });
      // let the ember animation play, then remove card
      setTimeout(() => { setGone(true); onChanged(); }, 900);
    } catch (e) {
      toast.error((e as Error).message);
      setWorking(false);
    }
  };

  const feeling = memory.feeling_tag as Feeling | null;
  const dateStr = memory.memory_date
    ? new Date(memory.memory_date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : "Undated";

  if (gone) return null;

  return (
    <TactileCard className={working ? "ember-burn" : undefined}>
      {memory.media_url && (
        <div className="-mx-6 -mt-6 mb-5 overflow-hidden rounded-t-[28px] bg-muted/40 sm:-mx-7 sm:-mt-7">
          {memory.media_type === "video" ? (
            <video src={memory.media_url} muted controls playsInline className="w-full" />
          ) : (
            <img src={memory.media_url} alt={memory.title ?? "memory"} className="w-full object-cover" loading="lazy" />
          )}
        </div>
      )}
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">{dateStr}</p>
      {memory.title && <h3 className="mt-1.5 font-serif text-xl leading-snug">{memory.title}</h3>}
      {memory.story && <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90">{memory.story}</p>}
      {feeling && (
        <span className={`mt-3 inline-block rounded-full px-3 py-1 text-xs ${FEELING_CHIP[feeling]}`}>
          {feeling}
        </span>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-4">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={memory.is_ai_readable}
            onChange={toggle}
            disabled={working}
          />
          Share with companion
        </label>
        <button
          onClick={() => setBurning(true)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/80 transition hover:text-[color:oklch(0.68_0.14_38)]"
        >
          <Flame className="h-3.5 w-3.5" />
          Burn this memory
        </button>
      </div>

      <BurnRitual
        open={burning}
        onOpenChange={setBurning}
        title={memory.title}
        onBurn={performBurn}
      />
    </TactileCard>
  );
}

function BurnRitual({
  open, onOpenChange, title, onBurn,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string | null;
  onBurn: () => Promise<void>;
}) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [line, setLine] = useState("");

  // reset when reopened
  useMemo(() => { if (open) { setStep(0); setLine(""); } return null; }, [open]);

  const next = async () => {
    if (step === 0) return setStep(1);
    if (step === 1) return setStep(2);
    if (step === 2) {
      setStep(3);
      await onBurn();
      // close after the animation
      setTimeout(() => onOpenChange(false), 2400);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Burn a memory</DialogTitle>
          <DialogDescription>A small ritual for letting a memory go.</DialogDescription>
        </DialogHeader>

        {/* Ember visual */}
        <div className="relative mx-auto mt-2 h-32 w-32">
          <div
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 50% 60%, oklch(0.85 0.19 40) 0%, oklch(0.62 0.2 30) 40%, transparent 72%)",
              filter: "blur(6px)",
            }}
          />
          <div
            aria-hidden
            className="ember-flame absolute inset-6 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 50% 55%, oklch(0.96 0.14 90) 0%, oklch(0.78 0.2 45) 55%, oklch(0.55 0.18 25) 100%)",
            }}
          />
          {/* sparks */}
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              aria-hidden
              className="ember-spark absolute left-1/2 top-1/2 h-1 w-1 rounded-full bg-[oklch(0.9_0.16_70)]"
              style={{
                // @ts-expect-error css var
                "--ex": `${(i - 1.5) * 12}px`,
                animationDelay: `${i * 0.35}s`,
              }}
            />
          ))}
        </div>

        <div className="mt-3 text-center">
          <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">A quiet ritual</p>

          {step === 0 && (
            <>
              <h3 className="mt-2 font-serif text-xl leading-snug">
                Say goodbye to <span className="italic">{title || "this memory"}</span>?
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Nothing is undone by burning it. But sometimes it helps to mark the moment you chose to release it.
              </p>
            </>
          )}

          {step === 1 && (
            <>
              <h3 className="mt-2 font-serif text-xl leading-snug">Read it once, slowly.</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Give it the attention it asked for, one last time. Then come back.
              </p>
            </>
          )}

          {step === 2 && (
            <>
              <h3 className="mt-2 font-serif text-xl leading-snug">One line, if you want.</h3>
              <Textarea
                autoFocus
                value={line}
                onChange={(e) => setLine(e.target.value)}
                placeholder="What this memory taught you, or what you're choosing now."
                className="mt-3 min-h-[88px] rounded-xl text-sm leading-relaxed"
                maxLength={280}
              />
              <p className="mt-1.5 text-[11px] italic text-muted-foreground">
                This line isn't kept — it burns with the memory.
              </p>
            </>
          )}

          {step === 3 && (
            <>
              <h3 className="mt-2 font-serif text-xl leading-snug">Let it turn to embers.</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Warm, quiet, gone.
              </p>
            </>
          )}
        </div>

        {step < 3 && (
          <div className="mt-5 flex items-center justify-center gap-2">
            <Button variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)}>
              Keep it
            </Button>
            <Button
              className="rounded-full"
              onClick={() => { void next(); }}
            >
              {step === 0 ? "Begin" : step === 1 ? "I've read it" : "Burn it gently"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}