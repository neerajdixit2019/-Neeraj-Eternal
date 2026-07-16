import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  ArrowLeft,
  Heart,
  CloudRain,
  Brain,
  Briefcase,
  Users,
  HelpCircle,
  Home as HomeIcon,
  Wind,
  Lock,
  Sparkles,
  Phone,
  LifeBuoy,
  BookOpen,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { submitReflectionFeedback } from "@/lib/reflect.functions";
import { VerseQuote } from "@/components/VerseQuote";
import { randomVerse } from "@/lib/verses";

type ResponseMode = "listen" | "clarity" | "grounding" | "decision" | "celebration";
type FeedbackRating = "yes" | "a_little" | "not_really";
type FeedbackReason =
  | "felt_too_generic"
  | "too_much_advice"
  | "did_not_understand_me"
  | "too_long"
  | "too_clinical"
  | "too_emotional"
  | "repetitive"
  | "other";

const REASON_OPTIONS: { id: FeedbackReason; label: string }[] = [
  { id: "felt_too_generic", label: "Felt too generic" },
  { id: "too_much_advice", label: "Too much advice" },
  { id: "did_not_understand_me", label: "Did not understand me" },
  { id: "too_long", label: "Too long" },
  { id: "too_clinical", label: "Too clinical" },
  { id: "too_emotional", label: "Too emotional" },
  { id: "repetitive", label: "Repetitive" },
  { id: "other", label: "Other" },
];

