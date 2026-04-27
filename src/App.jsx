const { useEffect, useMemo, useState } = React;

const API_ENDPOINTS = {
  geeta: "https://vedicscriptures.github.io",
  poets: "https://poetrydb.org",
  philosophers: "https://philosophersapi.com/api"
};

const WISDOM_TABS = [
  { id: "geeta", label: "Geeta" },
  { id: "philosophers", label: "Philosophers" },
  { id: "poets", label: "Poets" }
];

const STRESS_THEMES = [
  { id: "overthinking", label: "Overthinking", prayer: "Krishna, help me return from fear to the duty of this moment." },
  { id: "study", label: "Study pressure", prayer: "Krishna, let my effort become worship, not panic." },
  { id: "loneliness", label: "Loneliness", prayer: "Krishna, remind me I am guided even when I feel alone." },
  { id: "family", label: "Family pressure", prayer: "Krishna, give me patience, respect, and a steady voice." },
  { id: "purpose", label: "Purpose", prayer: "Krishna, show me the next honest action, not the whole mountain." },
  { id: "rejection", label: "Rejection", prayer: "Krishna, protect my dignity and teach my heart detachment." }
];

const GEETA_REFERENCES = [
  { chapter: 2, verse: 47 },
  { chapter: 2, verse: 48 },
  { chapter: 6, verse: 5 },
  { chapter: 6, verse: 6 },
  { chapter: 12, verse: 13 },
  { chapter: 18, verse: 66 }
];

const POET_REQUESTS = [
  { author: "Emily Dickinson", title: "Hope is the thing with feathers" },
  { author: "Emily Dickinson", title: "We grow accustomed to the Dark" },
  { author: "William Wordsworth", title: "I Wandered Lonely as a Cloud" },
  { author: "Rudyard Kipling", title: "If" }
];

const FALLBACK_WISDOM = {
  geeta: [
    {
      sourceType: "geeta",
      title: "Duty without panic",
      author: "Bhagavad Gita",
      reference: "2.47",
      text: "You have a right to action, not to control every result.",
      reflection: "For stressed youth, this means: give your best effort today and release the obsession with outcomes.",
      action: "Do one focused task for 25 minutes and offer the effort to Krishna."
    },
    {
      sourceType: "geeta",
      title: "Lift yourself",
      author: "Bhagavad Gita",
      reference: "6.5",
      text: "The mind can become a friend when it is trained with patience.",
      reflection: "Your thoughts are loud, but they are not your master.",
      action: "Write the one thought hurting you, then write one truthful answer to it."
    }
  ],
  philosophers: [
    {
      sourceType: "philosophers",
      title: "Courage with reason",
      author: "Immanuel Kant",
      reference: "What is Enlightenment?",
      text: "Have courage to use your own reason.",
      reflection: "Stress becomes smaller when you stop borrowing fear from everyone around you.",
      action: "Choose one decision today from values, not pressure."
    },
    {
      sourceType: "philosophers",
      title: "Inner adjustment",
      author: "David Hume",
      reference: "An Enquiry Concerning the Principles of Morals",
      text: "Strength grows when the heart learns to meet circumstances with balance.",
      reflection: "You may not control the situation, but you can train your response.",
      action: "Name what is outside your control and what is still yours to do."
    }
  ],
  poets: [
    {
      sourceType: "poets",
      title: "Hope",
      author: "Emily Dickinson",
      reference: "Hope is the thing with feathers",
      text: "Hope can stay alive quietly inside the soul.",
      reflection: "A bad day is not the end of your story.",
      action: "Do one small act that proves hope is still moving."
    },
    {
      sourceType: "poets",
      title: "Darkness becomes familiar",
      author: "Emily Dickinson",
      reference: "We grow accustomed to the Dark",
      text: "The eyes adjust slowly when the path is dark.",
      reflection: "Confusion does not mean you are lost forever.",
      action: "Take the next visible step, not the perfect step."
    }
  ]
};

