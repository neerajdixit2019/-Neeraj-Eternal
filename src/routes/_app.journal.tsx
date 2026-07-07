import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listJournal, saveJournal, deleteJournal } from "@/lib/data.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Feather, Shuffle } from "lucide-react";
import { usePrivacyMode } from "@/hooks/use-privacy";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/_app/journal")({
  component: Journal,
  head: () => ({
    meta: [
      { title: "Private journal | My Quiet Space" },
      { name: "description", content: "Write freely in a private journal. Yours alone, encrypted in transit, delete any time." },
      { property: "og:title", content: "Private journal" },
      { property: "og:description", content: "Write freely in a private journal — yours alone, delete any time." },
      { property: "og:url", content: "https://neeraj2019.lovable.app/journal" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://neeraj2019.lovable.app/journal" }],
  }),
});

const PROMPTS = [
  "what am I not saying out loud?",
  "what would I tell a friend in this?",
  "what am I still holding that I'm ready to release?",
  "what did I need from them that I can now give myself?",
  "what is true today — not what fear is telling me?",
  "what would I say if nobody judged me?",
  "what small thing went right?",
  "what is my body trying to tell me?",
  "what am I afraid to hope for?",
  "if today had a color, what would it be, and why?",
];

type JournalMode = {
  key: string;       // stored as entry_type (saveJournal accepts arbitrary strings up to 40 chars)
  label: string;     // seeds the entry title (except free writing)
  whisper: string;   // one-line invitation on the mode card
  placeholder: string; // mode-specific body placeholder
};

const MODES: JournalMode[] = [
  {
    key: "free",
    label: "Free writing",
    whisper: "no shape, no rules",
    placeholder: "write it here before you send it anywhere…",
  },
  {
    key: "unsent_letter",
    label: "Unsent letter",
    whisper: "say it without sending it",
    placeholder: "Dear —, here is what I never said…",
  },
  {
    key: "fact_vs_feeling",
    label: "Fact vs feeling",
    whisper: "untangle what happened from what it felt like",
    placeholder: "What happened, plainly: …\nWhat it felt like: …",
  },
  {
    key: "fear_vs_reality",
    label: "Fear vs reality",
    whisper: "what fear says, what is actually true",
    placeholder: "What fear says: …\nWhat is actually true: …",
  },
  {
    key: "need_tonight",
    label: "What I need tonight",
    whisper: "ask the tired part of you",
    placeholder: "if the tired part of me could ask for one thing tonight…",
  },
  {
    key: "avoiding",
    label: "What I am avoiding",
    whisper: "name it gently, that's all",
    placeholder: "the thing I keep stepping around is…",
  },
  {
    key: "honest_gratitude",
    label: "Gratitude without fake positivity",
    whisper: "one true good thing, however small",
    placeholder: "one true good thing today, however small…",
  },
  {
    key: "future_self",
    label: "A letter to my future self",
    whisper: "for the you who will read this later",
    placeholder: "to the me who reads this later…",
  },
];

const FREE_MODE = MODES[0];

// listJournal doesn't return entry_type, so the timeline detects a mode
// from the title (each mode seeds its title with the mode name).
function detectMode(title: string | null | undefined): JournalMode | null {
  if (!title) return null;
  const t = title.toLowerCase();
  return MODES.find(m => m.key !== "free" && t.startsWith(m.label.toLowerCase())) ?? null;
}

