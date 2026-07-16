import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listJournal, saveJournal, deleteJournal } from "@/lib/data.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Feather, Shuffle, Mic } from "lucide-react";
import { usePrivacyMode } from "@/hooks/use-privacy";
import { useDictation, DICTATION_LANGUAGES } from "@/hooks/use-dictation";
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
  const [saveFailed, setSaveFailed] = useState(false);
  const currentIdRef = useRef<string | null>(null);
  // Only track while an editor is open — the id must survive the close so the
  // flush below updates the same row instead of writing a duplicate.
  useEffect(() => { if (editing) currentIdRef.current = editing.id; }, [editing]);

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
        savingNowRef.current = true;
        const res = await save({ data: {
          id: currentIdRef.current,
          title: editing.title || undefined,
          body: editing.body,
          emotion_tags: [],
          entry_type: editing.mode.key,
        }}) as { id?: string } | undefined;
        if (res?.id && !currentIdRef.current) currentIdRef.current = res.id;
        savedSnapRef.current = editing.title + "\n" + editing.body;
        setSavedAt(Date.now());
        setSaveFailed(false);
        track("journal_entry_autosaved");
        qc.invalidateQueries({ queryKey: ["journal"] });
      } catch {
        // Not silent anymore — an honest clay margin note; retry happens on
        // the next keystroke's debounce as before.
        setSaveFailed(true);
      }
      finally { setSavingNow(false); savingNowRef.current = false; }
    }, 1200);
    return () => clearTimeout(t);
  }, [editing, save, qc]);

  // THE FLUSH — closing the page must never lose the last 1.2 seconds of
  // writing (typed or spoken): the debounce dies with the editor, so whatever
  // it hadn't kept yet is saved here, against the same row.
  const lastEditingRef = useRef<typeof editing>(null);
  const savedSnapRef = useRef<string>("");
  const savingNowRef = useRef(false);
  useEffect(() => { if (editing) lastEditingRef.current = editing; }, [editing]);
  useEffect(() => {
    if (editing) return;
    const snap = lastEditingRef.current;
    lastEditingRef.current = null;
    if (!snap) return;
    const titleIsSeed = snap.mode.key !== "free" && snap.title.trim() === snap.mode.label;
    if (!snap.body.trim() && (titleIsSeed || !snap.title.trim())) return;
    if (savedSnapRef.current === snap.title + "\n" + snap.body) return; // already kept
    if (savingNowRef.current) return; // an in-flight save is carrying this content
    void save({ data: {
      id: currentIdRef.current,
      title: snap.title || undefined,
      body: snap.body,
      emotion_tags: [],
      entry_type: snap.mode.key,
    }})
      .then(() => {
        savedSnapRef.current = snap.title + "\n" + snap.body;
        qc.invalidateQueries({ queryKey: ["journal"] });
      })
      .catch(() => { /* the vault still shows the last version that kept */ });
  }, [editing, save, qc]);

  const savedLabel = savingNow ? "keeping…" : savedAt ? "kept · a moment ago" : "nothing kept yet";

  // Voice writing — spoken phrases land in the body exactly as typed ones do,
  // so the same autosave (and every save/privacy contract) carries them.
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const dictation = useDictation((text) => {
    const node = bodyRef.current;
    if (node && document.activeElement === node) {
      // Someone is hand-editing mid-body while speaking: append through the
      // DOM so their caret stays put (a controlled-value swap would fling it
      // to the end), then sync state from the node.
      const glue = !node.value ? "" : /\s$/.test(node.value) ? "" : " ";
      node.setRangeText(glue + text, node.value.length, node.value.length, "preserve");
      const next = node.value;
      setEditing((e) => (e ? { ...e, body: next } : e));
      return;
    }
    setEditing((e) => {
      if (!e) return e;
      const glue = !e.body ? "" : /\s$/.test(e.body) ? "" : " ";
      return { ...e, body: e.body + glue + text };
    });
  });
  // Leaving the page always puts the pen down.
  const dictationStop = dictation.stop;
  useEffect(() => {
    if (!editing) dictationStop();
  }, [editing, dictationStop]);

  // Month-grouped timeline. MUST live above the editor's early return —
  // hooks after a conditional return break React's hook ordering the
  // moment `editing` flips ("Rendered fewer hooks than expected").
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

  if (editing) return (
    <div className="motion-calm mx-auto max-w-2xl px-5 py-8 sm:px-8">
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            // Mid-listening, give the recognizer a beat to flush the last
            // phrase (it arrives as one final onresult) before the page closes;
            // the close-flush effect then keeps whatever landed.
            if (dictation.listening) {
              dictation.stop();
              setTimeout(() => setEditing(null), 350);
            } else {
              setEditing(null);
            }
          }}
          className="text-sm text-muted-foreground"
        >← back to the vault</button>
        <span className="margin-note italic">{savedLabel}</span>
      </div>
      {saveFailed && (
        <p className="margin-note margin-note--error mt-3" role="status">
          this page didn't keep — trying again as you write.
        </p>
      )}
      {/* THE PAGE — the app's one paper surface: ink on warm paper, the only
          drop shadow in the room. The prompt sits as faint pencil marginalia. */}
      <div
        className="mt-5 rounded-[4px] p-5 sm:p-7"
        style={{
          background: "var(--paper)",
          color: "var(--ink)",
          boxShadow: "0 16px 48px rgba(10, 8, 4, 0.5)",
        }}
      >
        <p className="font-serif italic text-sm" style={{ color: "color-mix(in oklab, var(--ink) 70%, var(--paper))" }}>
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        {editing.mode.key !== "free" && (
          <p className="mt-1 font-serif italic text-[13px]" style={{ color: "color-mix(in oklab, var(--ink) 66%, var(--paper))" }}>{editing.mode.whisper}</p>
        )}
        <Input
          aria-label="Journal entry title"
          className="mt-3 h-12 rounded-md border-transparent bg-transparent font-serif text-xl text-[color:var(--ink)] placeholder:text-[color:color-mix(in_oklab,var(--ink)_66%,var(--paper))] focus-visible:border-[color:var(--paper-shadow)]"
          placeholder="a title, if you'd like…"
          value={editing.title}
          onChange={e => setEditing({ ...editing, title: e.target.value })}
        />
        <Textarea
          ref={bodyRef}
          aria-label="Journal entry body"
          className="font-reading mt-2 min-h-[420px] rounded-md border-transparent bg-transparent text-[17px] leading-[1.75] text-[color:var(--ink)] placeholder:text-[color:color-mix(in_oklab,var(--ink)_66%,var(--paper))] focus-visible:border-[color:var(--paper-shadow)]"
          placeholder={editing.mode.placeholder}
          value={editing.body}
          onChange={e => setEditing({ ...editing, body: e.target.value })}
        />

        {/* VOICE WRITING — speak onto the page. The words you're still saying
            ghost in as pencil; finished phrases set as ink above. */}
        {dictation.supported && (
          <div className="mt-1 border-t pt-3" style={{ borderColor: "color-mix(in oklab, var(--ink) 12%, transparent)" }}>
            {dictation.interim && (
              <p aria-hidden className="font-reading mb-2 text-[15px] italic leading-relaxed" style={{ color: "color-mix(in oklab, var(--ink) 55%, var(--paper))" }}>
                {dictation.interim}…
              </p>
            )}
            {dictation.error && (
              <p className="mb-2 text-[12.5px]" role="status" style={{ color: "var(--clay)" }}>{dictation.error}</p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={dictation.toggle}
                aria-pressed={dictation.listening}
                aria-label={dictation.listening ? "Stop voice writing" : "Start voice writing"}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition hover:brightness-95"
                style={dictation.listening
                  ? { borderColor: "color-mix(in oklab, var(--deodar) 55%, transparent)", background: "color-mix(in oklab, var(--deodar) 14%, var(--paper))", color: "color-mix(in oklab, var(--deodar) 70%, var(--ink))" }
                  : { borderColor: "color-mix(in oklab, var(--ink) 30%, transparent)", color: "color-mix(in oklab, var(--ink) 80%, var(--paper))" }}
              >
                {dictation.listening ? (
                  <>
                    <span className="relative flex h-2 w-2" aria-hidden>
                      <span className="absolute inline-flex h-full w-full motion-safe:animate-ping rounded-full opacity-60" style={{ background: "var(--deodar)" }} />
                      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "var(--deodar)" }} />
                    </span>
                    listening — tap to stop
                  </>
                ) : (
                  <>
                    <Mic className="h-3.5 w-3.5" strokeWidth={1.8} />
                    speak onto the page
                  </>
                )}
              </button>
              <label className="inline-flex min-h-11 items-center gap-1.5 text-[12px]" style={{ color: "color-mix(in oklab, var(--ink) 70%, var(--paper))" }}>
                <span className="sr-only">Voice language</span>
                <select
                  value={dictation.lang}
                  onChange={(e) => dictation.setLang(e.target.value)}
                  disabled={dictation.listening}
                  aria-label="Voice language"
                  className="rounded-md border bg-transparent px-2 py-1.5 text-[12px] outline-none disabled:opacity-50"
                  style={{ borderColor: "color-mix(in oklab, var(--ink) 22%, transparent)", color: "inherit" }}
                >
                  {DICTATION_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="mt-2 text-[11px] italic leading-relaxed" style={{ color: "color-mix(in oklab, var(--ink) 66%, var(--paper))" }}>
              voice writing uses your browser's speech service — spoken words may pass through your
              device's provider while you speak. the page itself stays yours alone.
            </p>
          </div>
        )}
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
        <Link
          to="/companion"
          onClick={() => {
            // Carry this entry into InnerMate. We stash it in sessionStorage
            // (never the URL — a journal entry is private) so the companion
            // can open the conversation with what was just written, at any length.
            const t = editing.title.trim();
            const b = editing.body.trim();
            const titlePart = t && t !== editing.mode.label ? t : "";
            const text = [titlePart, b].filter(Boolean).join("\n\n").trim();
            try { if (text) sessionStorage.setItem("innermate.reflect", text); } catch { /* noop */ }
          }}
          className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm transition hover:border-primary/30 hover:bg-card/50"
        >
          reflect with InnerMate
        </Link>
      </div>
    </div>
  );

  // ---- Timeline list ----
  return (
    <div className="motion-calm relative mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
      <span aria-hidden className="qs-firefly" style={{ top: "6%", left: "82%", pointerEvents: "none" }} />
      <span aria-hidden className="qs-firefly" style={{ top: "22%", left: "6%", pointerEvents: "none" }} />

      <p className="qs-section-label">your private vault</p>
      <h1 className="mt-3 font-serif text-3xl font-light leading-tight tracking-tight sm:text-[2.4rem]">Journal</h1>
      <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-muted-foreground">
        yours alone. keeps itself as you write. let any page go, anytime.
      </p>

      {/* TONIGHT'S PAGE — already waiting under the lamp. One tap begins. */}
      <div className="relative mt-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-6"
          style={{ background: "radial-gradient(24rem 12rem at 50% 40%, color-mix(in oklab, var(--lamp) 9%, transparent), transparent 70%)" }}
        />
        <button
          onClick={() => start(FREE_MODE)}
          className="relative block w-full rounded-[4px] px-6 py-7 text-left transition hover:-translate-y-0.5"
          style={{ background: "var(--paper)", color: "var(--ink)", boxShadow: "0 16px 48px rgba(10, 8, 4, 0.5)" }}
        >
          <p className="font-serif italic text-sm" style={{ color: "color-mix(in oklab, var(--ink) 70%, var(--paper))" }}>
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <p className="font-reading mt-2 text-[17px]" style={{ color: "color-mix(in oklab, var(--ink) 72%, var(--paper))" }}>
            tonight's page is waiting…
          </p>
          <p className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "color-mix(in oklab, var(--ember) 55%, var(--ink))" }}>
            <Feather className="h-3.5 w-3.5" strokeWidth={1.7} /> begin writing
          </p>
        </button>
      </div>

      {/* the shapes, demoted to a line of ink whispers */}
      <p className="mt-5 text-[13px] leading-[1.9] text-muted-foreground">
        or begin with a shape:{" "}
        {MODES.filter(m => m.key !== "free").map((m, i, arr) => (
          <span key={m.key}>
            <button
              onClick={() => start(m)}
              className="underline decoration-transparent underline-offset-4 transition hover:decoration-current hover:text-foreground"
              title={m.whisper}
            >
              {m.label.toLowerCase()}
            </button>
            {i < arr.length - 1 ? " · " : ""}
          </span>
        ))}
      </p>

      <div className="mt-10">
        {entries?.length ? (
          <>
            <p className="qs-section-label">pages you've kept</p>
            {/* THE LEDGER — ruled rows, date hung in the margin, "let it go"
                always visible (hover-only delete fails on touch). */}
            <ol className="mt-4 space-y-8">
              {grouped.map(([month, items]) => (
                <li key={month} className="space-y-1">
                  <p className="font-serif italic text-sm text-muted-foreground">{month}</p>
                  <ul>
                    {items!.map(e => {
                      const mode = detectMode(e.title);
                      return (
                        <li
                          key={e.id}
                          className="flex items-start gap-3 border-t py-3.5"
                          style={{ borderColor: "color-mix(in oklab, var(--paper-shadow) 10%, transparent)" }}
                        >
                          <span className="w-12 shrink-0 pt-0.5 text-right text-[11px] tabular-nums text-muted-foreground">
                            {new Date(e.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                          <button
                            className="min-w-0 flex-1 text-left"
                            onClick={() => { start(mode ?? FREE_MODE, e.id, e.title ?? "", e.body); setSavedAt(Date.now()); }}
                          >
                            <p className={`font-serif text-base leading-snug ${privacy ? "blur-sm select-none" : ""}`}>
                              {e.title || (e.body.split("\n")[0].slice(0, 60) || "untitled")}
                              {mode && <span className="ml-2 align-middle text-[11px] font-sans italic text-muted-foreground">· {mode.label.toLowerCase()}</span>}
                            </p>
                            <p className={`mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground line-clamp-1 ${privacy ? "blur-sm select-none" : ""}`}>
                              {e.body}
                            </p>
                          </button>
                          <button
                            onClick={async () => {
                              if (!window.confirm("let this entry go? you can always write another.")) return;
                              await del({ data: { id: e.id } });
                              qc.invalidateQueries({ queryKey: ["journal"] });
                            }}
                            className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] italic text-muted-foreground/80 transition hover:text-foreground"
                            aria-label={`Let go of entry: ${e.title || "untitled"}`}
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
          <div className="mt-2 px-6 py-8 text-center">
            <p className="font-serif text-xl font-light leading-snug">no pages yet — the desk is ready.</p>
            <p className="mt-2 font-serif italic text-sm text-muted-foreground">one honest line is a whole beginning.</p>
          </div>
        )}
      </div>

      <p className="mt-12 text-center font-serif text-[13px] italic text-muted-foreground">
        writing it down isn't committing to it. it's just letting it breathe.
      </p>
    </div>
  );
}