export const Route = createFileRoute("/_app/reflect")({
  component: Reflect,
  head: () => ({
    meta: [
      { title: "Reflect — a quiet guided session | My Quiet Space" },
      { name: "description", content: "Write what's here, get one grounded reflection back, and choose a small next step." },
      { property: "og:title", content: "Reflect — a quiet guided session" },
      { property: "og:description", content: "Write what's here and get one grounded reflection back." },
      { property: "og:url", content: "https://neeraj2019.lovable.app/reflect" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://neeraj2019.lovable.app/reflect" }],
  }),
});

type Category =
  | "Heartbreak"
  | "Loneliness"
  | "Anxiety"
  | "Overthinking"
  | "Relationship confusion"
  | "Work pressure"
  | "Family stress"
  | "Something else";

type SaveMode = "private" | "ephemeral";
type RiskLevel = "normal" | "elevated" | "crisis";

type MicroAction = {
  type: "breathing" | "grounding" | "journal" | "pause" | "reach_out";
  title: string;
  instructions: string;
  duration_minutes: number;
};

type Reflection = {
  risk_level: RiskLevel;
  response_mode?: ResponseMode;
  title: string;
  what_i_hear: string;
  possible_underneath: string[];
  gentle_question: string;
  micro_action: MicroAction;
  encourage_human_support: boolean;
  show_crisis_support: boolean;
};

type GuidedReply = {
  risk_level: RiskLevel;
  response_mode?: ResponseMode;
  reply: string;
  gentle_question: string;
  micro_action: MicroAction;
  encourage_human_support: boolean;
  show_crisis_support: boolean;
  session_complete: boolean;
  closing_note: string;
};

const MAX_REPLIES = 4;

const CATEGORIES: { label: Category; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: "Heartbreak", icon: Heart },
  { label: "Loneliness", icon: CloudRain },
  { label: "Anxiety", icon: Wind },
  { label: "Overthinking", icon: Brain },
  { label: "Relationship confusion", icon: Users },
  { label: "Work pressure", icon: Briefcase },
  { label: "Family stress", icon: Users },
  { label: "Something else", icon: HelpCircle },
];

const PROMPTS = [
  "What are you replaying?",
  "What do you wish you could say?",
  "What feels hardest to accept?",
];

type Step = "checkin" | "write" | "loading" | "result" | "guided" | "error";

function Reflect() {
  const [step, setStep] = useState<Step>("checkin");
  const [category, setCategory] = useState<Category | null>(null);
  const [intensity, setIntensity] = useState(5);
  const [entry, setEntry] = useState("");
  const [saveMode, setSaveMode] = useState<SaveMode>("ephemeral");
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const [reflectionId, setReflectionId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ephemeralToken, setEphemeralToken] = useState<string | null>(null);
  // initial entry kept in-memory for ephemeral guided context (never persisted)
  const initialEntryRef = useRef<string>("");
  // guided follow-up state
  const [aiReplyCount, setAiReplyCount] = useState<number>(1);
  const [guidedTurns, setGuidedTurns] = useState<Array<{ user: string; ai: GuidedReply }>>([]);
  const [followupText, setFollowupText] = useState("");
  const [followupLoading, setFollowupLoading] = useState(false);
  const [followupError, setFollowupError] = useState(false);

  const sendFeedback = useServerFn(submitReflectionFeedback);
  const navigate = useNavigate();

  const sessionComplete =
    aiReplyCount >= MAX_REPLIES ||
    guidedTurns.some((t) => t.ai.session_complete) ||
    (reflection?.risk_level === "crisis");

  // Clear in-memory ephemeral context if user navigates away.
  useEffect(() => {
    return () => {
      initialEntryRef.current = "";
    };
  }, []);

  const back = () => {
    if (step === "write") setStep("checkin");
    else if (step === "result" || step === "guided" || step === "error") {
      setReflection(null);
      setReflectionId(null);
      setSessionId(null);
      setEphemeralToken(null);
      setGuidedTurns([]);
      setAiReplyCount(1);
      setFollowupText("");
      initialEntryRef.current = "";
      setStep("write");
    } else if (step === "loading") return;
    else navigate({ to: "/home" });
  };

  const onSubmitWriting = async () => {
    const trimmed = entry.trim();
    if (trimmed.length === 0) {
      toast("Write as little or as much as you need before continuing.");
      return;
    }
    setStep("loading");
    try {
      const { data, error } = await supabase.functions.invoke("generate-reflection", {
        body: {
          session_id: null,
          category,
          intensity,
          message: trimmed,
          save_mode: saveMode,
          conversation_turn_number: 1,
        },
      });
      if (error || !data?.reflection) {
        setStep("error");
        return;
      }
      setReflection(data.reflection as Reflection);
      setReflectionId((data.reflection_id as string | null) ?? null);
      setSessionId((data.session_id as string | null) ?? null);
      setEphemeralToken((data.ephemeral_session_token as string | null) ?? null);
      setAiReplyCount(1);
      setGuidedTurns([]);
      // Keep initial entry in memory for ephemeral guided context only — never persisted.
      initialEntryRef.current = trimmed;
      // Clear the visible textarea field.
      setEntry("");
      setStep("result");
    } catch {
      setStep("error");
    }
  };

  const onFeedback = async (input: {
    rating: FeedbackRating;
    reasons: FeedbackReason[];
    targetReflectionId: string | null;
    response_mode?: ResponseMode;
  }) => {
    try {
      await sendFeedback({
        data: {
          reflection_id: saveMode === "private" ? input.targetReflectionId : null,
          rating: input.rating,
          reasons: input.reasons,
          response_mode: input.response_mode,
          save_mode: saveMode,
          category: category ?? undefined,
          intensity,
        },
      });
      toast("Thank you — this helps Quiet Guide listen better.");
    } catch {
      toast("Could not send feedback. Please try again later.");
    }
  };

  const onContinueGently = () => {
    setFollowupText("");
    setFollowupError(false);
    setStep("guided");
  };

  const onSubmitFollowup = async () => {
    const trimmed = followupText.trim();
    if (!trimmed) {
      toast("Write what comes up. A few honest words are enough.");
      return;
    }
    if (aiReplyCount >= MAX_REPLIES) return;
    setFollowupLoading(true);
    setFollowupError(false);
    try {
      const body: Record<string, unknown> = {
        session_id: sessionId,
        save_mode: saveMode,
        message: trimmed,
        ephemeral_session_token: saveMode === "ephemeral" ? ephemeralToken : null,
        ephemeral_context:
          saveMode === "ephemeral" && reflection
            ? {
                category,
                intensity,
                initial_user_message: initialEntryRef.current,
                prior_ai_reflections: [reflection, ...guidedTurns.map((t) => t.ai)],
                prior_user_followups: guidedTurns.map((t) => t.user),
              }
            : null,
      };
      const { data, error } = await supabase.functions.invoke("continue-reflection", { body });
      if (error || !data?.reflection) {
        setFollowupError(true);
        return;
      }
      const ai = data.reflection as GuidedReply;
      setGuidedTurns((prev) => [...prev, { user: trimmed, ai }]);
      setAiReplyCount(Number(data.ai_reply_count ?? aiReplyCount + 1));
      if (data.ephemeral_session_token) setEphemeralToken(data.ephemeral_session_token as string);
      setFollowupText("");
    } catch {
      setFollowupError(true);
    } finally {
      setFollowupLoading(false);
    }
  };

  const onPauseHere = () => {
    // Clear ephemeral context immediately.
    initialEntryRef.current = "";
    setFollowupText("");
    navigate({ to: "/home" });
  };

  return (
    <div className="mx-auto w-full max-w-xl px-5 pb-16 pt-6 sm:px-8 sm:pt-10">
      {step !== "loading" && (
        <button
          onClick={back}
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> back
        </button>
      )}

      {step === "checkin" && (
        <CheckIn
          category={category}
          setCategory={setCategory}
          intensity={intensity}
          setIntensity={setIntensity}
          onContinue={() => setStep("write")}
        />
      )}
      {step === "write" && (
        <Write
          entry={entry}
          setEntry={setEntry}
          saveMode={saveMode}
          setSaveMode={setSaveMode}
          onSubmit={onSubmitWriting}
        />
      )}
      {step === "loading" && <Loading />}
      {step === "error" && <ErrorView onRetry={onSubmitWriting} onHome={() => navigate({ to: "/home" })} />}
      {step === "result" && reflection && reflection.risk_level === "crisis" && (
        <CrisisView
          reflection={reflection}
          onCalm={() => navigate({ to: "/sos" })}
        />
      )}
      {step === "result" && reflection && reflection.risk_level !== "crisis" && (
        <Result
          reflection={reflection}
          onFeedback={onFeedback}
          reflectionId={reflectionId}
          onHome={() => navigate({ to: "/home" })}
          onCalm={() => navigate({ to: "/sos" })}
          canContinue={aiReplyCount < MAX_REPLIES}
          onContinue={onContinueGently}
        />
      )}
      {step === "guided" && reflection && (
        <Guided
          initial={reflection}
          turns={guidedTurns}
          aiReplyCount={aiReplyCount}
          followupText={followupText}
          setFollowupText={setFollowupText}
          loading={followupLoading}
          error={followupError}
          onSubmit={onSubmitFollowup}
          onPause={onPauseHere}
          onHome={() => navigate({ to: "/home" })}
          onCalm={() => navigate({ to: "/sos" })}
          onJournal={() => navigate({ to: "/journal" })}
          savedPrivately={saveMode === "private"}
          sessionComplete={sessionComplete}
          onFeedback={onFeedback}
          reflectionId={reflectionId}
        />
      )}
    </div>
  );
}

function CheckIn({
  category,
  setCategory,
  intensity,
  setIntensity,
  onContinue,
}: {
  category: Category | null;
  setCategory: (c: Category) => void;
  intensity: number;
  setIntensity: (n: number) => void;
  onContinue: () => void;
}) {
  return (
    <div className="fade-in">
      <h1 className="font-serif text-3xl leading-snug sm:text-4xl">What feels heaviest right now?</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Choose what is closest. It does not need to explain everything.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CATEGORIES.map(({ label, icon: Icon }) => {
          const active = category === label;
          return (
            <button
              key={label}
              onClick={() => setCategory(label)}
              className={`flex items-center gap-4 rounded-2xl border p-5 text-left transition-all ${
                active
                  ? "border-primary bg-primary/[0.06] shadow-sm"
                  : "border-border bg-card/50 hover:border-muted-foreground/20 hover:bg-card"
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className={`text-base ${active ? "font-medium text-foreground" : "text-muted-foreground"}`}>{label}</span>
            </button>
          );
        })}
      </div>

      {category && (
        <div className="fade-in mt-8 rounded-3xl border border-border bg-card/50 p-6">
          <p className="text-sm text-muted-foreground">How heavy does it feel right now?</p>
          <div className="mt-6">
            <Slider value={[intensity]} min={1} max={10} step={1} onValueChange={(v) => setIntensity(v[0])} />
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>1 · a quiet weight</span>
            <span className="font-serif text-2xl text-foreground">{intensity}</span>
            <span>10 · difficult to carry</span>
          </div>
        </div>
      )}

      <Button onClick={onContinue} disabled={!category} className="mt-8 h-14 w-full rounded-full text-base shadow-sm">
        Continue
      </Button>
    </div>
  );
}

const MAX_CHARS = 4000;

function Write({
  entry,
  setEntry,
  saveMode,
  setSaveMode,
  onSubmit,
}: {
  entry: string;
  setEntry: (s: string) => void;
  saveMode: SaveMode;
  setSaveMode: (m: SaveMode) => void;
  onSubmit: () => void;
}) {
  const insertPrompt = (p: string) => {
    if (entry.trim().length === 0) setEntry(p + " ");
  };

  return (
    <div className="fade-in">
      <h1 className="font-serif text-2xl leading-snug sm:text-3xl">You do not need to make it sound perfect.</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Write what happened, what you feel, or what your mind keeps replaying.
      </p>

      <div className="mt-6 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60">Optional prompts</p>
        <div className="flex flex-wrap gap-2">
          {PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => insertPrompt(p)}
              className="rounded-full border border-border bg-card/60 px-4 py-2 text-sm text-muted-foreground transition hover:border-muted-foreground/30 hover:bg-card hover:text-foreground"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <Textarea
        value={entry}
        onChange={(e) => setEntry(e.target.value.slice(0, MAX_CHARS))}
        placeholder="Start anywhere…"
        className="mt-4 min-h-[280px] resize-none rounded-[1.75rem] border-border bg-card/40 p-6 text-base leading-relaxed shadow-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary/20"
      />
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground/70">
        <span className="inline-flex items-center gap-1.5">
          <Lock className="h-3 w-3" /> Your writing is private. You choose whether it is saved.
        </span>
        <span>
          {entry.length}/{MAX_CHARS}
        </span>
      </div>

      <div className="mt-6 space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60">After you continue</p>
        <PrivacyOption
          active={saveMode === "ephemeral"}
          onClick={() => setSaveMode("ephemeral")}
          title="Just for this moment"
          desc="Use this writing only for the current reflection. Nothing is stored — not the writing, not the reflection."
        />
        <PrivacyOption
          active={saveMode === "private"}
          onClick={() => setSaveMode("private")}
          title="Save privately"
          desc="Keep this entry and the reflection in your personal space so you can return to them later."
        />
      </div>

      <Button onClick={onSubmit} className="mt-8 h-14 w-full rounded-full text-base shadow-sm">
        Receive a Quiet Reflection
      </Button>
    </div>
  );
}

function PrivacyOption({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`block w-full rounded-2xl border p-4 text-left transition ${
        active ? "border-primary bg-primary/[0.06]" : "border-border bg-card/50 hover:bg-card"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
            active ? "border-primary" : "border-muted-foreground/40"
          }`}
        >
          {active && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
        </span>
        <div>
          <p className={`text-sm font-medium ${active ? "text-foreground" : "text-foreground/90"}`}>{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>
        </div>
      </div>
    </button>
  );
}

function Loading() {
  return (
    <div className="fade-in flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="relative h-14 w-14">
        <span className="absolute inset-0 motion-safe:animate-ping rounded-full bg-primary/20" />
        <span className="absolute inset-2 rounded-full bg-primary/40" />
      </div>
      <p className="mt-6 font-serif text-xl text-foreground/90">Creating a quiet reflection…</p>
      <p className="mt-2 text-sm text-muted-foreground">This usually takes a few seconds.</p>
    </div>
  );
}

function ErrorView({ onRetry, onHome }: { onRetry: () => void; onHome: () => void }) {
  return (
    <div className="fade-in mt-10">
      <h1 className="font-serif text-2xl text-foreground">Something interrupted the reflection.</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Your writing has not been lost. Please try again in a moment.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <Button onClick={onRetry} className="h-12 rounded-full">
          Try again
        </Button>
        <Button onClick={onHome} variant="ghost" className="h-12 rounded-full">
          <HomeIcon className="h-4 w-4" /> Return Home
        </Button>
      </div>
    </div>
  );
}

function CrisisView({ reflection, onCalm }: { reflection: Reflection; onCalm: () => void }) {
  const callTeleManas = () => {
    window.location.href = "tel:14416";
  };
  return (
    <div className="fade-in">
      <p className="inline-flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
        <LifeBuoy className="h-3.5 w-3.5" /> Your safety comes first
      </p>
      <h1 className="mt-4 font-serif text-3xl leading-snug">{reflection.title}</h1>
      <p className="mt-4 text-base leading-relaxed text-foreground/90">{reflection.what_i_hear}</p>

      <div className="mt-6 rounded-3xl border border-destructive/30 bg-destructive/[0.04] p-6">
        <p className="text-sm font-medium text-foreground">If you are in immediate danger</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Please contact your local emergency services right now. In India, you can also reach{" "}
          <span className="font-medium text-foreground">Tele-MANAS at 14416</span> — free, confidential, available any time.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-3">
        <Button onClick={callTeleManas} className="h-12 rounded-full">
          <Phone className="h-4 w-4" /> Call Tele-MANAS (14416)
        </Button>
        <Button
          onClick={() => toast("Open your contacts and reach out to someone you trust — even a single sentence is enough.")}
          variant="outline"
          className="h-12 rounded-full"
        >
          Contact Someone I Trust
        </Button>
        <Button onClick={onCalm} variant="ghost" className="h-12 rounded-full">
          Return to Calm Tools
        </Button>
      </div>
    </div>
  );
}

function Result({
  reflection,
  onFeedback,
  reflectionId,
  onHome,
  onCalm,
  canContinue,
  onContinue,
}: {
  reflection: Reflection;
  onFeedback: (input: {
    rating: FeedbackRating;
    reasons: FeedbackReason[];
    targetReflectionId: string | null;
    response_mode?: ResponseMode;
  }) => void;
  reflectionId: string | null;
  onHome: () => void;
  onCalm: () => void;
  canContinue: boolean;
  onContinue: () => void;
}) {
  const elevated = reflection.risk_level === "elevated";
  const mode: ResponseMode = (reflection.response_mode ?? "listen") as ResponseMode;
  const isGrounding = mode === "grounding";
  const isListen = mode === "listen";
  const isDecision = mode === "decision";
  const isCelebration = mode === "celebration";
  return (
    <div className="fade-in">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">a quiet reflection</p>
      <h1 className="mt-3 font-serif text-3xl sm:text-4xl">{reflection.title}</h1>

      <div className="mt-6">
        <VerseQuote initial={randomVerse()} variant="plain" />
      </div>

      {(elevated || reflection.encourage_human_support) && (
        <div className="mt-5 rounded-2xl border border-border bg-card/50 p-4 text-sm leading-relaxed text-muted-foreground">
          What you wrote sounds heavy. Alongside this reflection, please consider reaching out to a person you trust or a
          qualified professional. You do not have to carry this alone.
        </div>
      )}

      <div className="mt-8 space-y-4">
        <Card heading={isGrounding ? "A grounding pause" : "What I hear"}>
          <p className={`font-serif leading-relaxed text-foreground/90 ${isGrounding ? "text-lg" : "text-base"}`}>
            {reflection.what_i_hear}
          </p>
        </Card>

        {!isGrounding && !isCelebration && reflection.possible_underneath.length > 0 && (
          <Card heading="What may be underneath">
            <ul className="space-y-2.5">
              {reflection.possible_underneath.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-foreground/90">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {isDecision && (
          <Card heading="Before you act">
            <p className="font-serif text-base leading-relaxed text-foreground/90">
              Before acting, separate what you know from what you are assuming.
            </p>
          </Card>
        )}

        {reflection.gentle_question && !isGrounding && (
          <Card heading="One gentle question">
            <p className="font-serif text-base leading-relaxed text-foreground/90">{reflection.gentle_question}</p>
          </Card>
        )}

        <MicroActionCard action={reflection.micro_action} emphasized={isGrounding} soft={isListen} />
      </div>

      <FeedbackBlock
        onSubmit={(rating, reasons) =>
          onFeedback({ rating, reasons, targetReflectionId: reflectionId, response_mode: reflection.response_mode })
        }
      />

      <div className="mt-8 flex flex-col gap-3">
        {canContinue && (
          <Button onClick={onContinue} className="h-12 rounded-full">
            Continue Gently
          </Button>
        )}
        <Button onClick={onCalm} variant="outline" className="h-12 rounded-full">
          Try a Calming Tool
        </Button>
        <Button onClick={onHome} variant="ghost" className="h-12 rounded-full">
          <HomeIcon className="h-4 w-4" /> Return Home
        </Button>
      </div>
    </div>
  );
}

function Card({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border bg-card/60 p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">{heading}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function MicroActionCard({
  action,
  emphasized,
  soft,
}: {
  action: MicroAction;
  emphasized?: boolean;
  soft?: boolean;
}) {
  if (emphasized) {
    return (
      <div className="rounded-3xl border-2 border-primary/40 bg-primary/[0.08] p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-primary/80">Try this now</p>
        <p className="mt-3 font-serif text-xl leading-snug text-foreground">{action.title}</p>
        <p className="mt-3 text-base leading-relaxed text-foreground/90">{action.instructions}</p>
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-background/70 px-3 py-1 text-[11px] text-muted-foreground">
          <Sparkles className="h-3 w-3" /> {action.duration_minutes} min
        </p>
      </div>
    );
  }
  if (soft) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground/70">If you want, later</p>
        <p className="mt-2 text-sm leading-relaxed text-foreground/80">
          <span className="font-medium">{action.title}.</span> {action.instructions}
        </p>
      </div>
    );
  }
  return (
    <Card heading="A small next step">
      <p className="text-sm font-medium text-foreground/90">{action.title}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{action.instructions}</p>
      <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-[11px] text-muted-foreground">
        <Sparkles className="h-3 w-3" /> {action.duration_minutes} min · {action.type.replace("_", " ")}
      </p>
    </Card>
  );
}

function FeedbackBlock({
  onSubmit,
  compact,
}: {
  onSubmit: (rating: FeedbackRating, reasons: FeedbackReason[]) => void;
  compact?: boolean;
}) {
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [reasons, setReasons] = useState<FeedbackReason[]>([]);
  const [sent, setSent] = useState(false);

  const toggleReason = (r: FeedbackReason) =>
    setReasons((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const choose = (r: FeedbackRating) => {
    setRating(r);
    if (r === "yes") {
      onSubmit(r, []);
      setSent(true);
    }
  };

  const submitWithReasons = () => {
    if (!rating) return;
    onSubmit(rating, reasons);
    setSent(true);
  };

  if (sent) {
    return (
      <div className={`flex items-center justify-center gap-2 text-xs text-muted-foreground ${compact ? "mt-4" : "mt-6"}`}>
        <Check className="h-3.5 w-3.5" /> Thank you for the feedback.
      </div>
    );
  }

  return (
    <div className={compact ? "mt-4" : "mt-6"}>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs text-muted-foreground">Was this helpful?</span>
        {(
          [
            { id: "yes", label: "Yes" },
            { id: "a_little", label: "A little" },
            { id: "not_really", label: "Not really" },
          ] as { id: FeedbackRating; label: string }[]
        ).map((opt) => (
          <Button
            key={opt.id}
            onClick={() => choose(opt.id)}
            variant={rating === opt.id ? "default" : "outline"}
            size="sm"
            className="h-8 rounded-full text-xs"
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {rating && rating !== "yes" && (
        <div className="fade-in mt-4 rounded-2xl border border-border bg-card/40 p-4">
          <p className="text-xs text-muted-foreground">Optional — what made it feel that way?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {REASON_OPTIONS.map((r) => {
              const active = reasons.includes(r.id);
              return (
                <button
                  key={r.id}
                  onClick={() => toggleReason(r.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-background/60 text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex justify-end">
            <Button onClick={submitWithReasons} size="sm" className="h-8 rounded-full text-xs">
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const FOLLOWUP_MAX = 2000;

function Guided({
  initial,
  turns,
  aiReplyCount,
  followupText,
  setFollowupText,
  loading,
  error,
  onSubmit,
  onPause,
  onHome,
  onCalm,
  onJournal,
  savedPrivately,
  sessionComplete,
  onFeedback,
  reflectionId,
}: {
  initial: Reflection;
  turns: Array<{ user: string; ai: GuidedReply }>;
  aiReplyCount: number;
  followupText: string;
  setFollowupText: (s: string) => void;
  loading: boolean;
  error: boolean;
  onSubmit: () => void;
  onPause: () => void;
  onHome: () => void;
  onCalm: () => void;
  onJournal: () => void;
  savedPrivately: boolean;
  sessionComplete: boolean;
  onFeedback: (input: {
    rating: FeedbackRating;
    reasons: FeedbackReason[];
    targetReflectionId: string | null;
    response_mode?: ResponseMode;
  }) => void;
  reflectionId: string | null;
}) {
  // The "current" gentle question is the last AI reply's question, or the initial one.
  const currentQuestion =
    turns.length > 0
      ? turns[turns.length - 1].ai.gentle_question
      : initial.gentle_question;

  // Progress: replies are 1..MAX_REPLIES. The next reply about to be generated is aiReplyCount + 1.
  const nextReplyNumber = Math.min(aiReplyCount + 1, MAX_REPLIES);

  const lastTurn = turns[turns.length - 1];
  const closingNote = lastTurn?.ai.closing_note ?? "";
  const closingAction = lastTurn?.ai.micro_action;

  return (
    <div className="fade-in">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        {sessionComplete ? "guided reflection complete" : `Guided reflection ${nextReplyNumber} of ${MAX_REPLIES}`}
      </p>
      <h1 className="mt-3 font-serif text-2xl leading-snug sm:text-3xl">A quiet follow-up</h1>

      {/* Prior turns rendered as calm reflection cards (no chat bubbles) */}
      <div className="mt-8 space-y-6">
        {turns.map((t, i) => (
          <div key={i} className="space-y-3">
            <div className="rounded-3xl border border-dashed border-border bg-muted/30 p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">You wrote</p>
              <p className="mt-2 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{t.user}</p>
            </div>
            <div className="rounded-3xl border border-border bg-card/60 p-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">A quiet reflection</p>
              <p
                className={`mt-3 font-serif leading-relaxed text-foreground/90 ${
                  t.ai.response_mode === "grounding" ? "text-lg" : "text-base"
                }`}
              >
                {t.ai.reply}
              </p>
              {t.ai.response_mode === "decision" && (
                <p className="mt-4 rounded-2xl bg-muted/50 px-4 py-3 text-sm leading-relaxed text-foreground/80">
                  Before acting, separate what you know from what you are assuming.
                </p>
              )}
              {t.ai.gentle_question && t.ai.response_mode !== "grounding" && (
                <p className="mt-4 font-serif text-base italic text-foreground/80">“{t.ai.gentle_question}”</p>
              )}
              <div className="mt-4">
                <MicroActionCard
                  action={t.ai.micro_action}
                  emphasized={t.ai.response_mode === "grounding"}
                  soft={t.ai.response_mode === "listen"}
                />
              </div>
              <FeedbackBlock
                compact
                onSubmit={(rating, reasons) =>
                  onFeedback({
                    rating,
                    reasons,
                    // Per-turn replies are not stored in `reflections`, so leave null.
                    targetReflectionId: i === 0 ? reflectionId : null,
                    response_mode: t.ai.response_mode,
                  })
                }
              />
            </div>
          </div>
        ))}
      </div>

      {/* If session is complete, show closing message and exit actions */}
      {sessionComplete ? (
        <div className="mt-10">
          {closingNote && (
            <div className="rounded-3xl border border-border bg-card/60 p-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">A closing note</p>
              <p className="mt-3 font-serif text-base leading-relaxed text-foreground/90">{closingNote}</p>
            </div>
          )}
          <p className="mt-6 font-serif text-lg leading-relaxed text-foreground/90">
            You have given this feeling some space. Let the next step happen away from the screen.
          </p>
          {closingAction && (
            <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/[0.05] p-5">
              <p className="text-sm font-medium text-foreground">{closingAction.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{closingAction.instructions}</p>
            </div>
          )}

          <div className="mt-8 flex flex-col gap-3">
            <Button onClick={onCalm} variant="outline" className="h-12 rounded-full">
              Try a Calming Tool
            </Button>
            <Button onClick={onHome} variant="ghost" className="h-12 rounded-full">
              <HomeIcon className="h-4 w-4" /> Return Home
            </Button>
            {savedPrivately && (
              <Button onClick={onJournal} variant="ghost" className="h-12 rounded-full">
                <BookOpen className="h-4 w-4" /> View My Journal
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Current gentle question + writing area */}
          <div className="mt-10 rounded-3xl border border-border bg-card/60 p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">One gentle question</p>
            <p className="mt-3 font-serif text-lg leading-relaxed text-foreground/90">“{currentQuestion}”</p>
          </div>

          <Textarea
            value={followupText}
            onChange={(e) => setFollowupText(e.target.value.slice(0, FOLLOWUP_MAX))}
            placeholder="Write what comes up. A few honest words are enough."
            disabled={loading}
            className="mt-4 min-h-[200px] resize-none rounded-[1.75rem] border-border bg-card/40 p-6 text-base leading-relaxed shadow-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary/20"
          />
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground/70">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3 w-3" /> {savedPrivately ? "Saved privately." : "Kept only for this moment."}
            </span>
            <span>
              {followupText.length}/{FOLLOWUP_MAX}
            </span>
          </div>

          {loading && (
            <p className="mt-6 text-center text-sm text-muted-foreground">Taking a quiet moment to reflect...</p>
          )}
          {error && !loading && (
            <p className="mt-6 text-center text-sm text-destructive">
              Something interrupted the reflection. Your writing has not been saved unless you chose Save privately. Please try again.
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <Button onClick={onSubmit} disabled={loading} className="h-12 rounded-full">
              Reflect on This
            </Button>
            <Button onClick={onPause} variant="ghost" disabled={loading} className="h-12 rounded-full">
              Pause Here
            </Button>
          </div>
        </>
      )}
    </div>
  );
}