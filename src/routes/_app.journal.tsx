import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listJournal, saveJournal, deleteJournal } from "@/lib/data.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, Feather } from "lucide-react";
import { toast } from "sonner";
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

function monthKey(d: Date) {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function Journal() {
  const qc = useQueryClient();
  const list = useServerFn(listJournal);
  const save = useServerFn(saveJournal);
  const del = useServerFn(deleteJournal);
  const { data: entries } = useQuery({ queryKey: ["journal"], queryFn: () => list() });

  const [editing, setEditing] = useState<{ id: string | null; title: string; body: string } | null>(null);
  const { enabled: privacy } = usePrivacyMode();

  // Rotating sub-prompt (stable per mount)
  const subPrompt = useMemo(() => PROMPTS[Math.floor(Math.random() * PROMPTS.length)], []);

  const start = (id: string | null = null, title = "", body = "") => setEditing({ id, title, body });
  const insertPrompt = () => {
    const p = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
    setEditing(e => e ? { ...e, body: (e.body ? e.body + "\n\n" : "") + p + "\n\n" } : { id: null, title: "", body: p + "\n\n" });
  };

  // ---- Autosave editor ----
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [savingNow, setSavingNow] = useState(false);
  const currentIdRef = useRef<string | null>(null);
  useEffect(() => { currentIdRef.current = editing?.id ?? null; }, [editing?.id]);

  useEffect(() => {
    if (!editing) return;
    if (!editing.body.trim() && !editing.title.trim()) return;
    const t = setTimeout(async () => {
      try {
        setSavingNow(true);
        const res = await save({ data: {
          id: currentIdRef.current,
          title: editing.title || undefined,
          body: editing.body,
          emotion_tags: [],
          entry_type: "free",
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
        <button onClick={() => setEditing(null)} className="text-sm text-muted-foreground">← back</button>
        <span className="text-[11px] italic text-muted-foreground">{savedLabel}</span>
      </div>
      <div className="parchment mt-5 p-5 sm:p-7">
        <p className="font-serif italic text-sm text-muted-foreground">
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
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
          placeholder="write it here before you send it anywhere…"
          value={editing.body}
          onChange={e => setEditing({ ...editing, body: e.target.value })}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" className="rounded-full" onClick={insertPrompt}>
          <Feather className="mr-1 h-4 w-4" />give me a prompt
        </Button>
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
    <div className="motion-calm mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">a page that's only yours</p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <h1 className="font-serif text-3xl sm:text-[2.4rem] leading-tight">what's alive today?</h1>
        <button className="soft-arrow" onClick={() => start()}>
          <Plus className="h-4 w-4" /> begin
        </button>
      </div>
      <p className="mt-3 max-w-lg font-serif italic text-[15px] leading-relaxed text-muted-foreground">
        {subPrompt}
      </p>
      <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-muted-foreground/80">
        yours alone. autosaves as you write. delete anytime.
      </p>

      <div className="mt-10">
        {entries?.length ? (
          <ol className="relative ml-3 border-l border-border/40 pl-6 space-y-8">
            {grouped.map(([month, items]) => (
              <li key={month} className="space-y-4">
                <p className="-ml-9 font-serif italic text-sm text-muted-foreground/80">{month}</p>
                <ul className="space-y-3">
                  {items!.map(e => (
                    <li key={e.id} className="group relative">
                      <span aria-hidden className="absolute -left-[27px] top-2 h-2 w-2 rounded-full bg-[color-mix(in_oklab,var(--dawn)_60%,transparent)]" />
                      <button
                        className="block w-full rounded-xl px-3 py-3 text-left transition hover:bg-card/60"
                        onClick={() => { start(e.id, e.title ?? "", e.body); setSavedAt(Date.now()); }}
                      >
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
                        className="absolute right-2 top-2 hidden items-center gap-1 rounded-full px-2 py-1 text-[11px] italic text-muted-foreground transition hover:text-foreground group-hover:inline-flex"
                        aria-label="delete entry"
                      >
                        <Trash2 className="h-3 w-3" /> let go
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        ) : (
          <div className="parchment px-6 py-10 text-center">
            <p className="font-serif text-xl leading-snug">your first page is blank on purpose.</p>
            <p className="mt-2 text-sm italic text-muted-foreground">no pressure to fill it.</p>
            <Button className="mt-6 rounded-full" onClick={() => start()}>begin</Button>
          </div>
        )}
      </div>

      <p className="mt-12 text-center text-[13px] italic text-muted-foreground">
        writing it down is not committing to it. it's just letting it breathe.
      </p>
    </div>
  );
}