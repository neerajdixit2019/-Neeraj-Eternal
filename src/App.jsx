const { useEffect, useMemo, useState } = React;

const STORAGE_KEY = "neeraj-eternal-emotional-flow";
const PAUSE_STORAGE_KEY = "neeraj-eternal-pause-before-text";

const EMOTIONS = [
  {
    id: "miss-someone",
    label: "I miss someone",
    shortLabel: "Missing someone",
    prompt: "Write what you wish you could say, without sending it.",
    reflection: "You are holding onto something that mattered deeply.",
    tone: "from-rose-100 to-violet-100"
  },
  {
    id: "overthinking",
    label: "I am overthinking",
    shortLabel: "Overthinking",
    prompt: "Write the thought that keeps repeating in your mind.",
    reflection: "Your mind is trying to find certainty where there may be none.",
    tone: "from-blue-100 to-indigo-100"
  },
  {
    id: "rejected",
    label: "I feel rejected",
    shortLabel: "Rejected",
    prompt: "What hurt you the most about what happened?",
    reflection: "That kind of hurt can shake how you see yourself.",
    tone: "from-amber-100 to-rose-100"
  },
  {
    id: "anxious",
    label: "I feel anxious",
    shortLabel: "Anxious",
    prompt: "What are you afraid might happen?",
    reflection: "You are trying to prepare for something that hasn't happened yet.",
    tone: "from-cyan-100 to-blue-100"
  },
  {
    id: "numb",
    label: "I feel numb",
    shortLabel: "Numb",
    prompt: "Even if it feels empty, write anything that comes.",
    reflection: "Sometimes feeling nothing is the mind's way of protecting itself.",
    tone: "from-slate-100 to-blue-100"
  },
  {
    id: "heavy",
    label: "I just feel heavy",
    shortLabel: "Heavy",
    prompt: "What is weighing on you right now?",
    reflection: "You have been carrying more than you should alone.",
    tone: "from-violet-100 to-stone-100"
  }
];

function getEmotion(id) {
  return EMOTIONS.find((emotion) => emotion.id === id) || null;
}

function readStoredFlow() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredFlow(nextValue) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextValue));
}

function getRoute() {
  const path = window.location.pathname;
  if (path === "/journal" || path === "/reflect" || path === "/check-in" || path === "/pause") return path;
  return "/check-in";
}