const PROMPTS = [
  "What stress am I carrying today, and what is it asking me to learn?",
  "Which part is in my control, and which part must I offer to Krishna?",
  "What would self-respect and faith ask me to do today?",
  "What can I build instead of overthinking?",
  "Where do I need discipline, patience, or surrender?",
  "What kind of person do I want this pressure to shape me into?",
  "What is one action today that makes my future self proud?"
];

const MOODS = [
  { label: "Heavy", symbol: "H", reply: "Do not fight the whole life at once. Sit, breathe, and take the next dharmic step." },
  { label: "Confused", symbol: "?", reply: "Confusion is not failure. It is the mind asking for truth, guidance, and patience." },
  { label: "Anxious", symbol: "~", reply: "Pause before reacting. A calm response protects your dignity and your future." },
  { label: "Motivated", symbol: "^", reply: "Use this fire with discipline. Let effort become worship." },
  { label: "Peaceful", symbol: "O", reply: "Peace is progress. Stay humble, grateful, and steady." },
  { label: "Lonely", symbol: "L", reply: "Loneliness is a room, not a life sentence. Fill it with prayer, friendship, and creation." }
];

const GROWTH_PATH = [
  { step: "01", title: "Pause", text: "Calm the body before guiding the mind. No life decision needs emotional fire." },
  { step: "02", title: "Pray", text: "Offer the pressure to Krishna. Ask for courage, clarity, and right action." },
  { step: "03", title: "Choose", text: "Pick the action that protects your future, dignity, health, and character." },
  { step: "04", title: "Build", text: "Turn stress into body, study, skill, service, money, art, and discipline." }
];

const MISSIONS = [
  "Do one hard thing before opening social media.",
  "Write one honest page, then take one real-world action.",
  "Move your body for 20 minutes. Let the mind follow the body.",
  "Send no impulsive message today. Let dignity breathe.",
  "Study or practice one skill for 30 minutes. Stress becomes strength through action.",
  "Call a friend, mentor, sibling, teacher, or someone safe. Pressure should not isolate you."
];

const EXERCISES = [
  {
    icon: "B",
    title: "Breath Prayer",
    text: "Inhale: I am guided. Exhale: I release the result."
  },
  {
    icon: "D",
    title: "Duty Check",
    text: "Ask: what is my dharma in this moment, even if the result is uncertain?"
  },
  {
    icon: "A",
    title: "Greatness Action",
    text: "After every emotional entry, choose one action: workout, study, create, apply, save, or serve."
  }
];