function monthKey(d: Date) {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function Journal() {
  const qc = useQueryClient();
  const list = useServerFn(listJournal);
  const save = useServerFn(saveJournal);
  const del = useServerFn(deleteJournal);
  const { data: entries } = useQuery({ queryKey: ["journal"], queryFn: () => list() });

  const [editing, setEditing] = useState<{ id: string | null; title: string; body: string; mode: JournalMode } | null>(null);
  const { enabled: privacy } = usePrivacyMode();

  // Rotating "a question for tonight" — deterministic first render (index 0),
  // shuffled on the client only, so server and client HTML match.
  const [promptIndex, setPromptIndex] = useState(0);
  useEffect(() => {
    setPromptIndex(Math.floor(Math.random() * PROMPTS.length));
  }, []);
  const shufflePrompt = () =>
    setPromptIndex(i => (i + 1 + Math.floor(Math.random() * (PROMPTS.length - 1))) % PROMPTS.length);
  const writeFromPrompt = () => {
    const p = PROMPTS[promptIndex];
    setEditing(e => e ? { ...e, body: (e.body ? e.body + "\n\n" : "") + p + "\n\n" } : e);
  };

  const start = (mode: JournalMode, id: string | null = null, title?: string, body = "") =>
    setEditing({
      id,
      title: title ?? (mode.key === "free" ? "" : mode.label),
      body,
      mode,
    });

  // ---- Autosave editor ----
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [savingNow, setSavingNow] = useState(false);
  const currentIdRef = useRef<string | null>(null);
  useEffect(() => { currentIdRef.current = editing?.id ?? null; }, [editing?.id]);

  useEffect(() => {
    if (!editing) return;
    // A title still equal to the seeded mode label counts as empty —
    // opening a mode and backing out must never write a row.
    const titleIsSeed =
      editing.mode.key !== "free" && editing.title.trim() === editing.mode.label;
    if (!editing.body.trim() && (titleIsSeed || !editing.title.trim())) return;
    const t = setTimeout(async () => {
      try {
        setSavingNow(true);
        const res = await save({ data: {
          id: currentIdRef.current,
          title: editing.title || undefined,
          body: editing.body,
          emotion_tags: [],
          entry_type: editing.mode.key,
        }}) as { id?: string } | undefined;
        if (res?.id && !currentIdRef.current) currentIdRef.current = res.id;
        setSavedAt(Date.now());
        track("journal_entry_autosaved");
        qc.invalidateQueries({ queryKey: ["journal"] });
      } catch { /* silent — will retry on next change */ }
      finally { setSavingNow(false); }
    }, 1200);
    return () => clearTimeout(t);
  }, [editing, save, qc]);

  const savedLabel = savingNow ? "saving…" : savedAt ? "saved a moment ago" : "nothing saved yet";

  if (editing) return (
    <div className="motion-calm mx-auto max-w-2xl px-5 py-8 sm:px-8">
      <div className="flex items-center justify-between">
        <button onClick={() => setEditing(null)} className="text-sm text-muted-foreground">← back to the vault</button>
        <span className="text-[11px] italic text-muted-foreground">{savedLabel}</span>
      </div>
      <div className="parchment mt-5 p-5 sm:p-7">
        <p className="font-serif italic text-sm text-muted-foreground">
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        {editing.mode.key !== "free" && (
          <p className="mt-1 font-serif italic text-[13px] text-muted-foreground/80">{editing.mode.whisper}</p>
        )}
        <Input
          aria-label="Journal entry title"
          className="mt-3 h-12 rounded-xl border-transparent bg-transparent text-xl font-serif focus-visible:border-border/60"
          placeholder="a title, if you'd like…"
          value={editing.title}
          onChange={e => setEditing({ ...editing, title: e.target.value })}
        />
        <Textarea
          aria-label="Journal entry body"
          className="mt-2 min-h-[420px] rounded-xl border-transparent bg-transparent text-base leading-[1.75] focus-visible:border-border/60"
          placeholder={editing.mode.placeholder}
          value={editing.body}
          onChange={e => setEditing({ ...editing, body: e.target.value })}
        />
      </div>
      <div className="glass mt-4 rounded-2xl px-4 py-4">
        <p className="qs-section-label">a question for tonight</p>
        <p className="mt-2 font-serif italic text-[15px] leading-relaxed">{PROMPTS[promptIndex]}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="qs-chip inline-flex items-center gap-1.5" onClick={shufflePrompt}>
            <Shuffle className="h-3.5 w-3.5" strokeWidth={1.7} /> another question
          </button>
          <button className="qs-chip inline-flex items-center gap-1.5" onClick={writeFromPrompt}>
            <Feather className="h-3.5 w-3.5" strokeWidth={1.7} /> write from this
          </button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/companion" className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm transition hover:border-primary/30 hover:bg-card/50">reflect with InnerMate</Link>
      </div>
    </div>
  );

  // ---- Timeline list ----
  const grouped = useMemo(() => {
    const map = new Map<string, typeof entries>();
    for (const e of entries ?? []) {
      const key = monthKey(new Date(e.created_at));
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [entries]);

  return (
    <div className="motion-calm relative mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
      <span aria-hidden className="qs-firefly" style={{ top: "6%", left: "82%", pointerEvents: "none" }} />
      <span aria-hidden className="qs-firefly" style={{ top: "22%", left: "6%", pointerEvents: "none" }} />

      <p className="qs-section-label">your private vault</p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <h1 className="font-serif text-3xl font-light leading-tight tracking-tight sm:text-[2.4rem]">Journal</h1>
        <button className="qs-pill-cta" onClick={() => start(FREE_MODE)}>
          <Feather className="h-4 w-4" strokeWidth={1.7} /> Begin tonight's page
        </button>
      </div>
      <p className="mt-2 font-serif italic text-[15px] leading-relaxed text-muted-foreground">
        a page that's only yours
      </p>
      <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-muted-foreground/80">
        yours alone. autosaves as you write. delete anytime.
      </p>

      <div className="mt-8">
        <p className="qs-section-label">or begin with a shape</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {MODES.map(m => (
            <button
              key={m.key}
              onClick={() => start(m)}
              className="glass rounded-2xl px-4 py-3.5 text-left transition hover:bg-card/60"
            >
              <p className="font-serif text-[15px] leading-snug">{m.label}</p>
              <p className="mt-1 text-xs italic leading-relaxed text-muted-foreground">{m.whisper}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10">
        {entries?.length ? (
          <>
            <p className="qs-section-label">pages you've kept</p>
            <ol className="mt-4 space-y-8">
              {grouped.map(([month, items]) => (
                <li key={month} className="space-y-3">
                  <p className="font-serif italic text-sm text-muted-foreground/80">{month}</p>
                  <ul className="space-y-3">
                    {items!.map(e => {
                      const mode = detectMode(e.title);
                      return (
                        <li key={e.id} className="group relative">
                          <button
                            className="glass block w-full rounded-2xl px-4 py-3.5 text-left transition hover:bg-card/60"
                            onClick={() => { start(mode ?? FREE_MODE, e.id, e.title ?? "", e.body); setSavedAt(Date.now()); }}
                          >
                            {mode && (
                              <span className="qs-chip pointer-events-none mb-1.5 inline-flex text-[10px]">
                                {mode.label.toLowerCase()}
                              </span>
                            )}
                            <p className={`font-serif text-base leading-snug ${privacy ? "blur-sm select-none" : ""}`}>
                              {e.title || (e.body.split("\n")[0].slice(0, 60) || "untitled")}
                            </p>
                            <p className={`mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-1 ${privacy ? "blur-sm select-none" : ""}`}>
                              {e.body}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground/70">
                              {new Date(e.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </p>
                          </button>
                          <button
                            onClick={async () => {
                              if (!window.confirm("let this entry go? you can always write another.")) return;
                              await del({ data: { id: e.id } });
                              qc.invalidateQueries({ queryKey: ["journal"] });
                            }}
                            className="absolute right-3 top-3 hidden items-center gap-1 rounded-full px-2 py-1 text-[11px] italic text-muted-foreground transition hover:text-foreground group-hover:inline-flex"
                            aria-label="delete entry"
                          >
                            <Trash2 className="h-3 w-3" strokeWidth={1.7} /> let it go
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <div className="parchment px-6 py-10 text-center">
            <p className="font-serif text-xl leading-snug">Your Vault is quiet.</p>
            <p className="mt-2 font-serif italic text-sm text-muted-foreground">Write one honest line.</p>
            <button className="qs-pill-cta mt-6" onClick={() => start(FREE_MODE)}>Begin tonight's page</button>
          </div>
        )}
      </div>

      <p className="mt-12 text-center font-serif text-[13px] italic text-muted-foreground">
        writing it down isn't committing to it. it's just letting it breathe.
      </p>
    </div>
  );
}