function navigate(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function SoftShell({ children }) {
  return (
    <div className="min-h-screen bg-[linear-gradient(145deg,#f8efe8_0%,#ece8ff_45%,#e5f5ff_100%)] px-4 py-5 text-slate-800 sm:px-6">
      <main className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-md flex-col">
        {children}
      </main>
    </div>
  );
}

function PageHeader({ eyebrow, title, children }) {
  return (
    <header className="pb-6 pt-4">
      {eyebrow && <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>}
      <h1 className="text-4xl font-semibold leading-tight tracking-normal text-slate-900">{title}</h1>
      {children && <p className="mt-4 text-base leading-7 text-slate-600">{children}</p>}
    </header>
  );
}

function Card({ children, className = "" }) {
  return <div className={`rounded-3xl bg-white/75 shadow-[0_18px_50px_rgba(88,82,120,0.14)] ring-1 ring-white/70 backdrop-blur ${className}`}>{children}</div>;
}

function Button({ children, variant = "primary", className = "", ...props }) {
  const variants = {
    primary: "bg-slate-900 text-white shadow-lg shadow-slate-400/25 hover:bg-slate-800",
    secondary: "bg-white/75 text-slate-800 ring-1 ring-slate-200 hover:bg-white",
    quiet: "bg-transparent text-slate-600 hover:bg-white/50"
  };
  return (
    <button
      className={`min-h-12 rounded-2xl px-5 py-3 text-sm font-semibold transition duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

function readStoredPause() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PAUSE_STORAGE_KEY));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredPause(nextValue) {
  localStorage.setItem(PAUSE_STORAGE_KEY, JSON.stringify(nextValue));
}

function EmotionCard({ emotion, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(emotion)}
      className={`group min-h-28 rounded-3xl bg-gradient-to-br ${emotion.tone} p-5 text-left shadow-[0_14px_35px_rgba(88,82,120,0.12)] ring-1 ring-white/80 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(88,82,120,0.18)] focus:outline-none focus:ring-2 focus:ring-slate-400`}
    >
      <span className="block text-lg font-semibold leading-snug text-slate-900">{emotion.label}</span>
      <span className="mt-3 block text-sm leading-6 text-slate-600">Tap when this feels closest.</span>
    </button>
  );
}

function CheckInScreen({ onSelect }) {
  return (
    <SoftShell>
      <PageHeader eyebrow="A gentle check-in" title="What are you carrying right now?">
        Choose the feeling that is closest. It does not need to be perfect.
      </PageHeader>
      <section className="grid flex-1 grid-cols-1 gap-4 pb-6 sm:grid-cols-2">
        {EMOTIONS.map((emotion) => (
          <EmotionCard key={emotion.id} emotion={emotion} onSelect={onSelect} />
        ))}
      </section>
    </SoftShell>
  );
}

function CalmingCard({ onClose }) {
  return (
    <Card className="mt-4 p-5">
      <p className="text-sm font-semibold text-slate-500">Calm for one minute</p>
      <h2 className="mt-2 text-xl font-semibold text-slate-900">Breathe before you continue.</h2>
      <div className="mx-auto my-6 grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br from-blue-100 to-violet-100 shadow-inner">
        <span className="text-sm font-semibold text-slate-600">inhale</span>
      </div>
      <p className="leading-7 text-slate-600">Inhale slowly. Hold for a moment. Exhale like you are putting something heavy down.</p>
      <Button variant="secondary" className="mt-5 w-full" onClick={onClose}>I'm a little calmer</Button>
    </Card>
  );
}

function JournalScreen({ emotion, draftText, onTextChange, onSave }) {
  const [showCalm, setShowCalm] = useState(false);
  const title = emotion ? `${emotion.shortLabel}, softly.` : "Let's write softly.";
  const prompt = emotion?.prompt || "Write what is present right now.";

  return (
    <SoftShell>
      <PageHeader eyebrow="Let it out" title={title}>
        {prompt}
      </PageHeader>
      <Card className="p-4">
        <textarea
          value={draftText}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder="Start with one honest sentence..."
          className="min-h-[290px] w-full resize-none rounded-2xl bg-white/65 p-4 text-base leading-8 text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-200"
        />
        <div className="mt-3 flex items-center justify-between px-1 text-sm text-slate-500">
          <span>{draftText.length} characters</span>
          <span>No one else sees this.</span>
        </div>
      </Card>

      {showCalm && <CalmingCard onClose={() => setShowCalm(false)} />}

      <div className="mt-auto grid gap-3 py-6">
        <Button onClick={onSave} disabled={!draftText.trim()}>Save & Continue</Button>
        <Button variant="secondary" onClick={() => setShowCalm(true)}>I need help calming down</Button>
        <Button variant="quiet" onClick={() => navigate("/check-in")}>Choose a different feeling</Button>
      </div>
    </SoftShell>
  );
}

function ReflectionMessage({ emotion }) {
  return (
    <Card className="p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">A reflection</p>
      <div className="mt-4 space-y-4 text-lg leading-8 text-slate-700">
        <p>It sounds like {emotion?.reflection || "something inside you needs gentleness"}.</p>
        <p>You don't need to solve everything right now.</p>
        <p>For this moment, just stay with yourself.</p>
      </div>
    </Card>
  );
}

function WrittenTextCard({ text }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-slate-500">What you wrote</p>
      <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-slate-700">{text || "Nothing written yet."}</p>
    </Card>
  );
}

function ReflectionScreen({ emotion, journalText, onWriteMore, onSaveAgain }) {
  const [saved, setSaved] = useState(false);
  const [calming, setCalming] = useState(false);

  const saveReflection = () => {
    onSaveAgain();
    setSaved(true);
  };

  return (
    <SoftShell>
      <PageHeader eyebrow="You made it here" title="Stay with yourself for a moment.">
        {emotion ? `Selected feeling: ${emotion.label}` : "Your feeling is still welcome here."}
      </PageHeader>

      <div className="grid gap-4">
        <WrittenTextCard text={journalText} />
        <ReflectionMessage emotion={emotion} />
        {calming && <CalmingCard onClose={() => setCalming(false)} />}
      </div>

      {saved && (
        <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm">
          Saved. Let this be enough for now.
        </div>
      )}

      <div className="mt-auto grid gap-3 py-6">
        <Button onClick={onWriteMore}>Write more</Button>
        <Button variant="secondary" onClick={() => setCalming(true)}>Start calming exercise</Button>
        <Button variant="secondary" onClick={() => navigate("/pause")}>I feel like texting them</Button>
        <Button variant="quiet" onClick={saveReflection}>Save this</Button>
      </div>
    </SoftShell>
  );
}

function PauseShell({ children }) {
  return (
    <div className="min-h-screen bg-[linear-gradient(145deg,#e9e4ef_0%,#f5efe7_52%,#ddebf4_100%)] px-4 py-6 text-slate-800">
      <main className="mx-auto flex min-h-[calc(100vh-48px)] w-full max-w-md flex-col justify-center">
        <div className="w-full">{children}</div>
      </main>
    </div>
  );
}

function PauseQuestions({ answers, onChange, onContinue }) {
  const questions = [
    ["hope", "What are you hoping will happen if you send it?"],
    ["response", "What might you feel if they don't respond the way you expect?"],
    ["peace", "What would protect your peace right now?"]
  ];

  return (
    <PauseShell>
      <PageHeader eyebrow="Pause Before You Text" title="Before you send that message...">
        Let's slow this moment down.
      </PageHeader>
      <div className="grid gap-4">
        {questions.map(([key, question]) => (
          <Card key={key} className="p-4">
            <label className="block text-sm font-semibold leading-6 text-slate-600" htmlFor={`pause-${key}`}>
              {question}
            </label>
            <textarea
              id={`pause-${key}`}
              value={answers[key] || ""}
              onChange={(event) => onChange(key, event.target.value)}
              className="mt-3 min-h-28 w-full resize-none rounded-2xl bg-white/65 p-4 text-base leading-7 text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-violet-200"
              placeholder="Write gently. No need to make it perfect."
            />
          </Card>
        ))}
      </div>
      <Button className="mt-6 w-full" onClick={onContinue}>Continue</Button>
    </PauseShell>
  );
}

function getPauseDynamicLine(answers) {
  const text = Object.values(answers).join(" ").toLowerCase();
  if (text.includes("reply") || text.includes("come back") || text.includes("miss")) {
    return "You are hoping for connection, but your peace should not depend on their response.";
  }
  if (text.includes("closure")) {
    return "Closure is not always given. Sometimes it is something you create.";
  }
  if (text.includes("hurt")) {
    return "Acting from hurt often creates more hurt.";
  }
  return "A pause can help you hear what your heart is asking for beneath the urge.";
}

function PauseReflection({ answers, onContinue }) {
  const labels = {
    hope: "What you hope will happen",
    response: "If they don't respond as expected",
    peace: "What protects your peace"
  };

  return (
    <PauseShell>
      <PageHeader eyebrow="Mirror" title="Read this back slowly.">
        You are allowed to want connection. You are also allowed to protect your peace.
      </PageHeader>
      <div className="grid gap-4">
        {Object.entries(labels).map(([key, label]) => (
          <Card key={key} className="p-5">
            <p className="text-sm font-semibold text-slate-500">{label}</p>
            <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700">{answers[key] || "No answer written yet."}</p>
          </Card>
        ))}
        <Card className="p-6">
          <p className="text-lg leading-8 text-slate-700">
            You are not wrong for wanting to reach out.
            <br />
            But not every feeling needs immediate action.
          </p>
          <p className="mt-5 rounded-2xl bg-white/60 p-4 leading-7 text-slate-700">{getPauseDynamicLine(answers)}</p>
        </Card>
      </div>
      <Button className="mt-6 w-full" onClick={onContinue}>Continue</Button>
    </PauseShell>
  );
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function PauseTimer({ secondsLeft, canContinue, onWait, onBack }) {
  return (
    <PauseShell>
      <div className="text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Delay</p>
        <h1 className="text-4xl font-semibold leading-tight text-slate-900">Give yourself 10 minutes.</h1>
        <div className="mx-auto my-10 grid h-44 w-44 animate-[pausePulse_4s_ease-in-out_infinite] place-items-center rounded-full bg-white/60 shadow-[0_18px_60px_rgba(88,82,120,0.18)] ring-1 ring-white/80">
          <span className="text-5xl font-semibold tabular-nums text-slate-800">{formatTime(secondsLeft)}</span>
        </div>
        <p className="mx-auto max-w-xs text-lg leading-8 text-slate-600">You don't have to decide right now.</p>
      </div>
      <div className="mt-10 grid gap-3">
        <Button onClick={onWait} disabled={!canContinue}>
          {canContinue ? "I will wait" : "Let the first 30 seconds pass"}
        </Button>
        <Button variant="secondary" onClick={onBack}>Take me back to writing</Button>
      </div>
      <style>{`
        @keyframes pausePulse {
          0%, 100% { transform: scale(0.96); opacity: 0.82; }
          50% { transform: scale(1.04); opacity: 1; }
        }
      `}</style>
    </PauseShell>
  );
}

function PauseDecision({ choice, onChoose, onBackToWriting }) {
  const messages = {
    no: "You chose yourself in a difficult moment. That matters.",
    still: "If you do, send it from clarity, not from pain.",
    better: "A little lighter is still real progress."
  };

  return (
    <PauseShell>
      <PageHeader eyebrow="Decision" title="How do you feel now?">
        Notice the difference between urgency and clarity.
      </PageHeader>
      <div className="grid gap-3">
        <Button variant={choice === "no" ? "primary" : "secondary"} onClick={() => onChoose("no")}>I don't want to send it anymore</Button>
        <Button variant={choice === "still" ? "primary" : "secondary"} onClick={() => onChoose("still")}>I still feel like sending it</Button>
        <Button variant={choice === "better" ? "primary" : "secondary"} onClick={() => onChoose("better")}>I feel a little better</Button>
      </div>
      {choice && (
        <Card className="mt-6 p-6">
          <p className="text-xl leading-8 text-slate-800">{messages[choice]}</p>
        </Card>
      )}
      <Button variant="quiet" className="mt-6 w-full" onClick={onBackToWriting}>Take me back to writing</Button>
    </PauseShell>
  );
}

function PauseFlow() {
  const [step, setStep] = useState("awareness");
  const [answers, setAnswers] = useState({ hope: "", response: "", peace: "" });
  const [secondsLeft, setSecondsLeft] = useState(600);
  const [choice, setChoice] = useState("");

  useEffect(() => {
    const stored = readStoredPause();
    setAnswers({
      hope: stored.answers?.hope || "",
      response: stored.answers?.response || "",
      peace: stored.answers?.peace || ""
    });
    setChoice(stored.choice || "");
  }, []);

  useEffect(() => {
    if (step !== "delay" || secondsLeft <= 0) return undefined;
    const id = setInterval(() => {
      setSecondsLeft((value) => Math.max(value - 1, 0));
    }, 1000);
    return () => clearInterval(id);
  }, [step, secondsLeft]);

  const updateAnswer = (key, value) => {
    const nextAnswers = { ...answers, [key]: value };
    setAnswers(nextAnswers);
    saveStoredPause({ answers: nextAnswers, choice, updatedAt: new Date().toISOString() });
  };

  const continueFromQuestions = () => {
    saveStoredPause({ answers, choice, updatedAt: new Date().toISOString() });
    setStep("mirror");
  };

  const continueToDelay = () => {
    setSecondsLeft(600);
    setStep("delay");
  };

  const chooseDecision = (nextChoice) => {
    setChoice(nextChoice);
    saveStoredPause({ answers, choice: nextChoice, updatedAt: new Date().toISOString() });
  };

  if (step === "mirror") return <PauseReflection answers={answers} onContinue={continueToDelay} />;
  if (step === "delay") {
    return (
      <PauseTimer
        secondsLeft={secondsLeft}
        canContinue={secondsLeft <= 570}
        onWait={() => setStep("decision")}
        onBack={() => navigate("/journal")}
      />
    );
  }
  if (step === "decision") {
    return <PauseDecision choice={choice} onChoose={chooseDecision} onBackToWriting={() => navigate("/journal")} />;
  }
  return <PauseQuestions answers={answers} onChange={updateAnswer} onContinue={continueFromQuestions} />;
}

function App() {
  const [route, setRoute] = useState(getRoute);
  const [selectedEmotionId, setSelectedEmotionId] = useState("");
  const [journalText, setJournalText] = useState("");

  useEffect(() => {
    const stored = readStoredFlow();
    setSelectedEmotionId(stored.emotionId || "");
    setJournalText(stored.journalText || "");
  }, []);

  useEffect(() => {
    const onPopState = () => setRoute(getRoute());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const selectedEmotion = useMemo(() => getEmotion(selectedEmotionId), [selectedEmotionId]);

  useEffect(() => {
    if ((route === "/journal" || route === "/reflect") && !selectedEmotionId) {
      navigate("/check-in");
    }
  }, [route, selectedEmotionId]);

  const selectEmotion = (emotion) => {
    const nextValue = {
      emotionId: emotion.id,
      journalText: "",
      updatedAt: new Date().toISOString()
    };
    saveStoredFlow(nextValue);
    setSelectedEmotionId(emotion.id);
    setJournalText("");
    navigate("/journal");
  };

  const saveAndReflect = () => {
    const nextValue = {
      emotionId: selectedEmotionId,
      journalText: journalText.trim(),
      updatedAt: new Date().toISOString()
    };
    saveStoredFlow(nextValue);
    setJournalText(nextValue.journalText);
    navigate("/reflect");
  };

  const saveAgain = () => {
    saveStoredFlow({
      emotionId: selectedEmotionId,
      journalText,
      updatedAt: new Date().toISOString()
    });
  };

  if (route === "/journal") {
    return (
      <JournalScreen
        emotion={selectedEmotion}
        draftText={journalText}
        onTextChange={setJournalText}
        onSave={saveAndReflect}
      />
    );
  }

  if (route === "/reflect") {
    return (
      <ReflectionScreen
        emotion={selectedEmotion}
        journalText={journalText}
        onWriteMore={() => navigate("/journal")}
        onSaveAgain={saveAgain}
      />
    );
  }

  if (route === "/pause") {
    return <PauseFlow />;
  }

  return <CheckInScreen onSelect={selectEmotion} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