function countWords(value) {
  if (typeof value !== "string") return 0;
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function getNextIndex(currentIndex, totalItems) {
  if (!Number.isInteger(currentIndex) || !Number.isInteger(totalItems) || totalItems <= 0) return 0;
  return (currentIndex + 1) % totalItems;
}

function getInsightType(text) {
  const value = typeof text === "string" ? text.toLowerCase() : "";
  if (!value.trim()) return "empty";
  if (value.includes("miss") || value.includes("alone") || value.includes("lonely")) return "loneliness";
  if (value.includes("exam") || value.includes("study") || value.includes("career")) return "study";
  if (value.includes("angry") || value.includes("hurt") || value.includes("wrong")) return "hurt";
  if (value.includes("build") || value.includes("gym") || value.includes("skill")) return "growth";
  return "reflection";
}

function createNote({ mood, text, prompt, theme, now = new Date() }) {
  const cleanText = typeof text === "string" ? text.trim() : "";
  if (!cleanText) return null;

  return {
    id: now.getTime(),
    mood: mood || "Confused",
    theme: theme || "overthinking",
    prompt: prompt || "Free writing",
    insightType: getInsightType(cleanText),
    text: cleanText,
    date: now.toLocaleString()
  };
}

function firstEnglishTranslation(slok) {
  const keys = ["prabhu", "siva", "purohit", "san", "adi", "gambir"];
  for (const key of keys) {
    if (slok && slok[key] && slok[key].et) return slok[key].et.replace(/^\d+\.\d+\s*/, "").trim();
  }
  return "A sacred reminder from the Gita to act with steadiness, surrender, and faith.";
}

function trimText(value, maxLength = 260) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function getStressReflection(entry, themeId) {
  const theme = STRESS_THEMES.find((item) => item.id === themeId) || STRESS_THEMES[0];
  if (entry.sourceType === "geeta") {
    return `For ${theme.label.toLowerCase()}, Krishna's teaching points you back to steady action, surrender, and trust.`;
  }
  if (entry.sourceType === "poets") {
    return `This poem gives language to stress so the heart can soften and continue.`;
  }
  return `This thought trains the mind to respond with courage instead of panic.`;
}

function getStressAction(entry, themeId) {
  const actions = {
    overthinking: "Write the worry, circle the next controllable action, and do it for 10 minutes.",
    study: "Study one small topic with full attention, then rest your eyes for two minutes.",
    loneliness: "Pray for steadiness, then message one safe person honestly.",
    family: "Speak one sentence calmly, without insult or self-abandonment.",
    purpose: "Choose one skill-building action and complete the smallest version today.",
    rejection: "Do not chase. Protect dignity and pour the energy into self-growth."
  };
  return actions[themeId] || actions.overthinking;
}

function normalizeWisdomEntry(raw, sourceType, themeId, philosopherMap = {}) {
  if (sourceType === "geeta") {
    const reference = `${raw.chapter}.${raw.verse}`;
    const text = firstEnglishTranslation(raw);
    return {
      sourceType,
      title: `Bhagavad Gita ${reference}`,
      author: "Sri Krishna",
      reference,
      text: trimText(text, 280),
      reflection: getStressReflection({ sourceType }, themeId),
      action: getStressAction({ sourceType }, themeId)
    };
  }

  if (sourceType === "poets") {
    const lines = Array.isArray(raw.lines) ? raw.lines.filter(Boolean).slice(0, 5).join(" / ") : raw.text || "";
    return {
      sourceType,
      title: raw.title || "Poetic courage",
      author: raw.author || "PoetryDB",
      reference: raw.title || "Poem excerpt",
      text: trimText(lines, 260),
      reflection: getStressReflection({ sourceType }, themeId),
      action: getStressAction({ sourceType }, themeId)
    };
  }

  const philosopher = philosopherMap[raw.philosopher?.id] || raw.author || "Philosopher";
  return {
    sourceType,
    title: raw.work || "Philosophical clarity",
    author: philosopher,
    reference: raw.year || raw.work || "Philosophers API",
    text: trimText(raw.quote, 280),
    reflection: getStressReflection({ sourceType }, themeId),
    action: getStressAction({ sourceType }, themeId)
  };
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

async function fetchGeetaWisdom(themeId) {
  const sloks = await Promise.all(
    GEETA_REFERENCES.map((item) => fetchJson(`${API_ENDPOINTS.geeta}/slok/${item.chapter}/${item.verse}`))
  );
  return sloks.map((slok) => normalizeWisdomEntry(slok, "geeta", themeId));
}

async function fetchPoetryWisdom(themeId) {
  const poems = await Promise.all(
    POET_REQUESTS.map((item) =>
      fetchJson(`${API_ENDPOINTS.poets}/author,title/${encodeURIComponent(item.author)};${encodeURIComponent(item.title)}`)
    )
  );
  return poems
    .flat()
    .filter((poem) => poem && !poem.status)
    .slice(0, 6)
    .map((poem) => normalizeWisdomEntry(poem, "poets", themeId));
}

async function fetchPhilosopherWisdom(themeId) {
  const [quotes, philosophers] = await Promise.all([
    fetchJson(`${API_ENDPOINTS.philosophers}/quotes`),
    fetchJson(`${API_ENDPOINTS.philosophers}/philosophers`)
  ]);
  const philosopherMap = Object.fromEntries((philosophers || []).map((item) => [item.id, item.name]));
  const terms = ["happy", "courage", "peace", "temper", "reason", "hope", "strong", "freedom", "self", "good"];
  return (quotes || [])
    .filter((quote) => {
      const text = `${quote.quote || ""} ${quote.work || ""}`.toLowerCase();
      return quote.quote && quote.quote.length < 260 && terms.some((term) => text.includes(term));
    })
    .slice(0, 6)
    .map((quote) => normalizeWisdomEntry(quote, "philosophers", themeId, philosopherMap));
}

function runTinyTests() {
  console.assert(countWords("") === 0, "Empty text should have 0 words");
  console.assert(countWords("  I feel calmer now  ") === 4, "Word counter should trim extra spaces");
  console.assert(countWords(null) === 0, "Non-string input should have 0 words");
  console.assert(getNextIndex(2, 3) === 0, "Next index should loop");
  console.assert(getInsightType("I feel alone") === "loneliness", "Loneliness should be detected");
  console.assert(getInsightType("I will study now") === "study", "Study pressure should be detected");
  console.assert(createNote({ mood: "Peaceful", text: "   " }) === null, "Blank notes should not be saved");
  console.assert(createNote({ mood: "", text: "I am here", now: new Date(0) })?.mood === "Confused", "Missing mood should fall back");
}

if (typeof window !== "undefined") runTinyTests();

function Card({ children, className = "" }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/10 shadow-2xl backdrop-blur-xl ${className}`}>{children}</div>;
}

function Button({ children, onClick, variant = "solid", className = "", type = "button", disabled = false }) {
  const base = "inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-slate-950 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
  const style = variant === "outline" ? "border border-white/20 bg-white/5 text-white hover:bg-white/10" : "bg-cyan-300 text-slate-950 hover:bg-cyan-200";
  return <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${style} ${className}`}>{children}</button>;
}

function SourceBadge({ sourceType }) {
  const labels = { geeta: "Geeta", philosophers: "Philosophy", poets: "Poetry" };
  return <span className="rounded-full bg-cyan-300/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-100">{labels[sourceType] || sourceType}</span>;
}

function WisdomCard({ entry }) {
  return (
    <Card className="h-full">
      <div className="flex h-full flex-col p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SourceBadge sourceType={entry.sourceType} />
          <span className="text-xs text-slate-400">{entry.reference}</span>
        </div>
        <h4 className="mt-4 text-xl font-semibold text-white">{entry.title}</h4>
        <p className="mt-1 text-sm text-cyan-100">{entry.author}</p>
        <p className="mt-4 leading-7 text-slate-100">"{entry.text}"</p>
        <div className="mt-5 rounded-xl bg-slate-950/40 p-4">
          <p className="text-sm font-semibold text-cyan-100">Reflection</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{entry.reflection}</p>
        </div>
        <div className="mt-3 rounded-xl bg-white/5 p-4">
          <p className="text-sm font-semibold text-cyan-100">One action</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{entry.action}</p>
        </div>
      </div>
    </Card>
  );
}

function SafetyPanel() {
  return (
    <section className="mt-8 rounded-2xl border border-amber-200/20 bg-amber-200/10 p-6">
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-amber-100">When stress feels dangerous</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Do not carry the storm alone.</h3>
        </div>
        <p className="leading-7 text-amber-50/90">
          This space can support reflection, but it is not medical care or emergency help. If you might hurt yourself or someone else, pause now, move near another person, contact a trusted adult or friend, and use local emergency services immediately.
        </p>
      </div>
    </section>
  );
}

function LoveGrowthSpace() {
  const [mood, setMood] = useState("Heavy");
  const [text, setText] = useState("");
  const [promptIndex, setPromptIndex] = useState(0);
  const [missionIndex, setMissionIndex] = useState(0);
  const [savedNotes, setSavedNotes] = useState([]);
  const [breathing, setBreathing] = useState(false);
  const [activeWisdomTab, setActiveWisdomTab] = useState("geeta");
  const [selectedTheme, setSelectedTheme] = useState("overthinking");
  const [wisdomData, setWisdomData] = useState({
    geeta: FALLBACK_WISDOM.geeta,
    philosophers: FALLBACK_WISDOM.philosophers,
    poets: FALLBACK_WISDOM.poets
  });
  const [wisdomStatus, setWisdomStatus] = useState({
    geeta: { loading: true, error: "" },
    philosophers: { loading: true, error: "" },
    poets: { loading: true, error: "" }
  });

  const currentPrompt = PROMPTS[promptIndex];
  const selectedMood = MOODS.find((item) => item.label === mood) || MOODS[0];
  const selectedThemeDetails = STRESS_THEMES.find((item) => item.id === selectedTheme) || STRESS_THEMES[0];
  const wordCount = useMemo(() => countWords(text), [text]);
  const insightType = useMemo(() => getInsightType(text), [text]);
  const activeEntries = wisdomData[activeWisdomTab] || FALLBACK_WISDOM[activeWisdomTab] || [];
  const activeStatus = wisdomStatus[activeWisdomTab] || { loading: false, error: "" };

  useEffect(() => {
    let isMounted = true;

    async function loadWisdom() {
      const loaders = {
        geeta: fetchGeetaWisdom,
        philosophers: fetchPhilosopherWisdom,
        poets: fetchPoetryWisdom
      };

      await Promise.all(
        Object.entries(loaders).map(async ([source, loader]) => {
          if (!isMounted) return;
          setWisdomStatus((previous) => ({ ...previous, [source]: { loading: true, error: "" } }));
          try {
            const entries = await loader(selectedTheme);
            if (!isMounted) return;
            setWisdomData((previous) => ({
              ...previous,
              [source]: entries.length ? entries : FALLBACK_WISDOM[source]
            }));
            setWisdomStatus((previous) => ({ ...previous, [source]: { loading: false, error: "" } }));
          } catch (error) {
            if (!isMounted) return;
            setWisdomData((previous) => ({ ...previous, [source]: FALLBACK_WISDOM[source] }));
            setWisdomStatus((previous) => ({
              ...previous,
              [source]: { loading: false, error: "Live source is unavailable. Showing steady fallback wisdom." }
            }));
          }
        })
      );
    }

    loadWisdom();
    return () => {
      isMounted = false;
    };
  }, [selectedTheme]);

  const saveNote = () => {
    const note = createNote({ mood, text, prompt: currentPrompt, theme: selectedTheme });
    if (!note) return;
    setSavedNotes((previousNotes) => [note, ...previousNotes]);
    setText("");
  };

  const scrollToJournal = () => {
    const section = document.getElementById("journal");
    if (section) section.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white">
      <div className="pointer-events-none absolute inset-0 opacity-25">
        <div className="absolute left-10 top-16 h-64 w-64 rounded-full bg-violet-500 blur-3xl md:left-20" />
        <div className="absolute bottom-16 right-8 h-72 w-72 rounded-full bg-cyan-400 blur-3xl md:right-20" />
      </div>

      <main className="relative z-10 mx-auto max-w-7xl px-5 py-8 md:px-8">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 shadow-lg backdrop-blur">
              <span className="font-serif text-2xl text-cyan-100">Om</span>
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Youth Stress Wisdom</h1>
              <p className="text-sm text-slate-300">Geeta guidance, philosophy, poetry, and disciplined action.</p>
            </div>
          </div>
          <div className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950">Spiritual support space</div>
        </nav>

        <section className="grid gap-8 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="animate-[fadeUp_0.7s_ease-out]">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-cyan-100 backdrop-blur">
              For young hearts under pressure
            </div>
            <h2 className="max-w-4xl text-5xl font-semibold leading-tight tracking-tight md:text-7xl">
              Let stress become prayer, clarity, and strength.
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              A devotional reflection space for youth to calm the mind, learn from the Bhagavad Gita and timeless thinkers, write honestly, and turn pressure into disciplined growth.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button onClick={scrollToJournal} className="px-6 py-4">Start reflection</Button>
              <Button variant="outline" onClick={() => setBreathing((value) => !value)} className="px-6 py-4">Calm my mind</Button>
            </div>
          </div>

          <Card className="animate-[softScale_0.8s_ease-out]">
            <div className="p-7">
              <p className="text-sm uppercase tracking-[0.25em] text-cyan-100">Today's prayer</p>
              <p className="mt-6 text-3xl font-semibold leading-snug text-white">{selectedThemeDetails.prayer}</p>
              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                {["Pause", "Offer", "Act"].map((step, index) => (
                  <div key={step} className="rounded-xl bg-slate-950/40 p-4">
                    <p className="text-2xl font-bold text-cyan-200">0{index + 1}</p>
                    <p className="mt-2 text-sm text-slate-200">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-4">
          {GROWTH_PATH.map((item) => (
            <Card key={item.step}>
              <div className="p-6">
                <p className="text-3xl font-bold text-cyan-200">{item.step}</p>
                <h3 className="mt-3 text-xl font-semibold">{item.title}</h3>
                <p className="mt-3 leading-7 text-slate-300">{item.text}</p>
              </div>
            </Card>
          ))}
        </section>

        <SafetyPanel />

        <section className="mt-8">
          <Card>
            <div className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-cyan-100">Wisdom for stress</p>
                  <h3 className="mt-2 text-3xl font-semibold">Live guidance from sacred and classic sources</h3>
                  <p className="mt-3 max-w-3xl leading-7 text-slate-300">
                    Choose the pressure you are carrying. The app fetches wisdom online and keeps fallback guidance ready if a source is unavailable.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {WISDOM_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveWisdomTab(tab.id)}
                      className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${activeWisdomTab === tab.id ? "bg-cyan-300 text-slate-950" : "border border-white/15 bg-white/5 text-white hover:bg-white/10"}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {STRESS_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setSelectedTheme(theme.id)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${selectedTheme === theme.id ? "bg-white text-slate-950" : "border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"}`}
                  >
                    {theme.label}
                  </button>
                ))}
              </div>

              <div className="mt-5 min-h-8">
                {activeStatus.loading && <p className="text-sm text-cyan-100">Loading live {activeWisdomTab} wisdom...</p>}
                {activeStatus.error && <p className="text-sm text-amber-100">{activeStatus.error}</p>}
              </div>

              <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {activeEntries.map((entry, index) => (
                  <WisdomCard key={`${entry.sourceType}-${entry.reference}-${index}`} entry={entry} />
                ))}
              </div>
            </div>
          </Card>
        </section>

        {breathing && (
          <section className="mt-8 animate-[fadeUp_0.4s_ease-out] rounded-2xl border border-white/10 bg-white/10 p-6 text-center backdrop-blur">
            <div className="mx-auto grid h-36 w-36 animate-[breathe_6s_ease-in-out_infinite] place-items-center rounded-full bg-cyan-300/20 shadow-[0_0_80px_rgba(103,232,249,0.35)]">
              <span className="text-5xl text-cyan-100">Om</span>
            </div>
            <h3 className="mt-5 text-2xl font-semibold">First calm the body. Then guide the heart.</h3>
            <p className="mt-2 text-slate-300">Inhale for 3. Hold for 2. Exhale for 5. Offer the result, return to action.</p>
          </section>
        )}

        <section id="journal" className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <Card>
            <div className="p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300/15 font-semibold text-cyan-100">{selectedMood.symbol}</span>
                <h3 className="text-2xl font-semibold text-white">What is your state today?</h3>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {MOODS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setMood(item.label)}
                    aria-pressed={mood === item.label}
                    className={`rounded-xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-cyan-200 ${mood === item.label ? "border-cyan-200 bg-cyan-200/20" : "border-white/10 bg-slate-950/30 hover:bg-white/10"}`}
                  >
                    <span className="text-lg font-semibold" aria-hidden="true">{item.symbol}</span>
                    <p className="mt-2 text-sm font-medium text-white">{item.label}</p>
                  </button>
                ))}
              </div>
              <div className="mt-6 rounded-xl bg-slate-950/40 p-5">
                <p className="text-sm text-slate-400">A steadier way to see it</p>
                <p className="mt-2 text-lg leading-7 text-slate-100">{selectedMood.reply}</p>
              </div>
              <div className="mt-5 rounded-xl bg-cyan-300/10 p-5">
                <p className="text-sm text-cyan-100">Today's mission</p>
                <p className="mt-2 leading-7 text-slate-100">{MISSIONS[missionIndex]}</p>
                <Button variant="outline" onClick={() => setMissionIndex((index) => getNextIndex(index, MISSIONS.length))} className="mt-4">New mission</Button>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-cyan-100">Reflection prompt</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">{currentPrompt}</h3>
                </div>
                <Button onClick={() => setPromptIndex((index) => getNextIndex(index, PROMPTS.length))} variant="outline">New prompt</Button>
              </div>

              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Write what you feel. Then ask: what is in my control, what can I offer, and what action protects my future?"
                className="mt-6 min-h-[300px] w-full resize-none rounded-2xl border border-white/10 bg-slate-950/50 p-5 text-lg leading-8 text-white outline-none placeholder:text-slate-500 focus:border-cyan-200"
              />

              <div className="mt-5 grid gap-4 rounded-xl bg-slate-950/40 p-5 md:grid-cols-3">
                <div>
                  <p className="text-sm text-slate-400">Words</p>
                  <p className="mt-1 text-2xl font-semibold text-cyan-100">{wordCount}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Pattern</p>
                  <p className="mt-1 text-2xl font-semibold capitalize text-cyan-100">{insightType}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Theme</p>
                  <p className="mt-1 text-sm leading-6 text-slate-200">{selectedThemeDetails.label}</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-slate-400">Writing is emotional training. Prayer gives it direction.</p>
                <Button onClick={saveNote} disabled={!text.trim()}>Save reflection</Button>
              </div>
            </div>
          </Card>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          {EXERCISES.map((item) => (
            <Card key={item.title}>
              <div className="p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-300/15 text-lg font-semibold text-cyan-100">{item.icon}</span>
                <h4 className="mt-4 text-xl font-semibold text-white">{item.title}</h4>
                <p className="mt-3 leading-7 text-slate-300">{item.text}</p>
              </div>
            </Card>
          ))}
        </section>

        {savedNotes.length > 0 && (
          <section className="mt-8 rounded-2xl border border-white/10 bg-white/10 p-6 backdrop-blur-xl">
            <h3 className="text-2xl font-semibold">Your growth journal</h3>
            <div className="mt-5 grid gap-4">
              {savedNotes.map((note) => (
                <div key={note.id} className="rounded-xl bg-slate-950/40 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-400">
                    <span>{note.mood} - {note.insightType}</span>
                    <span>{note.date}</span>
                  </div>
                  <p className="mt-2 text-sm text-cyan-100">{note.prompt}</p>
                  <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-100">{note.text}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="py-10 text-center text-sm text-slate-400">
          A spiritual support space for youth to understand stress, protect dignity, and build a life with faith and discipline.
        </footer>
      </main>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes softScale {
          from { opacity: 0; transform: scale(0.94); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.25); }
        }
      `}</style>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<LoveGrowthSpace />);
