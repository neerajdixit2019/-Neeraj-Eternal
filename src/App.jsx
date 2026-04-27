const { useEffect, useMemo, useRef, useState } = React;

const STORAGE_KEY = "neeraj-eternal-emotional-flow";
const PAUSE_STORAGE_KEY = "neeraj-eternal-pause-before-text";
const JOURNEY_STORAGE_KEY = "neeraj-eternal-healing-journeys";
const MUSEUM_STORAGE_KEY = "museum_unsaid_notes";
const WISDOM_CHAT_STORAGE_KEY = "neeraj-eternal-wisdom-chat";

const MUSEUM_CATEGORIES = ["Love", "Regret", "Forgiveness", "Hope", "Self-respect", "Goodbye"];

const MUSEUM_SEED_NOTES = [
  {
    id: "seed-1",
    category: "Love",
    text: "I still miss the version of us that never happened.",
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "seed-2",
    category: "Regret",
    text: "I wanted closure, but maybe silence was the closure.",
    createdAt: "2026-01-02T00:00:00.000Z"
  },
  {
    id: "seed-3",
    category: "Hope",
    text: "I hope one day I stop checking if you remember me.",
    createdAt: "2026-01-03T00:00:00.000Z"
  },
  {
    id: "seed-4",
    category: "Love",
    text: "I loved honestly. That has to count for something.",
    createdAt: "2026-01-04T00:00:00.000Z"
  },
  {
    id: "seed-5",
    category: "Self-respect",
    text: "I am learning not to beg for softness.",
    createdAt: "2026-01-05T00:00:00.000Z"
  },
  {
    id: "seed-6",
    category: "Goodbye",
    text: "Goodbye, not because it stopped mattering, but because I started mattering too.",
    createdAt: "2026-01-06T00:00:00.000Z"
  }
];

const HEALING_JOURNEYS = [
  {
    id: "letting-go",
    title: "Letting Go",
    subtitle: "Release what you can't hold anymore",
    prompts: [
      "What I wish I had said",
      "What I cannot control",
      "What I gave honestly",
      "What hurt me the most",
      "What I forgive myself for",
      "What I release now",
      "A letter I will never send"
    ]
  },
  {
    id: "self-worth",
    title: "Self Worth",
    subtitle: "Come back to your own value",
    prompts: [
      "What I deserve in love",
      "Where I accepted less",
      "What makes me valuable",
      "My strengths I ignore",
      "How I want to be treated",
      "What I will not tolerate again",
      "A promise to myself"
    ]
  },
  {
    id: "understanding-love",
    title: "Understanding Love",
    subtitle: "Make sense of what you felt",
    prompts: [
      "What I felt was real",
      "What I imagined vs what was real",
      "Where I lost myself",
      "What I learned about love",
      "What I need in future",
      "What I misunderstood",
      "What I carry forward"
    ]
  }
];

const EMOTIONS = [
  {
    id: "miss-someone",
    label: "I miss someone",
    shortLabel: "Missing someone",
    prompt: "Write what you wish you could say, without sending it.",
    reflection: "You are holding onto something that mattered deeply.",
    tone: "from-rose-100 to-violet-100",
    wisdomTheme: "longing"
  },
  {
    id: "overthinking",
    label: "I am overthinking",
    shortLabel: "Overthinking",
    prompt: "Write the thought that keeps repeating in your mind.",
    reflection: "Your mind is trying to find certainty where there may be none.",
    tone: "from-blue-100 to-indigo-100",
    wisdomTheme: "overthinking"
  },
  {
    id: "rejected",
    label: "I feel rejected",
    shortLabel: "Rejected",
    prompt: "What hurt you the most about what happened?",
    reflection: "That kind of hurt can shake how you see yourself.",
    tone: "from-amber-100 to-rose-100",
    wisdomTheme: "rejection"
  },
  {
    id: "anxious",
    label: "I feel anxious",
    shortLabel: "Anxious",
    prompt: "What are you afraid might happen?",
    reflection: "You are trying to prepare for something that hasn't happened yet.",
    tone: "from-cyan-100 to-blue-100",
    wisdomTheme: "anxiety"
  },
  {
    id: "numb",
    label: "I feel numb",
    shortLabel: "Numb",
    prompt: "Even if it feels empty, write anything that comes.",
    reflection: "Sometimes feeling nothing is the mind's way of protecting itself.",
    tone: "from-slate-100 to-blue-100",
    wisdomTheme: "numb"
  },
  {
    id: "heavy",
    label: "I just feel heavy",
    shortLabel: "Heavy",
    prompt: "What is weighing on you right now?",
    reflection: "You have been carrying more than you should alone.",
    tone: "from-violet-100 to-stone-100",
    wisdomTheme: "heavy"
  },
  {
    id: "lost",
    label: "I feel lost",
    shortLabel: "Lost",
    prompt: "Where did you last feel certain of yourself?",
    reflection: "Feeling lost often means you have outgrown where you were. That is not failure.",
    tone: "from-teal-100 to-emerald-100",
    wisdomTheme: "lost"
  }
];

