import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listConversations, getConversation, deleteConversation } from "@/lib/companion.functions";
import { getProfile, setCompanionTone } from "@/lib/data.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Mic, MicOff, RotateCcw, Languages, History, Settings2, Search, X, ArrowLeft, ArrowUp } from "lucide-react";
import companionMark from "@/assets/companion-mark.png";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputButton,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import {
  Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Popover, PopoverTrigger, PopoverContent,
} from "@/components/ui/popover";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";

export const Route = createFileRoute("/_app/companion")({
  component: Companion,
  validateSearch: (s: Record<string, unknown>): { seed?: string } =>
    typeof s.seed === "string" && s.seed.length <= 500 ? { seed: s.seed } : {},
  head: () => ({
    meta: [
      { title: "InnerMate — your private companion | My Quiet Space" },
      { name: "description", content: "A private companion for emotional clarity, habits, and quiet healing. Not a therapist. Crisis support included." },
      { property: "og:title", content: "InnerMate — your private companion" },
      { property: "og:description", content: "A private companion for emotional clarity, habits, and quiet healing." },
      { property: "og:url", content: "https://neeraj2019.lovable.app/companion" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://neeraj2019.lovable.app/companion" }],
  }),
});

type Phase = "listening" | "grounding" | "ready" | "crisis" | null;
type Mode = "listen" | "reset" | "habit" | "journal" | "wisdom" | "decision" | "grounding" | "safety";
type Msg = { id?: string; role: "user" | "assistant"; content: string; pending?: boolean; phase?: Phase; mode?: Mode };
type Chip = { label: string; prompt?: string; to?: string };

const CHIPS_BY_MODE: Record<Mode, Chip[]> = {
  listen: [
    { label: "Reflect deeper", prompt: "Help me sit with this and reflect a little more deeply." },
    { label: "Name the feeling", prompt: "Help me name what I'm feeling right now." },
    { label: "Save to Journal", to: "/journal" },
  ],
  reset: [
    { label: "A 20-minute pause", prompt: "Walk me through a 20-minute pause before I act on this urge." },
    { label: "Put the phone away", prompt: "Help me put my phone down for now without feeling worse." },
    { label: "Open Urge Shield", to: "/urge-shield" },
  ],
  habit: [
    { label: "Tiny promise for tomorrow", prompt: "Help me set one tiny promise for tomorrow I can actually keep." },
    { label: "3 small wins for today", prompt: "What are 3 small wins I could still do today?" },
    { label: "Start a 7-day path", to: "/heal" },
  ],
  journal: [
    { label: "Open Journal", to: "/journal" },
    { label: "One honest sentence", prompt: "Help me write one honest sentence about what's underneath this." },
    { label: "Facts vs. feelings", prompt: "Help me sort the facts from the feelings here." },
  ],
  wisdom: [
    { label: "Sit with it", prompt: "Help me just sit with this for a moment without fixing it." },
    { label: "One small action", prompt: "What's one small action that fits this idea today?" },
    { label: "Name the attachment", prompt: "Help me name what I'm holding onto here." },
  ],
  decision: [
    { label: "Facts vs. feelings", prompt: "Help me separate the facts from the feelings in this decision." },
    { label: "Wait before acting", prompt: "Convince me, kindly, to wait 24 hours before I act on this." },
    { label: "Small next step", prompt: "What's one small, reversible next step I could take instead?" },
  ],
  grounding: [
    { label: "60-second reset", to: "/sos" },
    { label: "Name 5 things", prompt: "Walk me through naming 5 things I can see right now." },
    { label: "Breathe with me", prompt: "Breathe with me — guide me through 4-4-6 for one minute." },
  ],
  // Safety mode: no reflection, no journaling — only safety answers,
  // grounding, and the door to SOS.
  safety: [
    { label: "I can stay safe", prompt: "safe" },
    { label: "I may not be safe", prompt: "not safe" },
    { label: "Ground me for 2 minutes", prompt: "Ground me for the next two minutes, one small step at a time." },
    { label: "Open SOS", to: "/sos" },
  ],
};

// Empty-state invitations — quiet openings, no wrong door.
const EMPTY_STATE_CHIPS = [
  "help me put the day down",
  "something is still tugging at me",
  "i don't know where to start",
];

// Bubble skins — dawn-tinted glass for InnerMate, quiet forest for the writer.
const ASSISTANT_BUBBLE =
  "rounded-[20px_20px_20px_6px] border border-white/[0.07] bg-[linear-gradient(150deg,color-mix(in_oklab,var(--dawn)_13%,var(--card))_0%,var(--card)_70%)] px-4 py-3 shadow-[0_18px_38px_-26px_rgb(0_0_0/0.7)] backdrop-blur-md";
const USER_BUBBLE =
  "group-[.is-user]:rounded-[20px_20px_6px_20px] group-[.is-user]:bg-[var(--forest-mid)] group-[.is-user]:text-foreground group-[.is-user]:border group-[.is-user]:border-white/[0.05]";

// One companion, many facets. The facet line is InnerMate's living
// presence in the header — it shifts with how the last reply met you.
const FACETS: Record<Mode, { line: string; tint: string }> = {
  listen:    { line: "listening, quietly",        tint: "var(--dawn)" },
  grounding: { line: "grounding, together",       tint: "var(--mint)" },
  reset:     { line: "steadying the wave",        tint: "var(--rose)" },
  habit:     { line: "building something small",  tint: "var(--amber)" },
  journal:   { line: "turning toward the page",   tint: "var(--sky)" },
  wisdom:    { line: "in slightly deeper water",  tint: "var(--lavender)" },
  decision:  { line: "slowing it down, together", tint: "var(--sky)" },
  safety:    { line: "right here with you",       tint: "var(--rose)" },
};

function todOf(h: number): "morning" | "afternoon" | "evening" | "night" {
  if (h < 5) return "night";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

function greetingFor(tod: "morning" | "afternoon" | "evening" | "night", name?: string | null) {
  const who = name ? `, ${name}` : "";
  switch (tod) {
    case "morning":   return { eyebrow: "This morning",   line: `A quiet start${who}.` };
    case "afternoon": return { eyebrow: "This afternoon", line: `You're allowed a pause${who}.` };
    case "evening":   return { eyebrow: "This evening",   line: `The day is softening${who}.` };
    case "night":     return { eyebrow: "Tonight",        line: `Be tender with yourself${who}.` };
  }
}

type ToneStyle = "gentle" | "poetic" | "practical" | null;

const TONE_STYLE_CHIPS: { label: string; value: NonNullable<ToneStyle>; description: string }[] = [
  { label: "Gentle", value: "gentle", description: "Warm, soft, patient." },
  { label: "Poetic", value: "poetic", description: "Metaphorical and spacious." },
  { label: "Practical", value: "practical", description: "Grounded, direct, actionable." },
];

const LANGUAGES: { code: string; label: string }[] = [
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "en-IN", label: "English (India)" },
  { code: "hi-IN", label: "हिन्दी (Hindi)" },
  { code: "es-ES", label: "Español" },
  { code: "fr-FR", label: "Français" },
  { code: "de-DE", label: "Deutsch" },
  { code: "pt-BR", label: "Português (BR)" },
  { code: "it-IT", label: "Italiano" },
  { code: "ja-JP", label: "日本語" },
  { code: "ko-KR", label: "한국어" },
  { code: "zh-CN", label: "中文 (简体)" },
  { code: "ar-SA", label: "العربية" },
];

const LANG_STORAGE_KEY = "qc.voiceLang";
const TONE_STORAGE_KEY = "qc.companionTone";

const PHASE_COPY: Record<Exclude<Phase, null>, string> = {
  listening: "Listening with you",
  grounding: "Taking a breath",
  ready: "Finding the words",
  crisis: "Holding this carefully",
};

function relTime(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function Companion() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const listFn = useServerFn(listConversations);
  const getFn = useServerFn(getConversation);
  const delFn = useServerFn(deleteConversation);
  const profileFn = useServerFn(getProfile);
  const setToneFn = useServerFn(setCompanionTone);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [optimistic, setOptimistic] = useState<Msg[]>([]);
  const [lastMode, setLastMode] = useState<Mode>("listen");
  const [sending, setSending] = useState(false);
  const [selectedTone, setSelectedTone] = useState<ToneStyle>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");

  const [hour, setHour] = useState<number>(() => new Date().getHours());
  useEffect(() => {
    const id = window.setInterval(() => setHour(new Date().getHours()), 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);
  const tod = todOf(hour);
  const abortRef = useRef<AbortController | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const focusTextarea = useCallback(() => { formRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus(); }, []);

  // Voice input
  const recognitionRef = useRef<any>(null);
  const baseDraftRef = useRef("");
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [lang, setLang] = useState<string>("en-US");
  const [interim, setInterim] = useState("");
  const [recordedAny, setRecordedAny] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (saved && LANGUAGES.some((l) => l.code === saved)) setLang(saved);
    else {
      const nav = navigator.language;
      const match = LANGUAGES.find((l) => l.code === nav) || LANGUAGES.find((l) => nav?.startsWith(l.code.split("-")[0]));
      if (match) setLang(match.code);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(LANG_STORAGE_KEY, lang);
    if (recognitionRef.current) recognitionRef.current.lang = lang;
  }, [lang]);

  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });
  const profileTyped = profile as { display_name?: string | null; companion_tone?: ToneStyle } | null | undefined;
  const firstName = profileTyped?.display_name?.split(" ")[0] ?? null;

  useEffect(() => {
    const remote = profileTyped?.companion_tone ?? null;
    if (remote && TONE_STYLE_CHIPS.some((c) => c.value === remote)) {
      setSelectedTone(remote);
      return;
    }
    if (typeof window === "undefined" || !profile) return;
    const saved = window.localStorage.getItem(TONE_STORAGE_KEY) as ToneStyle;
    if (saved && TONE_STYLE_CHIPS.some((c) => c.value === saved)) {
      setSelectedTone(saved);
      setToneFn({ data: { tone: saved } })
        .then(() => {
          window.localStorage.removeItem(TONE_STORAGE_KEY);
          qc.invalidateQueries({ queryKey: ["profile"] });
        })
        .catch(() => { /* noop */ });
    }
  }, [profile, profileTyped, setToneFn, qc]);

  const selectTone = useCallback((tone: ToneStyle) => {
    setSelectedTone(tone);
    setToneFn({ data: { tone } })
      .then(() => qc.invalidateQueries({ queryKey: ["profile"] }))
      .catch((e: Error) => toast.error(e.message));
  }, [setToneFn, qc]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    setSpeechSupported(true);
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;
    rec.onresult = (e: any) => {
      let interimText = "";
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (finalText) {
        baseDraftRef.current = (baseDraftRef.current + " " + finalText).trim();
        setRecordedAny(true);
      }
      setInterim(interimText);
      const combined = (baseDraftRef.current + " " + interimText).trim();
      setDraft(combined);
      if (combined) setRecordedAny(true);
    };
    rec.onend = () => { setListening(false); setInterim(""); };
    rec.onerror = (ev: any) => {
      setListening(false);
      setInterim("");
      if (ev?.error && ev.error !== "no-speech" && ev.error !== "aborted") {
        toast.error(ev.error === "not-allowed" ? "Microphone permission denied." : "Couldn't hear you. Try again.");
      }
    };
    recognitionRef.current = rec;
    return () => { try { rec.stop(); } catch { /* noop */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) {
      try { rec.stop(); } catch { /* noop */ }
      setListening(false);
      return;
    }
    baseDraftRef.current = draft;
    setInterim("");
    try { rec.start(); setListening(true); } catch { /* already started */ }
  }, [listening, draft]);

  const clearTranscript = useCallback(() => {
    setDraft(""); setInterim(""); baseDraftRef.current = ""; setRecordedAny(false);
    focusTextarea();
  }, []);

  const reRecord = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    setDraft(""); setInterim(""); baseDraftRef.current = ""; setRecordedAny(false);
    try { rec.stop(); } catch { /* noop */ }
    setTimeout(() => { try { rec.start(); setListening(true); } catch { /* noop */ } }, 150);
  }, []);

  const { data: convs } = useQuery({ queryKey: ["convs"], queryFn: () => listFn() });
  const { data: thread } = useQuery({
    queryKey: ["thread", activeId],
    queryFn: () => activeId ? getFn({ data: { id: activeId } }) : Promise.resolve({ conversation: null, messages: [] }),
    enabled: !!activeId,
  });

  useEffect(() => { focusTextarea(); }, [activeId]);
  useEffect(() => {
    setOptimistic([]);
    // Safety mode must survive thread refetches: restore it from the
    // persisted risk_label of the latest assistant message instead of
    // snapping back to "listen" and re-showing reflection chips.
    const msgs = thread?.messages ?? [];
    const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant") as
      | { risk_label?: string | null }
      | undefined;
    const label = lastAssistant?.risk_label;
    setLastMode(label === "crisis" || label === "support" ? "safety" : "listen");
  }, [activeId, thread]);

  const messages: Msg[] = useMemo(() => ([
    ...(thread?.messages ?? []).map(m => ({
      id: m.id,
      role: m.role as "user"|"assistant",
      content: m.content,
      mode: ((m as { risk_label?: string | null }).risk_label === "crisis" ||
             (m as { risk_label?: string | null }).risk_label === "support")
        ? ("safety" as Mode)
        : undefined,
    })),
    ...optimistic,
  ]), [thread, optimistic]);

  const send = useCallback(async (textOverride?: string) => {
    const text = (textOverride ?? draft).trim();
    if (!text || sending) return;
    if (listening && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* noop */ }
      setListening(false);
    }
    setDraft(""); setInterim(""); baseDraftRef.current = ""; setRecordedAny(false);
    setSending(true);
    setOptimistic([
      { role: "user", content: text },
      { role: "assistant", content: "", pending: true, phase: "listening" },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");

      const res = await fetch("/api/companion", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversationId: activeId, message: text, tone: selectedTone }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`Companion error (${res.status})`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      let convId: string | null = activeId;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const idx = line.indexOf(":");
          if (idx === -1) continue;
          const type = line.slice(0, idx);
          const payload = line.slice(idx + 1);
          if (type === "meta") {
            try {
              const parsed = JSON.parse(payload) as { conversationId: string };
              convId = parsed.conversationId;
              if (!activeId) setActiveId(parsed.conversationId);
            } catch { /* noop */ }
          } else if (type === "phase") {
            const phase = payload as Phase;
            setOptimistic(prev => prev.map((m, i) =>
              i === prev.length - 1 && m.role === "assistant"
                ? { ...m, phase, pending: !assistantText }
                : m
            ));
          } else if (type === "token") {
            try {
              const chunk = JSON.parse(payload) as string;
              assistantText += chunk;
              setOptimistic(prev => prev.map((m, i) =>
                i === prev.length - 1 && m.role === "assistant"
                  ? { ...m, content: assistantText, pending: false, phase: null }
                  : m
              ));
            } catch { /* noop */ }
          } else if (type === "mode") {
            const md = payload.trim() as Mode;
            const valid: Mode[] = ["listen","reset","habit","journal","wisdom","decision","grounding","safety"];
            if (valid.includes(md)) {
              setLastMode(md);
              setOptimistic(prev => prev.map((msg, i) =>
                i === prev.length - 1 && msg.role === "assistant"
                  ? { ...msg, mode: md }
                  : msg
              ));
            }
          }
        }
      }

      if (convId) {
        qc.invalidateQueries({ queryKey: ["thread", convId] });
        qc.invalidateQueries({ queryKey: ["convs"] });
      }
      setOptimistic([]);
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error((e as Error).message);
      setOptimistic([]);
    } finally {
      abortRef.current = null;
      setSending(false);
      focusTextarea();
    }
  }, [draft, sending, activeId, qc, listening, selectedTone]);

  const onSuggestion = useCallback((text: string) => {
    setDraft(text);
    void send(text);
  }, [send]);

  // Consume ?seed=… from Home's feeling chips once, then clear it so refresh doesn't resend.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (!search.seed) return;
    if (sending) return;
    seededRef.current = true;
    const text = search.seed;
    navigate({ to: "/companion", search: {}, replace: true });
    void send(text);
  }, [search.seed, sending, send, navigate]);

  const newConversation = useCallback(() => {
    setActiveId(null);
    setOptimistic([]);
    setDraft("");
    setHistoryOpen(false);
    setTimeout(() => focusTextarea(), 50);
  }, []);

  const filteredConvs = useMemo(() => {
    const list = convs ?? [];
    const q = historySearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(c => (c.title ?? "").toLowerCase().includes(q));
  }, [convs, historySearch]);

  const greeting = greetingFor(tod, firstName);
  const lastConv = convs?.[0];
  const sendStatus: "ready" | "submitted" | "streaming" = sending
    ? (optimistic.some(m => m.role === "assistant" && m.content) ? "streaming" : "submitted")
    : "ready";

  return (
    <div className="relative mx-auto flex h-[100dvh] max-w-3xl flex-col md:h-screen">
      {/* Header */}
      <header className="flex items-center gap-2 px-4 py-3 sm:px-5">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Back to home"
          className="h-9 w-9 shrink-0 rounded-full border border-white/10 bg-card/40 backdrop-blur-md hover:bg-card/70"
          onClick={() => navigate({ to: "/home" })}
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
        </Button>
        <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
          <SheetTrigger asChild>
            <Button size="icon" variant="ghost" aria-label="Conversation history" className="h-9 w-9 rounded-full">
              <History className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[320px] sm:w-[360px] p-0 flex flex-col">
            <SheetHeader className="px-4 pt-5 pb-3">
              <SheetTitle className="font-serif text-base">Conversations</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-3 space-y-2">
              <Button onClick={newConversation} className="w-full rounded-xl" variant="outline">
                <Plus className="mr-1 h-4 w-4" />New conversation
              </Button>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/70" />
                <Input
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search…"
                  className="h-9 rounded-lg pl-8 text-sm"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {(filteredConvs?.length ?? 0) === 0 ? (
                <p className="px-3 py-6 text-center text-xs italic text-muted-foreground">
                  {historySearch ? "Nothing matches." : "No conversations yet. Start one — it stays private."}
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {filteredConvs.map(c => (
                    <li key={c.id} className={`group flex items-center gap-1 rounded-lg px-1.5 ${activeId===c.id ? "bg-primary/10" : "hover:bg-card/60"}`}>
                      <button
                        onClick={() => { setActiveId(c.id); setHistoryOpen(false); }}
                        className="flex-1 min-w-0 py-2.5 text-left"
                      >
                        <p className="truncate text-sm text-foreground">{c.title || "Untitled"}</p>
                        {c.updated_at && (
                          <p className="text-[10px] text-muted-foreground">{relTime(c.updated_at)}</p>
                        )}
                      </button>
                      <button
                        onClick={async () => {
                          if (!window.confirm("Let this conversation go? You can always begin another.")) return;
                          await delFn({ data: { id: c.id } });
                          if (activeId===c.id) setActiveId(null);
                          qc.invalidateQueries({ queryKey: ["convs"] });
                        }}
                        aria-label="Delete conversation"
                        className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </SheetContent>
        </Sheet>

        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--dawn)_16%,var(--card))] ring-1 ring-white/[0.18]">
          <img src={companionMark} alt="" width={36} height={36} className="h-full w-full rounded-full" loading="lazy" />
        </span>
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-[15px] font-medium leading-tight truncate text-foreground">
            InnerMate
          </h1>
          <motion.p
            key={lastMode}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-1.5 text-[11px] italic leading-tight truncate text-muted-foreground"
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 flex-none rounded-full transition-colors duration-500"
              style={{ background: FACETS[lastMode].tint, boxShadow: `0 0 6px ${FACETS[lastMode].tint}` }}
            />
            {FACETS[lastMode].line}
          </motion.p>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost" aria-label="Tone settings" className="h-9 w-9 rounded-full">
              <Settings2 className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <p className="qs-section-label">tone</p>
            <p className="mt-1 mb-3 text-[11px] text-muted-foreground">How should InnerMate meet you?</p>
            <div className="space-y-1.5">
              {TONE_STYLE_CHIPS.map(chip => {
                const active = selectedTone === chip.value;
                return (
                  <button
                    key={chip.value}
                    onClick={() => selectTone(active ? null : chip.value)}
                    className={`w-full text-left rounded-lg border px-3 py-2 text-xs transition ${
                      active ? "border-primary/40 bg-primary/10" : "border-border/50 hover:border-primary/30 hover:bg-card"
                    }`}
                  >
                    <p className="font-medium text-foreground">{chip.label}</p>
                    <p className="text-[11px] text-muted-foreground">{chip.description}</p>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        <Button size="icon" variant="ghost" aria-label="New conversation" className="h-9 w-9 rounded-full" onClick={newConversation}>
          <Plus className="h-4 w-4" />
        </Button>
      </header>
      <span aria-hidden className="pointer-events-none mx-5 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />

      {/* Conversation */}
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-5">
          {messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center text-center pt-8 pb-4 sm:pt-12"
            >
              {/* Glowing companion mark */}
              <div className="relative mb-7 flex h-24 w-24 items-center justify-center">
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_45%,color-mix(in_oklab,var(--dawn)_38%,transparent),transparent_72%)] blur-lg motion-safe:animate-[qs-breathe_7s_ease-in-out_infinite]"
                />
                <span
                  aria-hidden
                  className="absolute inset-2.5 rounded-full bg-[color-mix(in_oklab,var(--dawn)_14%,var(--card))] ring-1 ring-white/[0.18]"
                />
                <img
                  src={companionMark}
                  alt=""
                  width={66}
                  height={66}
                  className="relative h-[66px] w-[66px] rounded-full"
                  loading="lazy"
                />
              </div>
              <p className="qs-section-label">{greeting.eyebrow}</p>
              <h2 className="mt-3 max-w-sm font-serif text-[1.6rem] font-light leading-snug tracking-tight text-foreground sm:text-[1.85rem]">
                What's sitting with you today?
              </h2>
              <p className="mt-4 max-w-xs text-[13.5px] leading-relaxed text-muted-foreground">
                {greeting.line} Begin anywhere. There's no wrong way to start.
              </p>

              <div className="mt-7 flex max-w-md flex-wrap justify-center gap-2">
                {EMPTY_STATE_CHIPS.map((label) => (
                  <button key={label} type="button" onClick={() => onSuggestion(label)} className="qs-chip">
                    {label}
                  </button>
                ))}
              </div>

              {/* One companion — the facets live inside it, not as a menu */}
              <p className="mt-8 max-w-[30ch] font-serif text-[13px] italic leading-relaxed text-muted-foreground/80">
                One companion — it listens, steadies, helps you build, and
                sits with you in deeper water when you need it.
              </p>
              {lastConv && (
                <button
                  onClick={() => setActiveId(lastConv.id)}
                  className="mt-7 text-xs text-muted-foreground transition hover:text-foreground underline-offset-4 hover:underline"
                >
                  Continue last · <span className="italic">{lastConv.title || "Untitled"}</span>
                </button>
              )}
            </motion.div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((m, i) => {
                const isLatestCompletedAssistant = m.role === "assistant" && !m.pending && i === messages.length - 1 && !!m.content;
                return (
                  <motion.div
                    key={`${m.id ?? i}-${m.role}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    <Message from={m.role}>
                      {m.role === "assistant" && m.pending ? (
                        <MessageContent className={ASSISTANT_BUBBLE}>
                          <span className="flex items-center gap-2.5 py-0.5">
                            <span aria-hidden className="flex items-center gap-1">
                              <span className="qs-typing-dot" />
                              <span className="qs-typing-dot" style={{ animationDelay: "0.18s" }} />
                              <span className="qs-typing-dot" style={{ animationDelay: "0.36s" }} />
                            </span>
                            <span className="text-xs italic text-muted-foreground">
                              {(m.phase && m.phase !== "ready" ? PHASE_COPY[m.phase] : "Quietly thinking") + "…"}
                            </span>
                          </span>
                        </MessageContent>
                      ) : m.role === "assistant" ? (
                        <MessageContent className={ASSISTANT_BUBBLE}>
                          <MessageResponse>{m.content}</MessageResponse>
                          {/* Suggestion chips stay out of normal conversation —
                              they render ONLY in safety mode, where the
                              safe/not-safe/SOS buttons are load-bearing. */}
                          {isLatestCompletedAssistant && (m.mode ?? lastMode) === "safety" && (
                            <motion.div
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.4, delay: 0.2 }}
                              className="mt-3 flex flex-wrap gap-2"
                            >
                              {CHIPS_BY_MODE.safety.map(chip => (
                                <button
                                  key={chip.label}
                                  onClick={() => {
                                    if (chip.to) navigate({ to: chip.to });
                                    else if (chip.prompt) onSuggestion(chip.prompt);
                                  }}
                                  className="qs-chip"
                                >
                                  {chip.label}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </MessageContent>
                      ) : (
                        <MessageContent className={USER_BUBBLE}>{m.content}</MessageContent>
                      )}
                    </Message>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Composer */}
      <div className="px-4 pb-4 sm:px-5">
        <AnimatePresence initial={false}>
          {listening && (
            <motion.div
              key="listening-bar"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="mx-auto mb-2 max-w-2xl flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2"
            >
              <div className="flex items-center gap-2 text-xs text-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                <span className="font-medium">Listening</span>
                {interim && <span className="ml-1 max-w-[220px] truncate italic text-muted-foreground">"{interim}"</span>}
              </div>
              <Button size="sm" variant="ghost" className="h-7 rounded-full px-2 text-xs" onClick={toggleListening}>Stop</Button>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={formRef} className="mx-auto max-w-2xl">
          <PromptInput
            className="[&>div]:rounded-[24px] [&>div]:border-white/10 [&>div]:bg-card/45 [&>div]:shadow-[0_18px_44px_-28px_rgb(0_0_0/0.75)] [&>div]:backdrop-blur-xl"
            onSubmit={(msg) => { void send(msg.text || draft); }}
          >
            <PromptInputTextarea
              className="bg-transparent"
              value={draft}
              onChange={(e) => setDraft(e.currentTarget.value)}
              placeholder={
                listening
                  ? "Listening… speak gently"
                  : lastMode === "safety"
                    ? "Reply with safe or not safe…"
                    : "What is here right now?"
              }
              aria-label="Message InnerMate"
            />
            <PromptInputFooter>
              <PromptInputTools>
                {speechSupported ? (
                  <PromptInputButton
                    type="button"
                    onClick={toggleListening}
                    variant={listening ? "default" : "ghost"}
                    aria-label={listening ? "Stop voice input" : "Start voice input"}
                    title={listening ? "Stop" : "Speak"}
                  >
                    <Mic className="h-4 w-4" />
                  </PromptInputButton>
                ) : (
                  <PromptInputButton type="button" disabled aria-label="Voice unavailable" title="Voice input not supported">
                    <MicOff className="h-4 w-4" />
                  </PromptInputButton>
                )}
                {speechSupported && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <PromptInputButton type="button" aria-label="Voice language" title="Voice language">
                        <Languages className="h-4 w-4" />
                      </PromptInputButton>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-56 p-2">
                      <p className="px-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Voice language</p>
                      <Select value={lang} onValueChange={setLang}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LANGUAGES.map(l => (
                            <SelectItem key={l.code} value={l.code} className="text-xs">{l.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </PopoverContent>
                  </Popover>
                )}
                {speechSupported && recordedAny && !listening && (
                  <PromptInputButton type="button" onClick={reRecord} aria-label="Re-record" title="Re-record">
                    <RotateCcw className="h-4 w-4" />
                  </PromptInputButton>
                )}
                {draft && (
                  <PromptInputButton type="button" onClick={clearTranscript} aria-label="Clear" title="Clear">
                    <X className="h-4 w-4" />
                  </PromptInputButton>
                )}
              </PromptInputTools>
              <PromptInputSubmit
                status={sendStatus}
                disabled={!draft.trim() && sendStatus === "ready"}
                onStop={() => { abortRef.current?.abort(); }}
                className="h-9 w-9 rounded-full bg-[linear-gradient(140deg,var(--dawn),color-mix(in_oklab,var(--dawn)_78%,oklch(0.6_0.05_100)))] text-[oklch(0.26_0.02_155)] shadow-[0_12px_26px_-14px_color-mix(in_oklab,var(--dawn)_70%,transparent)] hover:brightness-110"
              >
                {sendStatus === "ready" ? <ArrowUp className="h-4 w-4" strokeWidth={1.7} /> : null}
              </PromptInputSubmit>
            </PromptInputFooter>
          </PromptInput>
          <p className="mt-2 text-center text-[10px] italic text-muted-foreground">
            A reflection guide, not a therapist. In a crisis: Tele-MANAS 14416.
          </p>
        </div>
      </div>
    </div>
  );
}