// ─── Scripture wisdom database ────────────────────────────────────────────────

const WISDOM_BY_THEME = {
  longing: {
    acknowledgment: "Longing is a form of love. It does not need to disappear for you to heal.",
    scriptures: [
      {
        quote: "The wound is the place where the light enters you.",
        source: "Rumi",
        reference: "Masnavi"
      },
      {
        quote: "Out beyond ideas of wrongdoing and rightdoing, there is a field. I'll meet you there.",
        source: "Rumi",
        reference: "Masnavi"
      },
      {
        quote: "Do not grieve. Everything you lose comes round in another form.",
        source: "Rumi",
        reference: "Masnavi"
      },
      {
        quote: "Verily, with hardship comes ease.",
        source: "Quran",
        reference: "Surah Al-Inshirah 94:5"
      },
      {
        quote: "Even after all this time, the sun never says to the earth: you owe me.",
        source: "Hafiz",
        reference: "Persian poetry"
      }
    ]
  },
  anxiety: {
    acknowledgment: "Your mind is working hard to protect you from something it cannot see yet.",
    scriptures: [
      {
        quote: "You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions. Never consider yourself the cause of the results, and never be attached to not doing your duty.",
        source: "Bhagavad Gita",
        reference: "Chapter 2, Verse 47"
      },
      {
        quote: "Do not worry about tomorrow, for tomorrow will worry about itself. Each day has enough trouble of its own.",
        source: "Bible",
        reference: "Matthew 6:34"
      },
      {
        quote: "Cast all your anxiety on him because he cares for you.",
        source: "Bible",
        reference: "1 Peter 5:7"
      },
      {
        quote: "Peace I leave with you; my peace I give to you. Do not let your hearts be troubled and do not be afraid.",
        source: "Bible",
        reference: "John 14:27"
      },
      {
        quote: "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.",
        source: "Bible",
        reference: "Philippians 4:6"
      }
    ]
  },
  rejection: {
    acknowledgment: "Not being chosen by someone does not mean you are not worth choosing.",
    scriptures: [
      {
        quote: "Your task is not to seek for love, but merely to seek and find all the barriers within yourself that you have built against it.",
        source: "Rumi",
        reference: "Masnavi"
      },
      {
        quote: "We have honored the children of Adam and carried them on land and sea.",
        source: "Quran",
        reference: "Surah Al-Isra 17:70"
      },
      {
        quote: "You yourself, as much as anybody in the entire universe, deserve your love and affection.",
        source: "Buddha",
        reference: "Dhammapada"
      },
      {
        quote: "For you created my inmost being; you knit me together in my mother's womb. I am fearfully and wonderfully made.",
        source: "Bible",
        reference: "Psalm 139:13-14"
      }
    ]
  },
  heavy: {
    acknowledgment: "You have been carrying something heavy for a long time. You do not have to carry it alone.",
    scriptures: [
      {
        quote: "Come to me, all you who are weary and burdened, and I will give you rest.",
        source: "Bible",
        reference: "Matthew 11:28"
      },
      {
        quote: "God does not burden a soul beyond that it can bear.",
        source: "Quran",
        reference: "Surah Al-Baqarah 2:286"
      },
      {
        quote: "Even the longest night ends at dawn.",
        source: "Rumi",
        reference: "Masnavi"
      },
      {
        quote: "Be like a tree and let the dead leaves drop.",
        source: "Rumi",
        reference: "Masnavi"
      }
    ]
  },
  numb: {
    acknowledgment: "When we feel nothing, it is often because we have felt too much. This is protection, not emptiness.",
    scriptures: [
      {
        quote: "This too shall pass.",
        source: "Persian proverb",
        reference: "Ancient wisdom"
      },
      {
        quote: "Nothing is permanent. Everything is in a state of flux.",
        source: "Buddha",
        reference: "Dhammapada"
      },
      {
        quote: "Even after all this time, the sun never says to the earth: you owe me.",
        source: "Hafiz",
        reference: "Persian poetry"
      },
      {
        quote: "The most beautiful people we have known are those who have known defeat, known suffering, known struggle, known loss, and have found their way out of the depths.",
        source: "Elisabeth Kubler-Ross",
        reference: "On Death and Dying"
      }
    ]
  },
  loss: {
    acknowledgment: "Grief is what love looks like when it has nowhere to go.",
    scriptures: [
      {
        quote: "Verily, with every hardship comes ease.",
        source: "Quran",
        reference: "Surah Al-Inshirah 94:5-6"
      },
      {
        quote: "Blessed are those who mourn, for they will be comforted.",
        source: "Bible",
        reference: "Matthew 5:4"
      },
      {
        quote: "Do not grieve. Everything you lose comes round in another form.",
        source: "Rumi",
        reference: "Masnavi"
      },
      {
        quote: "The darker the night, the brighter the stars. The deeper the grief, the closer is God.",
        source: "Fyodor Dostoevsky",
        reference: "Crime and Punishment"
      }
    ]
  },
  "self-worth": {
    acknowledgment: "Your value is not measured by how someone treated you.",
    scriptures: [
      {
        quote: "We have honored the children of Adam and carried them on land and sea, and provided for them of the good things, and preferred them greatly over many of those We created.",
        source: "Quran",
        reference: "Surah Al-Isra 17:70"
      },
      {
        quote: "For you created my inmost being; you knit me together in my mother's womb. I am fearfully and wonderfully made.",
        source: "Bible",
        reference: "Psalm 139:13-14"
      },
      {
        quote: "You yourself, as much as anybody in the entire universe, deserve your love and affection.",
        source: "Buddha",
        reference: "Dhammapada"
      },
      {
        quote: "Do not compare yourself with others. You have your own dharma to fulfill.",
        source: "Bhagavad Gita",
        reference: "Chapter 3"
      }
    ]
  },
  hope: {
    acknowledgment: "There is something in you that still believes things can be different. That is worth holding onto.",
    scriptures: [
      {
        quote: "And after every difficulty, there is relief.",
        source: "Quran",
        reference: "Surah Al-Inshirah 94:6"
      },
      {
        quote: "For I know the plans I have for you — plans to prosper you and not to harm you, plans to give you hope and a future.",
        source: "Bible",
        reference: "Jeremiah 29:11"
      },
      {
        quote: "Even the darkest night will end and the sun will rise.",
        source: "Victor Hugo",
        reference: "Les Miserables"
      },
      {
        quote: "In the middle of difficulty lies opportunity.",
        source: "Albert Einstein",
        reference: ""
      }
    ]
  },
  "letting-go": {
    acknowledgment: "Letting go is not forgetting. It is choosing yourself.",
    scriptures: [
      {
        quote: "You only lose what you cling to.",
        source: "Buddha",
        reference: "Dhammapada"
      },
      {
        quote: "Be like a tree and let the dead leaves drop.",
        source: "Rumi",
        reference: "Masnavi"
      },
      {
        quote: "Let all bitterness and wrath and anger and clamor and slander be put away from you, with all malice. Be kind to one another, tenderhearted, forgiving one another.",
        source: "Bible",
        reference: "Ephesians 4:31-32"
      },
      {
        quote: "Perform your obligatory duty, because action is indeed better than inaction.",
        source: "Bhagavad Gita",
        reference: "Chapter 3, Verse 8"
      }
    ]
  },
  overthinking: {
    acknowledgment: "Your mind is searching for certainty where there may not be any. That is exhausting to carry.",
    scriptures: [
      {
        quote: "The mind is everything. What you think, you become.",
        source: "Buddha",
        reference: "Dhammapada"
      },
      {
        quote: "You have power over your mind, not outside events. Realize this and you will find strength.",
        source: "Marcus Aurelius",
        reference: "Meditations"
      },
      {
        quote: "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God. And the peace of God, which transcends all understanding, will guard your hearts and minds.",
        source: "Bible",
        reference: "Philippians 4:6-7"
      },
      {
        quote: "Stop acting so small. You are the universe in ecstatic motion.",
        source: "Rumi",
        reference: "Masnavi"
      }
    ]
  },
  lost: {
    acknowledgment: "Feeling lost often means you have outgrown where you were. That is the first step forward.",
    scriptures: [
      {
        quote: "Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.",
        source: "Bible",
        reference: "Proverbs 3:5-6"
      },
      {
        quote: "Even if you are on the right track, you will get run over if you just sit there.",
        source: "Will Rogers",
        reference: ""
      },
      {
        quote: "The soul that sees beauty may sometimes walk alone.",
        source: "Johann Wolfgang von Goethe",
        reference: ""
      },
      {
        quote: "Do not lose yourself in the ordinary. Be extraordinary by staying true to your dharma.",
        source: "Bhagavad Gita",
        reference: "Chapter 18"
      },
      {
        quote: "Wherever you are is the entry point.",
        source: "Kabir",
        reference: "Dohas"
      }
    ]
  }
};

const WISDOM_REFLECTIONS_BY_THEME = {
  longing: "Longing is a sign that you loved honestly. That is not weakness.",
  anxiety: "You do not need to have all the answers right now. One breath at a time is enough.",
  rejection: "You are not diminished by someone's inability to see your worth.",
  heavy: "You are allowed to rest. You do not have to earn gentleness.",
  numb: "Numbness is temporary. You are still here, and that matters more than you know.",
  loss: "Grief is love with nowhere to go. It means something real happened.",
  "self-worth": "You were worthy before anyone confirmed it, and you still are.",
  hope: "Something in you still hopes. That strength is very real.",
  "letting-go": "Releasing something does not mean it did not matter. It means you matter too.",
  overthinking: "You cannot think your way out of a feeling. You can only feel it gently.",
  lost: "Being lost means you have left somewhere behind. That is already courage."
};

// ─── Helper functions ─────────────────────────────────────────────────────────

function detectThemeFromText(text) {
  const lower = text.toLowerCase();
  if (/(miss |missing|longing|long for|wish .* here|without (you|them|him|her)|want (them|him|her) back|came back|never came|i still think about)/.test(lower)) return "longing";
  if (/(worr|anxious|scared|afraid|fear|nervous|panic|what if|dread|can't breathe)/.test(lower)) return "anxiety";
  if (/(rejected|not chosen|not enough|not good enough|left me|chose someone|chose her|chose him|don't want me|unwanted)/.test(lower)) return "rejection";
  if (/(heavy|tired|exhausted|burden|overwhelmed|too much|so much|can't handle|drained|weight)/.test(lower)) return "heavy";
  if (/(numb|empty|nothing|don't feel|can't feel|hollow|blank|disconnected|dead inside)/.test(lower)) return "numb";
  if (/(lost|confused|don't know (who|what|where)|what am i|direction|purpose|pointless|meaningless|which way)/.test(lower)) return "lost";
  if (/(worthless|useless|don't deserve|not worthy|what's wrong with me|hate myself|i'm nothing|i'm not enough)/.test(lower)) return "self-worth";
  if (/(let go|move on|release|holding on|can't move|stuck|can't forget|can't stop thinking about)/.test(lower)) return "letting-go";
  if (/(hope|will it get better|things will|going to be okay|future|forward|light at the end)/.test(lower)) return "hope";
  if (/(keep thinking|can't stop thinking|overthinking|racing thoughts|my mind|thoughts won't|in my head|loop)/.test(lower)) return "overthinking";
  if (/(ended|over|breakup|break.?up|they left|they're gone|it's over|we broke)/.test(lower)) return "loss";
  return "longing";
}

function getRandomWisdom(theme) {
  const themeData = WISDOM_BY_THEME[theme] || WISDOM_BY_THEME.longing;
  const list = themeData.scriptures;
  return list[Math.floor(Math.random() * list.length)];
}

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

function readStoredJourneys() {
  try {
    const parsed = JSON.parse(localStorage.getItem(JOURNEY_STORAGE_KEY));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredJourneys(nextValue) {
  localStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(nextValue));
}

function readStoredMuseumNotes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(MUSEUM_STORAGE_KEY));
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    return MUSEUM_SEED_NOTES;
  }
  return MUSEUM_SEED_NOTES;
}

function saveStoredMuseumNotes(notes) {
  localStorage.setItem(MUSEUM_STORAGE_KEY, JSON.stringify(notes));
}

function readStoredWisdomChat() {
  try {
    const parsed = JSON.parse(localStorage.getItem(WISDOM_CHAT_STORAGE_KEY));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredWisdomChat(nextValue) {
  localStorage.setItem(WISDOM_CHAT_STORAGE_KEY, JSON.stringify(nextValue));
}

function hasContactDetails(value) {
  const text = typeof value === "string" ? value : "";
  const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const phonePattern = /(?:\+?\d[\s().-]*){8,}/;
  return emailPattern.test(text) || phonePattern.test(text);
}

function formatMuseumDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function getJourney(id) {
  return HEALING_JOURNEYS.find((journey) => journey.id === id) || null;
}

function getJourneyState(storedJourneys, journey) {
  const stored = storedJourneys[journey.id];
  return {
    journeyId: journey.id,
    currentDay: Math.min(Math.max(Number(stored?.currentDay) || 1, 1), journey.prompts.length),
    entries: Array.isArray(stored?.entries) ? stored.entries : []
  };
}

function getJourneyEntry(journeyState, day) {
  return journeyState.entries.find((entry) => entry.day === day) || null;
}

function getRoute() {
  const path = window.location.pathname;
  if (
    path === "/journal" || path === "/reflect" || path === "/check-in" ||
    path === "/pause" || path === "/journeys" || path === "/museum" ||
    path === "/wisdom" || path.startsWith("/journeys/")
  ) return path;
  return "/check-in";
}

function navigate(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

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
  return (
    <div className={`rounded-3xl bg-white/75 shadow-[0_18px_50px_rgba(88,82,120,0.14)] ring-1 ring-white/70 backdrop-blur ${className}`}>
      {children}
    </div>
  );
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

// ─── Scripture quote display (used in reflect + wisdom chat) ──────────────────

function ScriptureBlock({ scripture }) {
  if (!scripture) return null;
  return (
    <div className="my-4 border-l-[3px] border-violet-300 pl-4">
      <p className="text-lg leading-8 text-slate-800 font-medium">"{scripture.quote}"</p>
      <p className="mt-2 text-sm font-semibold text-slate-500">
        — {scripture.source}{scripture.reference ? `, ${scripture.reference}` : ""}
      </p>
    </div>
  );
}

// ─── Check-in ────────────────────────────────────────────────────────────────

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
      <div className="grid gap-3 mb-6">
        <Button variant="secondary" className="w-full" onClick={() => navigate("/wisdom")}>
          Talk — get wisdom from scriptures
        </Button>
        <Button variant="quiet" className="w-full" onClick={() => navigate("/journeys")}>Explore Healing Journeys</Button>
        <Button variant="quiet" className="w-full" onClick={() => navigate("/museum")}>Visit Museum of Unsaid Things</Button>
      </div>
    </SoftShell>
  );
}

// ─── Calming card ─────────────────────────────────────────────────────────────

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

// ─── Journal ──────────────────────────────────────────────────────────────────

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

// ─── Reflection ───────────────────────────────────────────────────────────────

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

function WisdomFromScripture({ emotion }) {
  const [scripture, setScripture] = useState(null);

  useEffect(() => {
    if (!emotion?.wisdomTheme) return;
    setScripture(getRandomWisdom(emotion.wisdomTheme));
  }, [emotion?.wisdomTheme]);

  if (!scripture) return null;

  return (
    <Card className="p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">From the scriptures</p>
      <ScriptureBlock scripture={scripture} />
      <p className="mt-3 leading-7 text-slate-600">
        {WISDOM_REFLECTIONS_BY_THEME[emotion?.wisdomTheme] || "You are not alone in what you feel."}
      </p>
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
        <WisdomFromScripture emotion={emotion} />
        {calming && <CalmingCard onClose={() => setCalming(false)} />}
      </div>

      {saved && (
        <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm">
          Saved. Let this be enough for now.
        </div>
      )}

      <div className="mt-auto grid gap-3 py-6">
        <Button onClick={onWriteMore}>Write more</Button>
        <Button variant="secondary" onClick={() => navigate("/wisdom")}>Talk — get wisdom from scriptures</Button>
        <Button variant="secondary" onClick={() => setCalming(true)}>Start calming exercise</Button>
        <Button variant="secondary" onClick={() => navigate("/pause")}>I feel like texting them</Button>
        <Button variant="secondary" onClick={() => navigate("/journeys")}>Explore Healing Journeys</Button>
        <Button variant="secondary" onClick={() => navigate("/museum")}>Visit Museum of Unsaid Things</Button>
        <Button variant="quiet" onClick={saveReflection}>Save this</Button>
      </div>
    </SoftShell>
  );
}

// ─── Pause Before You Text ────────────────────────────────────────────────────

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

// ─── Healing Journeys ─────────────────────────────────────────────────────────

function JourneyProgress({ day, total }) {
  const percent = Math.round((day / total) * 100);
  return (
    <div>
      <div className="flex items-center justify-between text-sm font-semibold text-slate-500">
        <span>Day {day} of {total}</span>
        <span>{percent}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/70">
        <div className="h-full rounded-full bg-slate-800 transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function JourneyCard({ journey, journeyState }) {
  const hasStarted = journeyState.entries.length > 0 || journeyState.currentDay > 1;
  return (
    <Card className="p-5">
      <div className="flex min-h-44 flex-col">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Healing Journey</p>
        <h2 className="mt-3 text-2xl font-semibold leading-snug text-slate-900">{journey.title}</h2>
        <p className="mt-2 leading-7 text-slate-600">{journey.subtitle}</p>
        <div className="mt-5">
          <JourneyProgress day={journeyState.currentDay} total={journey.prompts.length} />
        </div>
        <Button className="mt-5 w-full" onClick={() => navigate(`/journeys/${journey.id}`)}>
          {hasStarted ? "Continue" : "Start"}
        </Button>
      </div>
    </Card>
  );
}

function JourneysListScreen({ storedJourneys }) {
  return (
    <SoftShell>
      <PageHeader eyebrow="Healing Journeys" title="Take your time. Start where you are.">
        Choose one path and move through it gently, one honest page at a time.
      </PageHeader>
      <section className="grid gap-4 pb-6">
        {HEALING_JOURNEYS.map((journey) => (
          <JourneyCard key={journey.id} journey={journey} journeyState={getJourneyState(storedJourneys, journey)} />
        ))}
      </section>
      <Button variant="quiet" className="mb-4 w-full" onClick={() => navigate("/check-in")}>Back to check-in</Button>
    </SoftShell>
  );
}

function JourneyEntry({ journey, journeyState, text, onTextChange, onSave, onContinue, saved, gentleNote }) {
  const currentPrompt = journey.prompts[journeyState.currentDay - 1];
  const isFinalDay = journeyState.currentDay >= journey.prompts.length;

  return (
    <div className="grid gap-4">
      <Card className="p-5">
        <JourneyProgress day={journeyState.currentDay} total={journey.prompts.length} />
      </Card>
      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-500">Today's prompt</p>
        <h2 className="mt-3 text-2xl font-semibold leading-snug text-slate-900">{currentPrompt}</h2>
        <textarea
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder="Write slowly. One true sentence is enough."
          className="mt-5 min-h-[300px] w-full resize-none rounded-2xl bg-white/65 p-4 text-base leading-8 text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-200"
        />
        <div className="mt-3 flex items-center justify-between px-1 text-sm text-slate-500">
          <span>{text.length} characters</span>
          <span>Saved on this device.</span>
        </div>
      </Card>
      {saved && (
        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm">
          You showed up for yourself today. That's enough.
        </div>
      )}
      {gentleNote && (
        <div className="rounded-2xl bg-white/65 px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm">
          This works best if you take one step at a time.
        </div>
      )}
      <div className="grid gap-3 pb-6">
        <Button onClick={onSave} disabled={!text.trim()}>Save</Button>
        <Button variant="secondary" onClick={onContinue}>{isFinalDay ? "Return to journeys" : "Continue tomorrow"}</Button>
        <Button variant="quiet" onClick={() => navigate("/journeys")}>All journeys</Button>
      </div>
    </div>
  );
}

function JourneyDetailScreen({ journeyId, storedJourneys, onStoredJourneysChange }) {
  const journey = getJourney(journeyId);
  const activeJourney = journey || HEALING_JOURNEYS[0];
  const activeJourneyState = getJourneyState(storedJourneys, activeJourney);
  const activeEntry = getJourneyEntry(activeJourneyState, activeJourneyState.currentDay);
  const [text, setText] = useState(activeEntry?.text || "");
  const [saved, setSaved] = useState(false);
  const [gentleNote, setGentleNote] = useState(false);

  useEffect(() => {
    if (!journey) navigate("/journeys");
  }, [journey]);

  useEffect(() => {
    const nextState = getJourneyState(storedJourneys, activeJourney);
    const nextEntry = getJourneyEntry(nextState, nextState.currentDay);
    setText(nextEntry?.text || "");
  }, [journeyId, storedJourneys[journeyId]?.currentDay]);

  if (!journey) return null;

  const journeyState = getJourneyState(storedJourneys, journey);

  const saveEntry = () => {
    const prompt = journey.prompts[journeyState.currentDay - 1];
    const nextEntry = {
      day: journeyState.currentDay,
      prompt,
      text: text.trim(),
      savedAt: new Date().toISOString()
    };
    const entriesWithoutCurrentDay = journeyState.entries.filter((entry) => entry.day !== journeyState.currentDay);
    const nextStoredJourneys = {
      ...storedJourneys,
      [journey.id]: {
        journeyId: journey.id,
        currentDay: journeyState.currentDay,
        entries: [...entriesWithoutCurrentDay, nextEntry].sort((a, b) => a.day - b.day)
      }
    };
    saveStoredJourneys(nextStoredJourneys);
    onStoredJourneysChange(nextStoredJourneys);
    setSaved(true);
  };

  const continueJourney = () => {
    if (journeyState.currentDay >= journey.prompts.length) {
      navigate("/journeys");
      return;
    }
    const nextStoredJourneys = {
      ...storedJourneys,
      [journey.id]: {
        ...journeyState,
        currentDay: journeyState.currentDay + 1
      }
    };
    saveStoredJourneys(nextStoredJourneys);
    onStoredJourneysChange(nextStoredJourneys);
    setSaved(false);
    setGentleNote(true);
  };

  return (
    <SoftShell>
      <PageHeader eyebrow="Healing Journey" title={journey.title}>
        {journey.subtitle}
      </PageHeader>
      <JourneyEntry
        journey={journey}
        journeyState={journeyState}
        text={text}
        onTextChange={(value) => {
          setText(value);
          setSaved(false);
        }}
        onSave={saveEntry}
        onContinue={continueJourney}
        saved={saved}
        gentleNote={gentleNote}
      />
    </SoftShell>
  );
}

// ─── Museum of Unsaid Things ──────────────────────────────────────────────────

function CategoryFilter({ activeCategory, onChange }) {
  const categories = ["All", ...MUSEUM_CATEGORIES];
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
      {categories.map((category) => (
        <button
          key={category}
          type="button"
          onClick={() => onChange(category)}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
            activeCategory === category
              ? "bg-slate-900 text-white shadow-lg shadow-slate-300/40"
              : "bg-white/70 text-slate-600 ring-1 ring-white/80 hover:bg-white"
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  );
}

function MuseumNoteCard({ note, index }) {
  const paperTones = ["bg-rose-50", "bg-amber-50", "bg-blue-50", "bg-violet-50", "bg-emerald-50", "bg-stone-50"];
  const tone = paperTones[index % paperTones.length];
  return (
    <article className={`mb-4 inline-block w-full break-inside-avoid rounded-3xl ${tone} p-5 shadow-[0_14px_35px_rgba(88,82,120,0.12)] ring-1 ring-white/80 transition duration-200 hover:-translate-y-1`}>
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-slate-600">{note.category}</span>
        <span className="text-xs font-medium text-slate-400">{formatMuseumDate(note.createdAt)}</span>
      </div>
      <p className="mt-4 whitespace-pre-wrap text-lg leading-8 text-slate-800">{note.text}</p>
      <p className="mt-5 text-sm font-semibold text-slate-500">Someone left this here.</p>
    </article>
  );
}

function MuseumWall({ notes }) {
  if (notes.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-lg leading-8 text-slate-700">Nothing here yet. Maybe your words belong here first.</p>
      </Card>
    );
  }
  return (
    <section className="columns-1 gap-4 pb-6 sm:columns-2">
      {notes.map((note, index) => (
        <MuseumNoteCard key={note.id} note={note} index={index} />
      ))}
    </section>
  );
}

function NoteComposer({ onAddNote, onCancel }) {
  const [category, setCategory] = useState("Love");
  const [text, setText] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const showPrivacyWarning = hasContactDetails(text);

  const submitNote = () => {
    const cleanText = text.trim();
    if (!cleanText || !confirmed) return;
    onAddNote({
      id: `note-${Date.now()}`,
      category,
      text: cleanText,
      createdAt: new Date().toISOString()
    });
    setCategory("Love");
    setText("");
    setConfirmed(false);
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Leave a note</p>
          <h2 className="mt-2 text-2xl font-semibold leading-snug text-slate-900">Place your words softly.</h2>
        </div>
        <button type="button" onClick={onCancel} className="rounded-full bg-white/70 px-3 py-2 text-sm font-semibold text-slate-500">
          Close
        </button>
      </div>

      <label className="mt-5 block text-sm font-semibold text-slate-600" htmlFor="museum-category">Category</label>
      <select
        id="museum-category"
        value={category}
        onChange={(event) => setCategory(event.target.value)}
        className="mt-2 h-12 w-full rounded-2xl border-0 bg-white/75 px-4 text-base font-medium text-slate-700 outline-none ring-1 ring-white/80 focus:ring-2 focus:ring-blue-200"
      >
        {MUSEUM_CATEGORIES.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>

      <label className="mt-5 block text-sm font-semibold text-slate-600" htmlFor="museum-note">Unsaid note</label>
      <textarea
        id="museum-note"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Write the words you never sent..."
        className="mt-2 min-h-[220px] w-full resize-none rounded-2xl bg-white/65 p-4 text-base leading-8 text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-200"
      />

      {showPrivacyWarning && (
        <div className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-700">
          For privacy, avoid adding contact details.
        </div>
      )}

      <label className="mt-4 flex items-start gap-3 rounded-2xl bg-white/60 p-4 text-sm leading-6 text-slate-600">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300"
        />
        <span>I understand this is anonymous and saved only on this device for now.</span>
      </label>

      <Button className="mt-5 w-full" onClick={submitNote} disabled={!text.trim() || !confirmed}>Place it on the wall</Button>
    </Card>
  );
}

function MuseumScreen() {
  const [notes, setNotes] = useState([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [showComposer, setShowComposer] = useState(false);

  useEffect(() => {
    const storedNotes = readStoredMuseumNotes();
    setNotes(storedNotes);
    if (!localStorage.getItem(MUSEUM_STORAGE_KEY)) saveStoredMuseumNotes(storedNotes);
  }, []);

  const addNote = (note) => {
    const nextNotes = [note, ...notes];
    setNotes(nextNotes);
    saveStoredMuseumNotes(nextNotes);
    setActiveCategory("All");
    setShowComposer(false);
  };

  const filteredNotes = activeCategory === "All" ? notes : notes.filter((note) => note.category === activeCategory);

  return (
    <SoftShell>
      <PageHeader eyebrow="A quiet wall" title="Museum of Unsaid Things">
        A quiet wall for the words people never sent.
      </PageHeader>

      <div className="grid gap-4 pb-5">
        <Button onClick={() => setShowComposer(true)}>Leave an unsaid note</Button>
        <div className="rounded-2xl bg-white/60 px-4 py-3 text-sm leading-6 text-slate-600 shadow-sm">
          Please do not share personal details, threats, or anything that could identify someone.
        </div>
      </div>

      {showComposer && (
        <div className="mb-5">
          <NoteComposer onAddNote={addNote} onCancel={() => setShowComposer(false)} />
        </div>
      )}

      <div className="mb-4">
        <CategoryFilter activeCategory={activeCategory} onChange={setActiveCategory} />
      </div>
      <MuseumWall notes={filteredNotes} />

      <Button variant="quiet" className="mb-4 w-full" onClick={() => navigate("/check-in")}>Back to check-in</Button>
    </SoftShell>
  );
}

// ─── Wisdom Chat ──────────────────────────────────────────────────────────────

const WISDOM_GREETING = "This is a safe space. No one reads what you write here — not now, not ever. Share what you are carrying and I will offer you a word from the wisdom of ages. You are not judged here. You are only heard.";

function ThinkingBubble() {
  return (
    <div className="flex justify-start mb-3">
      <div className="rounded-3xl rounded-tl-md bg-white/80 px-5 py-4 shadow-[0_14px_35px_rgba(88,82,120,0.10)] ring-1 ring-white/80">
        <div className="flex gap-1.5 items-center h-5">
          <span className="h-2 w-2 rounded-full bg-violet-300 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="h-2 w-2 rounded-full bg-violet-300 animate-bounce" style={{ animationDelay: "160ms" }} />
          <span className="h-2 w-2 rounded-full bg-violet-300 animate-bounce" style={{ animationDelay: "320ms" }} />
        </div>
      </div>
    </div>
  );
}

function WisdomBubble({ message }) {
  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[88%] rounded-3xl rounded-tl-md bg-white/80 p-5 shadow-[0_14px_35px_rgba(88,82,120,0.10)] ring-1 ring-white/80">
        {message.text && (
          <p className="leading-7 text-slate-700">{message.text}</p>
        )}
        {message.acknowledgment && (
          <p className="leading-7 text-slate-600 italic">{message.acknowledgment}</p>
        )}
        {message.scripture && (
          <ScriptureBlock scripture={message.scripture} />
        )}
        {message.reflection && (
          <p className="mt-3 leading-7 text-slate-600">{message.reflection}</p>
        )}
      </div>
    </div>
  );
}

function UserBubble({ message }) {
  return (
    <div className="flex justify-end mb-4">
      <div className="max-w-[80%] rounded-3xl rounded-tr-md bg-slate-800 px-5 py-4">
        <p className="leading-7 text-white">{message.text}</p>
      </div>
    </div>
  );
}

function WisdomChatScreen() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const stored = readStoredWisdomChat();
    if (Array.isArray(stored.messages) && stored.messages.length > 0) {
      setMessages(stored.messages);
    } else {
      const greeting = {
        id: "greeting",
        role: "wisdom",
        text: WISDOM_GREETING,
        createdAt: new Date().toISOString()
      };
      setMessages([greeting]);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim() || isTyping) return;

    const userMsg = {
      id: `u-${Date.now()}`,
      role: "user",
      text: input.trim(),
      createdAt: new Date().toISOString()
    };

    const withUser = [...messages, userMsg];
    setMessages(withUser);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const theme = detectThemeFromText(userMsg.text);
      const themeData = WISDOM_BY_THEME[theme] || WISDOM_BY_THEME.longing;
      const scripture = getRandomWisdom(theme);
      const reflection = WISDOM_REFLECTIONS_BY_THEME[theme] || WISDOM_REFLECTIONS_BY_THEME.longing;

      const wisdomMsg = {
        id: `w-${Date.now()}`,
        role: "wisdom",
        acknowledgment: themeData.acknowledgment,
        scripture,
        reflection,
        createdAt: new Date().toISOString()
      };

      const final = [...withUser, wisdomMsg];
      setMessages(final);
      saveStoredWisdomChat({ messages: final });
      setIsTyping(false);
    }, 1400);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    const greeting = {
      id: `greeting-${Date.now()}`,
      role: "wisdom",
      text: WISDOM_GREETING,
      createdAt: new Date().toISOString()
    };
    setMessages([greeting]);
    saveStoredWisdomChat({});
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(145deg,#f0ebe8_0%,#ece8ff_50%,#e5f5ff_100%)] flex flex-col">
      <header className="px-4 pt-5 pb-3 shrink-0">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">A quiet companion</p>
              <h1 className="mt-1 text-3xl font-semibold text-slate-900">Wisdom</h1>
            </div>
            <button
              type="button"
              onClick={() => navigate("/check-in")}
              className="rounded-2xl bg-white/70 px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-white/80 hover:bg-white transition"
            >
              Back
            </button>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-500">Private. Unread. Only yours.</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-3">
        <div className="mx-auto max-w-md">
          {messages.map((message) =>
            message.role === "user"
              ? <UserBubble key={message.id} message={message} />
              : <WisdomBubble key={message.id} message={message} />
          )}
          {isTyping && <ThinkingBubble />}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <div className="shrink-0 px-4 pb-6 pt-3 bg-white/20 backdrop-blur border-t border-white/40">
        <div className="mx-auto max-w-md">
          <div className="flex gap-3 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write what is on your heart..."
              rows={2}
              className="flex-1 resize-none rounded-2xl bg-white/80 px-4 py-3 text-base leading-7 text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-violet-200 ring-1 ring-white/80"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="h-12 w-12 shrink-0 rounded-2xl bg-slate-900 text-white text-lg shadow-lg shadow-slate-400/25 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition"
              aria-label="Send"
            >
              ↑
            </button>
          </div>
          <button
            type="button"
            onClick={clearChat}
            className="mt-3 w-full text-center text-sm font-medium text-slate-500 hover:text-slate-700 transition"
          >
            Start a new conversation
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── App shell & routing ──────────────────────────────────────────────────────

function App() {
  const [route, setRoute] = useState(getRoute);
  const [selectedEmotionId, setSelectedEmotionId] = useState("");
  const [journalText, setJournalText] = useState("");
  const [storedJourneys, setStoredJourneys] = useState({});

  useEffect(() => {
    const stored = readStoredFlow();
    setSelectedEmotionId(stored.emotionId || "");
    setJournalText(stored.journalText || "");
    setStoredJourneys(readStoredJourneys());
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

  if (route === "/wisdom") return <WisdomChatScreen />;

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

  if (route === "/pause") return <PauseFlow />;

  if (route === "/journeys") return <JourneysListScreen storedJourneys={storedJourneys} />;

  if (route === "/museum") return <MuseumScreen />;

  if (route.startsWith("/journeys/")) {
    const journeyId = route.replace("/journeys/", "");
    if (!getJourney(journeyId)) {
      return <JourneysListScreen storedJourneys={storedJourneys} />;
    }
    return (
      <JourneyDetailScreen
        journeyId={journeyId}
        storedJourneys={storedJourneys}
        onStoredJourneysChange={setStoredJourneys}
      />
    );
  }

  return <CheckInScreen onSelect={selectEmotion} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
