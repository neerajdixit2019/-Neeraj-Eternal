import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppBottomNav, AppTopNav } from "./components/AppNavigation.jsx";
import { CompassInsightCard, PrivatePatternPanel, RecommendedRoomCard } from "./components/CompassCards.jsx";
import { LocalDataVault } from "./components/LocalDataVault.jsx";
import { SyncPanel } from "./components/SyncPanel.jsx";
import { isKnownAppRoute } from "./screens/routeManifest.js";
import { getCompassInsights, readCompassState, saveCompassState } from "./storage/compassInsights.js";

const STORAGE_KEY = "eternal-emotional-flow";
const PAUSE_STORAGE_KEY = "eternal-pause-before-text";
const JOURNEY_STORAGE_KEY = "eternal-healing-journeys";
const MUSEUM_STORAGE_KEY = "eternal-museum-unsaid-notes";
const WISDOM_CHAT_STORAGE_KEY = "eternal-wisdom-chat";
const DAILY_SANCTUARY_STORAGE_KEY = "eternal-daily-sanctuary";
const GUIDED_CALM_STORAGE_KEY = "eternal-guided-calm";
const PRESSURE_RESET_STORAGE_KEY = "eternal-pressure-reset";
const CARE_KIT_STORAGE_KEY = "eternal-care-kit";
const WELCOME_STORAGE_KEY = "eternal-welcome";
const AFTERCARE_STORAGE_KEY = "eternal-aftercare";
const ONBOARDING_PREFERENCES_STORAGE_KEY = "eternal-onboarding-preferences";
const LEGACY_STORAGE_PREFIX = ["nee", "raj", "-eternal-"].join("");
const LEGACY_STORAGE_KEYS = [
  [STORAGE_KEY, `${LEGACY_STORAGE_PREFIX}emotional-flow`],
  [PAUSE_STORAGE_KEY, `${LEGACY_STORAGE_PREFIX}pause-before-text`],
  [JOURNEY_STORAGE_KEY, `${LEGACY_STORAGE_PREFIX}healing-journeys`],
  [MUSEUM_STORAGE_KEY, ["museum", "_unsaid", "_notes"].join("")],
  [WISDOM_CHAT_STORAGE_KEY, `${LEGACY_STORAGE_PREFIX}wisdom-chat`],
  [DAILY_SANCTUARY_STORAGE_KEY, `${LEGACY_STORAGE_PREFIX}daily-sanctuary`],
  [GUIDED_CALM_STORAGE_KEY, `${LEGACY_STORAGE_PREFIX}guided-calm`],
  [PRESSURE_RESET_STORAGE_KEY, `${LEGACY_STORAGE_PREFIX}pressure-reset`],
  [CARE_KIT_STORAGE_KEY, `${LEGACY_STORAGE_PREFIX}care-kit`],
  [WELCOME_STORAGE_KEY, `${LEGACY_STORAGE_PREFIX}welcome`],
  [AFTERCARE_STORAGE_KEY, `${LEGACY_STORAGE_PREFIX}aftercare`],
  [ONBOARDING_PREFERENCES_STORAGE_KEY, `${LEGACY_STORAGE_PREFIX}onboarding-preferences`]
];

function migrateLegacyStorageKeys() {
  if (typeof window === "undefined" || !window.localStorage) return;
  LEGACY_STORAGE_KEYS.forEach(([nextKey, legacyKey]) => {
    try {
      if (!window.localStorage.getItem(nextKey) && window.localStorage.getItem(legacyKey)) {
        window.localStorage.setItem(nextKey, window.localStorage.getItem(legacyKey));
      }
    } catch {
      // Local storage can fail in restricted browser modes. The app should still load.
    }
  });
}

migrateLegacyStorageKeys();

const MUSEUM_CATEGORIES = ["Love", "Regret", "Forgiveness", "Hope", "Self-respect", "Goodbye"];

const MUSEUM_READING_FILTERS = [
  { label: "Missing someone", category: "Love" },
  { label: "Need hope", category: "Hope" },
  { label: "Choosing myself", category: "Self-respect" }
];

const DAILY_SANCTUARY_ACTIONS = [
  { id: "breathe", label: "Breathe for one minute", text: "Put one hand on your chest and let the next breath be slower." },
  { id: "walk", label: "Take a short walk", text: "Move your body gently, even if it is only around the room." },
  { id: "water", label: "Drink water", text: "Give your body one small act of care before solving anything." },
  { id: "message-safe", label: "Message someone safe", text: "Send one simple line to a trusted person: I am having a hard day." },
  { id: "study-small", label: "Do one tiny task", text: "Choose the smallest useful action and stop after ten minutes if needed." }
];

const DAILY_SANCTUARY_WISDOM = {
  longing: "Missing someone can be real without becoming your next command.",
  overthinking: "Your mind wants certainty. Today, one honest step is enough.",
  rejection: "Not being chosen does not make you less worthy of care.",
  anxiety: "You do not need to meet tomorrow with today's nervous system.",
  numb: "Numb is still a feeling asking for gentleness.",
  heavy: "You are allowed to put one part of the weight down today.",
  lost: "Feeling lost can be the first sign that a truer path is forming."
};

const CALM_EXERCISES = [
  {
    id: "breathing",
    title: "One-minute breathing",
    shortTitle: "Breathing",
    duration: 60,
    text: "Inhale for 4, hold for 2, exhale for 6. Let the body lead."
  },
  {
    id: "grounding",
    title: "5-4-3-2-1 grounding",
    shortTitle: "Grounding",
    text: "Come back to this room through your senses, one small detail at a time."
  },
  {
    id: "unclench",
    title: "Unclench reset",
    shortTitle: "Unclench",
    duration: 90,
    text: "Move attention through the body and release what is gripping."
  },
  {
    id: "kind-voice",
    title: "Kind voice",
    shortTitle: "Kind voice",
    text: "Borrow a gentler voice when your inner voice gets sharp."
  }
];

const GROUNDING_STEPS = [
  "Name 5 things you can see. Let your eyes move slowly.",
  "Notice 4 things you can feel: fabric, floor, air, or your own hands.",
  "Listen for 3 sounds near or far. You do not have to judge them.",
  "Find 2 things you can smell, or imagine two scents that feel safe.",
  "Notice 1 taste, or take one slow breath and name: I am here."
];

const UNCLENCH_STEPS = [
  "Soften your jaw. Let your tongue rest.",
  "Drop your shoulders one small inch.",
  "Open your hands. Release the fingers.",
  "Let your belly stop bracing for a moment.",
  "Press your feet into the floor and feel support."
];

const KIND_VOICE_SCRIPTS = [
  { id: "shame", label: "Shame", text: "I made it through a hard moment. I do not need to punish myself to grow." },
  { id: "panic", label: "Panic", text: "This is a wave in my body. It can rise, move, and pass. I can take one breath." },
  { id: "rejection", label: "Rejection", text: "Someone's response is not the full truth of my worth. I am still allowed to be gentle with myself." },
  { id: "heaviness", label: "Heaviness", text: "I do not have to carry the whole day at once. I can put down one small piece." }
];

const SOS_STEPS = [
  {
    title: "Put both feet down",
    text: "Feel the floor or the bed holding you. Let your body know: I am here, in this moment."
  },
  {
    title: "Breathe out longer",
    text: "Inhale gently. Exhale slower than you inhaled. Do this three times without forcing it."
  },
  {
    title: "Name what is around you",
    text: "Say five things you can see. This helps your mind return from fear into the room."
  },
  {
    title: "Reach toward safety",
    text: "If you might hurt yourself or someone else, contact local emergency help now. If not, choose one trusted person or one calmer room."
  }
];

const PRESSURE_AREAS = [
  {
    id: "exams",
    label: "Exams or marks",
    text: "When one result feels like your whole future.",
    reframe: "Marks matter, but they are information, not your identity.",
    action: "Choose one tiny topic and study it for 15 minutes. Stop when the timer ends."
  },
  {
    id: "family",
    label: "Family expectations",
    text: "When love feels mixed with pressure.",
    reframe: "You can respect your family without carrying every fear as a command.",
    action: "Write the one expectation that feels loudest, then write one boundary your future self needs."
  },
  {
    id: "career",
    label: "Career pressure",
    text: "When everyone seems ahead and your path feels late.",
    reframe: "A future is built by repeated small steps, not by panic in one afternoon.",
    action: "Pick one skill, application, or project task you can touch for 20 minutes."
  },
  {
    id: "comparison",
    label: "Comparison",
    text: "When someone else's progress makes you doubt your own.",
    reframe: "Their timeline is not evidence against yours.",
    action: "Mute one comparison trigger for today, then do one action you would respect privately."
  },
  {
    id: "future",
    label: "Future anxiety",
    text: "When tomorrow feels too big to enter.",
    reframe: "You do not need the full map to take the next honest step.",
    action: "Write the next three practical steps. Do only the first one today."
  },
  {
    id: "money",
    label: "Money stress",
    text: "When needs, dreams, and fear all speak at once.",
    reframe: "Pressure around money is real. Shame does not make planning easier.",
    action: "List one expense, one possible saving, and one person or resource you can ask for guidance."
  }
];

const CARE_KIT_PROMPTS = [
  {
    id: "person",
    label: "Trusted person",
    placeholder: "Example: my cousin, my best friend, my teacher",
    helper: "Use a name or role only. Avoid phone numbers or private details."
  },
  {
    id: "place",
    label: "Safe place",
    placeholder: "Example: terrace, temple corner, library, my room with lights on",
    helper: "Pick somewhere your body feels a little less alone."
  },
  {
    id: "action",
    label: "Small calming action",
    placeholder: "Example: drink water, shower, walk outside, open notes app",
    helper: "Make it simple enough for a hard day."
  },
  {
    id: "reminder",
    label: "Words I need to hear",
    placeholder: "Example: This moment is not my whole life.",
    helper: "Write it like you are speaking to someone you care about."
  }
];

const CARE_KIT_IDEAS = [
  "Put both feet on the floor.",
  "Send one honest line to someone safe.",
  "Drink water before deciding anything.",
  "Step away from the screen for five minutes.",
  "Read one saved reminder slowly."
];

const WELCOME_REASONS = [
  {
    id: "overwhelmed",
    label: "I feel overwhelmed",
    text: "Your body needs safety before your mind needs answers.",
    href: "/calm",
    action: "Start with a body-first reset."
  },
  {
    id: "heartbreak",
    label: "Heartbreak or missing someone",
    text: "There are words in you that need a safe place.",
    href: "/journal",
    emotionId: "miss-someone",
    action: "Write without sending anything."
  },
  {
    id: "overthinking",
    label: "I cannot stop thinking",
    text: "The loop can soften when it becomes one honest paragraph.",
    href: "/journal",
    emotionId: "overthinking",
    action: "Name the thought that keeps repeating."
  },
  {
    id: "exams",
    label: "Exams, career, or future",
    text: "Pressure gets smaller when it becomes one next step.",
    href: "/pressure",
    action: "Turn the big cloud into a practical reset."
  },
  {
    id: "lonely",
    label: "I feel lonely",
    text: "Loneliness needs warmth, not shame.",
    href: "/wisdom",
    action: "Talk through what feels hard to say."
  },
  {
    id: "texting",
    label: "I want to text them",
    text: "The urge can be real without becoming immediate action.",
    href: "/pause",
    action: "Slow the moment before deciding."
  },
  {
    id: "not-sure",
    label: "I am not sure",
    text: "You do not need perfect language to begin.",
    href: "/today",
    action: "Start with one small daily ritual."
  }
];

const ONBOARDING_ARRIVALS = [
  {
    id: "overwhelmed",
    label: "I feel overwhelmed",
    text: "Everything feels too much and my body needs safety.",
    emotionId: "anxious",
    tone: "from-blue-100 to-violet-100"
  },
  {
    id: "heartbreak",
    label: "Heartbreak/missing someone",
    text: "My heart keeps going back to someone or something.",
    emotionId: "miss-someone",
    tone: "from-rose-100 to-violet-100"
  },
  {
    id: "exams",
    label: "Study/future pressure",
    text: "Exams, career, family, or tomorrow feels loud.",
    tone: "from-amber-100 to-orange-100"
  },
  {
    id: "lonely",
    label: "Lonely/heavy",
    text: "I feel alone, tired, numb, or emotionally heavy.",
    emotionId: "heavy",
    tone: "from-teal-100 to-emerald-100"
  },
  {
    id: "texting",
    label: "I want to text them",
    text: "There is an urge to reach out before I feel clear.",
    emotionId: "miss-someone",
    tone: "from-pink-100 to-amber-100"
  },
  {
    id: "not-sure",
    label: "Not sure",
    text: "I do not have the right words yet. I just want a start.",
    emotionId: "not-sure",
    tone: "from-fuchsia-100 to-sky-100"
  }
];

const ONBOARDING_SUPPORT_STYLES = [
  {
    id: "calm",
    label: "Calm my body",
    text: "Breathing, grounding, and less pressure to explain."
  },
  {
    id: "write",
    label: "Write privately",
    text: "A safe page for the thing I cannot say out loud."
  },
  {
    id: "wisdom",
    label: "Talk to Wisdom",
    text: "Steady spiritual words and a listening space."
  },
  {
    id: "plan",
    label: "Make a small plan",
    text: "Turn the big cloud into one next step."
  },
  {
    id: "guide",
    label: "Just guide me",
    text: "Choose a gentle first room for me."
  }
];

const AFTERCARE_ACTIONS = [
  {
    id: "calm",
    title: "Calm my body",
    text: "Let your body feel safe before you decide anything.",
    href: "/calm",
    tone: "bg-blue-50/90"
  },
  {
    id: "journal",
    title: "Write one honest line",
    text: "Use the quieter moment to name what is still here.",
    href: "/journal",
    tone: "bg-white/80"
  },
  {
    id: "wisdom",
    title: "Talk to Wisdom",
    text: "Receive steadier words for the feeling that remains.",
    href: "/wisdom",
    tone: "bg-violet-50/90"
  },
  {
    id: "journey",
    title: "Start a healing path",
    text: "Take this slowly across seven days instead of forcing an answer tonight.",
    href: "/journeys",
    tone: "bg-emerald-50/90"
  },
  {
    id: "museum",
    title: "Visit the Museum",
    text: "Read soft unsent notes when you need to feel less alone.",
    href: "/museum",
    tone: "bg-rose-50/90"
  },
  {
    id: "pause",
    title: "Pause before texting",
    text: "Slow the urge down before it becomes a message.",
    href: "/pause",
    tone: "bg-amber-50/90"
  },
  {
    id: "care",
    title: "Open Care Kit",
    text: "Return to your trusted person, safe place, and reminder.",
    href: "/care",
    tone: "bg-teal-50/90"
  },
  {
    id: "pressure",
    title: "Reset pressure",
    text: "Turn exams, family, or future worry into one next step.",
    href: "/pressure",
    tone: "bg-yellow-50/90"
  }
];

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
    example: "When your mind keeps going back to them.",
    tone: "from-rose-100 to-violet-100",
    wisdomTheme: "longing"
  },
  {
    id: "overthinking",
    label: "I am overthinking",
    shortLabel: "Overthinking",
    prompt: "Write the thought that keeps repeating in your mind.",
    reflection: "Your mind is trying to find certainty where there may be none.",
    example: "When one thought keeps replaying.",
    tone: "from-blue-100 to-indigo-100",
    wisdomTheme: "overthinking"
  },
  {
    id: "rejected",
    label: "I feel rejected",
    shortLabel: "Rejected",
    prompt: "What hurt you the most about what happened?",
    reflection: "That kind of hurt can shake how you see yourself.",
    example: "When not being chosen still stings.",
    tone: "from-amber-100 to-rose-100",
    wisdomTheme: "rejection"
  },
  {
    id: "anxious",
    label: "I feel anxious",
    shortLabel: "Anxious",
    prompt: "What are you afraid might happen?",
    reflection: "You are trying to prepare for something that hasn't happened yet.",
    example: "When the future feels too loud.",
    tone: "from-cyan-100 to-blue-100",
    wisdomTheme: "anxiety"
  },
  {
    id: "numb",
    label: "I feel numb",
    shortLabel: "Numb",
    prompt: "Even if it feels empty, write anything that comes.",
    reflection: "Sometimes feeling nothing is the mind's way of protecting itself.",
    example: "When nothing feels clear or alive.",
    tone: "from-slate-100 to-blue-100",
    wisdomTheme: "numb"
  },
  {
    id: "heavy",
    label: "I just feel heavy",
    shortLabel: "Heavy",
    prompt: "What is weighing on you right now?",
    reflection: "You have been carrying more than you should alone.",
    example: "When your heart feels tired.",
    tone: "from-violet-100 to-stone-100",
    wisdomTheme: "heavy"
  },
  {
    id: "lost",
    label: "I feel lost",
    shortLabel: "Lost",
    prompt: "Where did you last feel certain of yourself?",
    reflection: "Feeling lost often means you have outgrown where you were. That is not failure.",
    example: "When purpose, love, or future feels blurry.",
    tone: "from-teal-100 to-emerald-100",
    wisdomTheme: "lost"
  },
  {
    id: "not-sure",
    label: "I am not sure yet",
    shortLabel: "Not sure",
    prompt: "Start with the first sentence that feels true. It can be messy.",
    reflection: "Something in you is asking for language before answers.",
    example: "When everything feels mixed together.",
    tone: "from-fuchsia-100 to-sky-100",
    wisdomTheme: "heavy"
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

function readStoredDailySanctuary() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DAILY_SANCTUARY_STORAGE_KEY));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredDailySanctuary(nextValue) {
  localStorage.setItem(DAILY_SANCTUARY_STORAGE_KEY, JSON.stringify(nextValue));
}

function readStoredGuidedCalm() {
  try {
    const parsed = JSON.parse(localStorage.getItem(GUIDED_CALM_STORAGE_KEY));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredGuidedCalm(nextValue) {
  localStorage.setItem(GUIDED_CALM_STORAGE_KEY, JSON.stringify(nextValue));
}

function readStoredPressureReset() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PRESSURE_RESET_STORAGE_KEY));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredPressureReset(nextValue) {
  localStorage.setItem(PRESSURE_RESET_STORAGE_KEY, JSON.stringify(nextValue));
}

function readStoredCareKit() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CARE_KIT_STORAGE_KEY));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredCareKit(nextValue) {
  localStorage.setItem(CARE_KIT_STORAGE_KEY, JSON.stringify(nextValue));
}

function readStoredWelcome() {
  try {
    const parsed = JSON.parse(localStorage.getItem(WELCOME_STORAGE_KEY));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredWelcome(nextValue) {
  localStorage.setItem(WELCOME_STORAGE_KEY, JSON.stringify(nextValue));
}

function readStoredOnboardingPreferences() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ONBOARDING_PREFERENCES_STORAGE_KEY));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredOnboardingPreferences(nextValue) {
  localStorage.setItem(ONBOARDING_PREFERENCES_STORAGE_KEY, JSON.stringify(nextValue));
}

function readStoredAftercare() {
  try {
    const parsed = JSON.parse(localStorage.getItem(AFTERCARE_STORAGE_KEY));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredAftercare(nextValue) {
  localStorage.setItem(AFTERCARE_STORAGE_KEY, JSON.stringify(nextValue));
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDailyWisdom(emotion) {
  const theme = emotion?.wisdomTheme || "heavy";
  return DAILY_SANCTUARY_WISDOM[theme] || DAILY_SANCTUARY_WISDOM.heavy;
}

function getDailyActionSuggestion(emotion) {
  const idByTheme = {
    longing: "breathe",
    overthinking: "study-small",
    rejection: "message-safe",
    anxiety: "breathe",
    numb: "water",
    heavy: "walk",
    lost: "study-small"
  };
  const actionId = idByTheme[emotion?.wisdomTheme] || "breathe";
  return DAILY_SANCTUARY_ACTIONS.find((action) => action.id === actionId) || DAILY_SANCTUARY_ACTIONS[0];
}

function getCalmExercise(exerciseId) {
  return CALM_EXERCISES.find((exercise) => exercise.id === exerciseId) || CALM_EXERCISES[0];
}

function getPressureArea(areaId) {
  return PRESSURE_AREAS.find((area) => area.id === areaId) || PRESSURE_AREAS[0];
}

function getWelcomeReason(reasonId) {
  return WELCOME_REASONS.find((reason) => reason.id === reasonId) || null;
}

function getOnboardingArrival(arrivalId) {
  return ONBOARDING_ARRIVALS.find((arrival) => arrival.id === arrivalId) || null;
}

function getOnboardingSupportStyle(styleId) {
  return ONBOARDING_SUPPORT_STYLES.find((style) => style.id === styleId) || null;
}

function getOnboardingRecommendation(arrivalId, supportStyleId) {
  const arrival = getOnboardingArrival(arrivalId) || ONBOARDING_ARRIVALS[5];
  const supportStyle = getOnboardingSupportStyle(supportStyleId);
  const withBase = (value) => ({
    arrival,
    supportStyle,
    ...value
  });

  if (arrival.id === "texting") {
    return withBase({
      title: "Pause Before You Text",
      text: "The urge can be honest without becoming immediate action. Slow this moment before deciding.",
      href: "/pause"
    });
  }

  if (arrival.id === "exams") {
    return withBase({
      title: "Pressure Reset",
      text: "You named pressure around study, future, or expectations. Let's make it smaller.",
      href: "/pressure"
    });
  }

  if (arrival.id === "not-sure" || supportStyle?.id === "guide") {
    return withBase({
      title: "Daily Sanctuary",
      text: "Start with one feeling, one wisdom line, and one small action. That is enough.",
      href: "/today"
    });
  }

  if (supportStyle?.id === "calm") {
    return withBase({
      title: "Guided Calm",
      text: "Your body gets the first vote. Start with a reset before trying to explain everything.",
      href: "/calm"
    });
  }

  if (supportStyle?.id === "write") {
    return withBase({
      title: "Private Journal",
      text: "A quiet page can hold the first true sentence. No one is grading this.",
      href: "/journal",
      emotionId: arrival.emotionId || "not-sure"
    });
  }

  if (supportStyle?.id === "wisdom") {
    return withBase({
      title: "Talk to Wisdom",
      text: "Bring what feels heavy into a steadier, spiritual conversation.",
      href: "/wisdom"
    });
  }

  if (supportStyle?.id === "plan") {
    return withBase({
      title: "Care Kit",
      text: "Make one small support plan: who helps, where to go, and what steadies you.",
      href: "/care"
    });
  }

  if (arrival.id === "heartbreak") {
    return withBase({
      title: "Private Journal",
      text: "There are words in you that deserve a safe place without sending anything.",
      href: "/journal",
      emotionId: "miss-someone"
    });
  }

  if (arrival.id === "lonely") {
    return withBase({
      title: "Talk to Wisdom",
      text: "Loneliness needs warmth, not shame. Let the app answer softly first.",
      href: "/wisdom"
    });
  }

  if (arrival.id === "overwhelmed") {
    return withBase({
      title: "Guided Calm",
      text: "When everything is loud, your body deserves the first gentle room.",
      href: "/calm"
    });
  }

  return withBase({
    title: "Daily Sanctuary",
    text: "Start with one feeling, one wisdom line, and one small action. That is enough.",
    href: "/today"
  });
}

function getAftercareAction(actionId) {
  return AFTERCARE_ACTIONS.find((action) => action.id === actionId) || AFTERCARE_ACTIONS[0];
}

function getAftercareSuggestion({ source = "", emotionId = "", theme = "" } = {}) {
  const emotion = getEmotion(emotionId);
  const value = theme || emotion?.wisdomTheme || "";

  if (source === "calm") return getAftercareAction("journal");
  if (source === "daily" && value === "heavy") return getAftercareAction("care");
  if (value === "pressure") return getAftercareAction("pressure");
  if (value === "anxiety" || value === "overthinking") return getAftercareAction("calm");
  if (value === "longing" || emotionId === "miss-someone") return getAftercareAction("pause");
  if (value === "rejection" || emotionId === "rejected") return getAftercareAction("journey");
  if (value === "numb" || value === "heavy") return getAftercareAction("care");
  if (value === "lost") return getAftercareAction("wisdom");
  if (source === "daily") return getAftercareAction("wisdom");
  return getAftercareAction("museum");
}

function recordAftercareAction({ action, source = "", emotionId = "", theme = "" }) {
  const stored = readStoredAftercare();
  const nextEntry = {
    actionId: action.id,
    source,
    emotionId,
    theme,
    savedAt: new Date().toISOString()
  };
  const previousHistory = Array.isArray(stored.history) ? stored.history : [];
  const nextValue = {
    latest: nextEntry,
    history: [nextEntry, ...previousHistory].slice(0, 12)
  };
  saveStoredAftercare(nextValue);
  return nextValue;
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

function getLastJourneyProgress(storedJourneys) {
  const progress = HEALING_JOURNEYS.map((journey) => {
    const state = getJourneyState(storedJourneys || {}, journey);
    const latestEntry = [...state.entries].sort((a, b) => b.day - a.day)[0] || null;
    return { journey, state, latestEntry };
  }).filter(({ state }) => state.entries.length > 0 || state.currentDay > 1);

  return progress.sort((a, b) => b.state.currentDay - a.state.currentDay)[0] || null;
}

function getUnfinishedJourneyProgress(storedJourneys) {
  const lastJourney = getLastJourneyProgress(storedJourneys);
  if (!lastJourney) return null;
  const totalDays = lastJourney.journey.prompts.length;
  const hasFinishedAllDays = lastJourney.state.currentDay >= totalDays && lastJourney.state.entries.length >= totalDays;
  return hasFinishedAllDays ? null : lastJourney;
}

function getTextTheme(text) {
  const value = typeof text === "string" ? text.toLowerCase() : "";
  if (/(exam|study|marks|college|career|job|future|fail|failure|disappoint|family|parents)/.test(value)) return "pressure";
  if (/(miss|text|reply|message|come back|remember|profile|blocked|unblocked)/.test(value)) return "longing";
  if (/(reject|ignored|left|chosen|not enough|unwanted|replace)/.test(value)) return "rejection";
  if (/(panic|anxious|afraid|scared|what if|worry|worried)/.test(value)) return "anxiety";
  if (/(numb|empty|blank|nothing|hollow|can't feel)/.test(value)) return "numb";
  if (/(lost|purpose|direction|meaning|confused|who am i)/.test(value)) return "lost";
  return "";
}

function getReflectionCopy(emotion, journalText) {
  const theme = getTextTheme(journalText);
  const fallback = emotion?.reflection || "Something inside you needs gentleness right now.";

  const reflections = {
    pressure: "A big part of this is pressure: the fear of failing, disappointing people, or not becoming who you hoped you would be.",
    longing: "A part of you is still reaching for connection, and that can feel even louder when there is silence.",
    rejection: "This hurt is touching your self-worth, not just the event itself.",
    anxiety: "Your mind is trying to rehearse danger before it happens, and that can make the present feel unsafe.",
    numb: "Feeling numb can be the mind's quiet way of saying it has carried too much for too long.",
    lost: "Feeling lost does not mean you are failing; it means the old map is not enough anymore."
  };

  return reflections[theme] || fallback;
}

function getPreviewText(value, maxLength = 96) {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function getRoute() {
  const path = window.location.pathname;
  if (isKnownAppRoute(path)) return path;
  return "/check-in";
}

function navigate(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function SoftShell({ children }) {
  return (
    <div className="sacred-app-bg min-h-screen overflow-x-hidden px-4 pb-24 pt-5 text-slate-800 sm:px-6 sm:pb-8">
      <main className="sacred-page-enter mx-auto flex min-h-[calc(100vh-40px)] min-w-0 flex-col" style={{ width: "calc(100vw - 2rem)", maxWidth: "46rem" }}>
        <AppTopNav currentPath={window.location.pathname} onNavigate={navigate} />
        <div className="flex justify-end sm:hidden">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="rounded-2xl bg-white/74 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-white/80 transition hover:bg-white"
          >
            Home
          </button>
        </div>
        {children}
      </main>
      <AppBottomNav currentPath={window.location.pathname} onNavigate={navigate} />
    </div>
  );
}

function PageHeader({ eyebrow, title, children }) {
  return (
    <header className="pb-6 pt-4">
      {eyebrow && <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>}
      <h1 className="max-w-full break-words text-3xl font-semibold leading-tight tracking-normal text-slate-900 sm:text-4xl">{title}</h1>
      {children && <p className="mt-4 text-base leading-7 text-slate-600">{children}</p>}
    </header>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`sacred-card rounded-3xl ${className}`}>
      {children}
    </div>
  );
}

function Button({ children, variant = "primary", className = "", ...props }) {
  const variants = {
    primary: "bg-slate-900 text-white shadow-lg shadow-slate-400/25 hover:bg-slate-800",
    secondary: "bg-white/78 text-slate-800 ring-1 ring-slate-200 hover:bg-white",
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

function SafetyPanel({ className = "" }) {
  return (
    <div className={`rounded-3xl bg-white/65 p-4 text-sm leading-6 text-slate-600 shadow-sm ring-1 ring-white/70 ${className}`}>
      <p className="font-semibold text-slate-800">If this feels too heavy</p>
      <p className="mt-1">
        Pause, breathe, and reach out to one trusted person. If there is immediate danger, contact local emergency help now. This space is support for reflection, not medical care.
      </p>
      <Button variant="secondary" className="mt-3 w-full" onClick={() => navigate("/sos")}>Open SOS mode</Button>
    </div>
  );
}

function NextStepCard({ title, text, onClick, href, tone = "bg-white/75" }) {
  const className = `rounded-3xl ${tone} p-4 text-left shadow-[0_14px_35px_rgba(88,82,120,0.10)] ring-1 ring-white/75 transition duration-200 hover:-translate-y-0.5 hover:bg-white/90`;
  const content = (
    <>
      <p className="text-base font-semibold leading-snug text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </>
  );

  if (href) {
    return <a href={href} className={className}>{content}</a>;
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function AftercarePrompt({ source, emotion, text = "", title = "One gentle next step" }) {
  const [saved, setSaved] = useState(false);
  const theme = getTextTheme(text) || emotion?.wisdomTheme || "";
  const suggestion = getAftercareSuggestion({ source, emotionId: emotion?.id, theme });

  const rememberSuggestion = () => {
    recordAftercareAction({
      action: suggestion,
      source,
      emotionId: emotion?.id || "",
      theme
    });
    setSaved(true);
  };

  const takeSuggestion = () => {
    rememberSuggestion();
    navigate(suggestion.href);
  };

  return (
    <section className={`rounded-3xl ${suggestion.tone} p-5 shadow-[0_14px_35px_rgba(88,82,120,0.10)] ring-1 ring-white/75`}>
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Aftercare</p>
      <h2 className="mt-2 text-xl font-semibold leading-snug text-slate-900">{title}</h2>
      <p className="mt-3 text-base font-semibold text-slate-800">{suggestion.title}</p>
      <p className="mt-2 leading-7 text-slate-600">{suggestion.text}</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Button onClick={takeSuggestion}>Take this step</Button>
        <Button variant="quiet" onClick={rememberSuggestion}>Save as helpful</Button>
      </div>
      {saved && <p className="mt-3 text-sm font-semibold text-slate-600">Saved for your home hub.</p>}
    </section>
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
      className={`group min-h-32 rounded-3xl bg-gradient-to-br ${emotion.tone} p-5 text-left shadow-[0_14px_35px_rgba(88,82,120,0.12)] ring-1 ring-white/80 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(88,82,120,0.18)] focus:outline-none focus:ring-2 focus:ring-slate-400`}
    >
      <span className="block text-lg font-semibold leading-snug text-slate-900">{emotion.label}</span>
      <span className="mt-3 block text-sm leading-6 text-slate-600">{emotion.example}</span>
      <span className="mt-4 inline-flex rounded-full bg-white/60 px-3 py-1 text-xs font-semibold text-slate-600">Start here</span>
    </button>
  );
}

function CheckInScreen({ onSelect }) {
  return (
    <SoftShell>
      <PageHeader eyebrow="A gentle check-in" title="What are you carrying right now?">
        Choose the card that sounds closest. If nothing fits, pick "not sure" and we will begin softly.
      </PageHeader>
      <Card className="mb-4 p-4">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">No pressure</p>
        <p className="mt-2 leading-7 text-slate-700">This is not a test. You are only choosing a doorway into what you already feel.</p>
      </Card>
      <section className="grid flex-1 grid-cols-1 gap-4 pb-6 sm:grid-cols-2">
        {EMOTIONS.map((emotion) => (
          <EmotionCard key={emotion.id} emotion={emotion} onSelect={onSelect} />
        ))}
      </section>
      <div className="grid gap-3 mb-6">
        <Button variant="secondary" className="w-full" onClick={() => navigate("/wisdom")}>
          Talk - someone is here to listen
        </Button>
        <Button variant="quiet" className="w-full" onClick={() => navigate("/journeys")}>Explore Healing Journeys</Button>
        <Button variant="quiet" className="w-full" onClick={() => navigate("/museum")}>Visit Museum of Unsaid Things</Button>
      </div>
      <SafetyPanel className="mb-4" />
    </SoftShell>
  );
}

// ─── Calming card ─────────────────────────────────────────────────────────────

// First-time welcome

function OnboardingProgressDots({ step }) {
  return (
    <div className="mb-5 flex items-center gap-2" aria-label={`Step ${step + 1} of 3`}>
      {[0, 1, 2].map((item) => (
        <span
          key={item}
          className={`h-2 flex-1 rounded-full transition ${item <= step ? "bg-slate-900" : "bg-white/70"}`}
        />
      ))}
    </div>
  );
}

function OnboardingOptionCard({ title, text, selected, tone = "from-white to-white", onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl bg-gradient-to-br ${tone} p-5 text-left shadow-[0_14px_35px_rgba(88,82,120,0.12)] ring-1 transition duration-200 hover:-translate-y-0.5 hover:bg-white ${
        selected ? "ring-2 ring-slate-800" : "ring-white/80"
      }`}
      aria-pressed={selected}
    >
      <p className="text-xl font-semibold leading-snug text-slate-900">{title}</p>
      <p className="mt-2 leading-7 text-slate-600">{text}</p>
      <p className="mt-4 inline-flex rounded-2xl bg-white/65 px-4 py-2 text-sm font-semibold leading-6 text-slate-600">
        {selected ? "Selected" : "Choose"}
      </p>
    </button>
  );
}

function OnboardingEscapeLink() {
  return (
    <Button variant="quiet" className="mt-4 w-full" onClick={() => navigate("/sos")}>
      I need help now
    </Button>
  );
}

function OnboardingDoorwayCard({ recommendation, onStart, onBack }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Your doorway</p>
      <h2 className="mt-3 text-3xl font-semibold leading-tight text-slate-900">{recommendation.title}</h2>
      <p className="mt-3 leading-7 text-slate-600">{recommendation.text}</p>
      <div className="mt-5 rounded-2xl bg-white/65 p-4">
        <p className="text-sm font-semibold text-slate-500">Based on</p>
        <p className="mt-1 font-semibold leading-6 text-slate-800">
          {recommendation.arrival.label}
          {recommendation.supportStyle ? ` + ${recommendation.supportStyle.label}` : ""}
        </p>
      </div>
      <div className="mt-5 grid gap-3">
        <Button onClick={onStart}>Enter this room</Button>
        <Button variant="secondary" onClick={onBack}>Change my answers</Button>
      </div>
    </Card>
  );
}

function WelcomeScreen({ onStartReason }) {
  const storedPreferences = readStoredOnboardingPreferences();
  const storedWelcome = readStoredWelcome();
  const lastReason = getWelcomeReason(storedWelcome.reasonId);
  const [step, setStep] = useState(0);
  const [arrivalId, setArrivalId] = useState(storedPreferences.arrivalId || "");
  const [supportStyleId, setSupportStyleId] = useState(storedPreferences.supportStyleId || "");
  const selectedArrival = getOnboardingArrival(arrivalId);
  const selectedSupportStyle = getOnboardingSupportStyle(supportStyleId);
  const recommendation = getOnboardingRecommendation(arrivalId, supportStyleId);

  const chooseArrival = (arrival) => {
    setArrivalId(arrival.id);
    setStep(1);
  };

  const chooseSupportStyle = (style) => {
    setSupportStyleId(style.id);
    setStep(2);
  };

  const startRecommendation = () => {
    onStartReason(recommendation);
  };

  return (
    <SoftShell>
      <PageHeader eyebrow="Guided Start" title={step === 0 ? "What kind of day is this?" : step === 1 ? "What would feel easiest right now?" : "Start with this room."}>
        {step === 0 && "Choose the closest truth. You do not have to explain the whole story."}
        {step === 1 && "Pick the kind of support your body and mind can actually receive today."}
        {step === 2 && "This is a gentle recommendation, not a rule. You can always choose another room later."}
      </PageHeader>
      <OnboardingProgressDots step={step} />

      {step === 0 && (storedPreferences.completedAt || lastReason) && (
        <Card className="mb-4 p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Last time</p>
          <h2 className="mt-2 text-xl font-semibold leading-snug text-slate-900">
            {storedPreferences.completedAt ? "You already found a starting point." : lastReason.label}
          </h2>
          <p className="mt-2 leading-7 text-slate-600">
            {storedPreferences.completedAt ? "You can start like last time, or choose again for today." : "You can choose it again, or start somewhere new."}
          </p>
          {storedPreferences.recommendedRoute && (
            <Button className="mt-4 w-full" onClick={() => onStartReason(getOnboardingRecommendation(storedPreferences.arrivalId, storedPreferences.supportStyleId))}>Start like last time</Button>
          )}
        </Card>
      )}

      {step === 0 && (
        <section className="grid gap-4 pb-6 sm:grid-cols-2">
          {ONBOARDING_ARRIVALS.map((arrival) => (
            <OnboardingOptionCard
              key={arrival.id}
              title={arrival.label}
              text={arrival.text}
              tone={arrival.tone}
              selected={arrival.id === arrivalId}
              onClick={() => chooseArrival(arrival)}
            />
          ))}
        </section>
      )}

      {step === 1 && (
        <>
          <Card className="mb-4 p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">You chose</p>
            <p className="mt-2 text-xl font-semibold leading-snug text-slate-900">{selectedArrival?.label || "This moment"}</p>
            <p className="mt-2 leading-7 text-slate-600">{selectedArrival?.text || "We will keep this gentle."}</p>
          </Card>
          <section className="grid gap-4 pb-6">
            {ONBOARDING_SUPPORT_STYLES.map((style) => (
              <OnboardingOptionCard
                key={style.id}
                title={style.label}
                text={style.text}
                selected={style.id === supportStyleId}
                onClick={() => chooseSupportStyle(style)}
              />
            ))}
          </section>
          <Button variant="quiet" className="mb-3 w-full" onClick={() => setStep(0)}>Back</Button>
        </>
      )}

      {step === 2 && (
        <div className="grid gap-4 pb-6">
          <OnboardingDoorwayCard
            recommendation={recommendation}
            onStart={startRecommendation}
            onBack={() => setStep(0)}
          />
        </div>
      )}

      <OnboardingEscapeLink />
      <SafetyPanel className="mb-4" />
    </SoftShell>
  );
}

function CalmExerciseCard({ exercise, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(exercise.id)}
      className="rounded-3xl bg-white/75 p-5 text-left shadow-[0_14px_35px_rgba(88,82,120,0.12)] ring-1 ring-white/75 transition duration-200 hover:-translate-y-0.5 hover:bg-white"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Guided calm</p>
      <h2 className="mt-3 text-xl font-semibold leading-snug text-slate-900">{exercise.title}</h2>
      <p className="mt-2 leading-7 text-slate-600">{exercise.text}</p>
      {exercise.duration && <p className="mt-4 rounded-2xl bg-slate-50/80 px-4 py-2 text-sm font-semibold text-slate-500">{exercise.duration} seconds</p>}
    </button>
  );
}

function CalmTimer({ secondsLeft, duration, label, children }) {
  const progress = Math.max(0, Math.min(100, Math.round(((duration - secondsLeft) / duration) * 100)));
  return (
    <Card className="p-5 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <div className="mx-auto my-6 grid h-40 w-40 place-items-center rounded-full bg-gradient-to-br from-blue-100 via-violet-100 to-rose-100 shadow-inner">
        <span className="text-4xl font-semibold tabular-nums text-slate-800">{formatTime(secondsLeft)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/75">
        <div className="h-full rounded-full bg-slate-800 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      {children}
    </Card>
  );
}

function BreathingExercise({ onComplete }) {
  const duration = 60;
  const [secondsLeft, setSecondsLeft] = useState(duration);

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const id = setInterval(() => setSecondsLeft((value) => Math.max(value - 1, 0)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const elapsed = duration - secondsLeft;
  const phaseSecond = elapsed % 12;
  const phase = phaseSecond < 4 ? "Inhale" : phaseSecond < 6 ? "Hold" : "Exhale";

  return (
    <>
      <CalmTimer secondsLeft={secondsLeft} duration={duration} label="One-minute breathing">
        <div className="mt-6">
          <p className="text-3xl font-semibold text-slate-900">{phase}</p>
          <p className="mt-2 leading-7 text-slate-600">Let the breath be slow. Nothing has to be solved while you do this.</p>
        </div>
      </CalmTimer>
      <div className="mt-5 grid gap-3">
        <Button onClick={() => onComplete("breathing")}>{secondsLeft <= 0 ? "Complete" : "Finish when ready"}</Button>
      </div>
    </>
  );
}

function GroundingExercise({ onComplete }) {
  const [stepIndex, setStepIndex] = useState(0);
  const isLastStep = stepIndex >= GROUNDING_STEPS.length - 1;

  return (
    <Card className="p-5">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">5-4-3-2-1 grounding</p>
      <div className="mt-5 rounded-3xl bg-white/60 p-5">
        <p className="text-sm font-semibold text-slate-500">Step {stepIndex + 1} of {GROUNDING_STEPS.length}</p>
        <p className="mt-3 text-2xl font-semibold leading-9 text-slate-900">{GROUNDING_STEPS[stepIndex]}</p>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/75">
        <div className="h-full rounded-full bg-slate-800 transition-all duration-500" style={{ width: `${((stepIndex + 1) / GROUNDING_STEPS.length) * 100}%` }} />
      </div>
      <div className="mt-5 grid gap-3">
        <Button onClick={() => (isLastStep ? onComplete("grounding") : setStepIndex((value) => value + 1))}>
          {isLastStep ? "Complete" : "Next step"}
        </Button>
      </div>
    </Card>
  );
}

function UnclenchExercise({ onComplete }) {
  const duration = 90;
  const [secondsLeft, setSecondsLeft] = useState(duration);

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const id = setInterval(() => setSecondsLeft((value) => Math.max(value - 1, 0)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const elapsed = duration - secondsLeft;
  const stepIndex = Math.min(UNCLENCH_STEPS.length - 1, Math.floor((elapsed / duration) * UNCLENCH_STEPS.length));

  return (
    <>
      <CalmTimer secondsLeft={secondsLeft} duration={duration} label="Unclench reset">
        <p className="mt-6 text-2xl font-semibold leading-9 text-slate-900">{UNCLENCH_STEPS[stepIndex]}</p>
        <p className="mt-2 leading-7 text-slate-600">You can stop whenever your body has had enough.</p>
      </CalmTimer>
      <div className="mt-5 grid gap-3">
        <Button onClick={() => onComplete("unclench")}>{secondsLeft <= 0 ? "Complete" : "Finish when ready"}</Button>
      </div>
    </>
  );
}

function KindVoiceExercise({ onComplete }) {
  const [scriptId, setScriptId] = useState(KIND_VOICE_SCRIPTS[0].id);
  const script = KIND_VOICE_SCRIPTS.find((item) => item.id === scriptId) || KIND_VOICE_SCRIPTS[0];

  return (
    <Card className="p-5">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Kind voice</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {KIND_VOICE_SCRIPTS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setScriptId(item.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${item.id === scriptId ? "bg-slate-900 text-white" : "bg-white/70 text-slate-600 hover:bg-white"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-5 rounded-3xl bg-white/60 p-5">
        <p className="text-2xl font-semibold leading-9 text-slate-900">{script.text}</p>
        <p className="mt-4 leading-7 text-slate-600">Read it slowly. If one word feels false, let the next one be enough.</p>
      </div>
      <Button className="mt-5 w-full" onClick={() => onComplete("kind-voice")}>Complete</Button>
    </Card>
  );
}

function CalmExerciseRunner({ exerciseId, onComplete }) {
  if (exerciseId === "grounding") return <GroundingExercise onComplete={onComplete} />;
  if (exerciseId === "unclench") return <UnclenchExercise onComplete={onComplete} />;
  if (exerciseId === "kind-voice") return <KindVoiceExercise onComplete={onComplete} />;
  return <BreathingExercise onComplete={onComplete} />;
}

function GuidedCalmRoom() {
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [completedExerciseId, setCompletedExerciseId] = useState("");
  const [history, setHistory] = useState(readStoredGuidedCalm);
  const selectedExercise = selectedExerciseId ? getCalmExercise(selectedExerciseId) : null;

  const completeExercise = (exerciseId) => {
    const nextHistory = {
      completedCount: Number(history.completedCount || 0) + 1,
      latestExerciseId: exerciseId,
      latestCompletedAt: new Date().toISOString()
    };
    saveStoredGuidedCalm(nextHistory);
    setHistory(nextHistory);
    setCompletedExerciseId(exerciseId);
  };

  if (completedExerciseId) {
    const exercise = getCalmExercise(completedExerciseId);
    return (
      <SoftShell>
        <PageHeader eyebrow="Guided Calm" title="Your body listened. That matters.">
          You completed {exercise.title.toLowerCase()}. No streak. No score. Just a little more room inside.
        </PageHeader>
        <Card className="p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Saved locally</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{exercise.title}</p>
          <p className="mt-2 leading-7 text-slate-600">Completed calm sessions on this device: {history.completedCount || 1}</p>
        </Card>
        <AftercarePrompt source="calm" title="Now choose one small next step." />
        <div className="mt-5 grid gap-3">
          <NextStepCard title="Write now" text="Use this quieter moment to name what is here." onClick={() => navigate("/journal")} />
          <NextStepCard title="Talk to Wisdom" text="Receive a calmer reflection if your heart still feels full." onClick={() => navigate("/wisdom")} />
          <Button variant="quiet" onClick={() => navigate("/")}>Return home</Button>
        </div>
        <SafetyPanel className="mt-5" />
      </SoftShell>
    );
  }

  if (selectedExercise) {
    return (
      <SoftShell>
        <PageHeader eyebrow="Guided Calm" title={selectedExercise.title}>
          {selectedExercise.text}
        </PageHeader>
        <CalmExerciseRunner exerciseId={selectedExercise.id} onComplete={completeExercise} />
        <div className="mt-5 grid gap-3">
          <Button variant="quiet" onClick={() => setSelectedExerciseId("")}>Choose another exercise</Button>
        </div>
      </SoftShell>
    );
  }

  return (
    <SoftShell>
      <PageHeader eyebrow="Guided Calm" title="Let your body feel safe for a moment.">
        Choose one small exercise. You do not have to be calm before you begin.
      </PageHeader>
      {history.latestExerciseId && (
        <Card className="mb-4 p-4">
          <p className="text-sm font-semibold text-slate-500">Last calm</p>
          <p className="mt-1 font-semibold text-slate-800">{getCalmExercise(history.latestExerciseId).title}</p>
        </Card>
      )}
      <section className="grid gap-4">
        {CALM_EXERCISES.map((exercise) => (
          <CalmExerciseCard key={exercise.id} exercise={exercise} onSelect={setSelectedExerciseId} />
        ))}
      </section>
      <SafetyPanel className="my-5" />
    </SoftShell>
  );
}

// ─── Journal ──────────────────────────────────────────────────────────────────

// SOS Mode

function SOSModeScreen() {
  const [stepIndex, setStepIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const currentStep = SOS_STEPS[stepIndex];
  const progress = Math.round(((stepIndex + 1) / SOS_STEPS.length) * 100);
  const isLastStep = stepIndex >= SOS_STEPS.length - 1;

  const continueStep = () => {
    if (isLastStep) {
      setFinished(true);
      return;
    }
    setStepIndex((value) => value + 1);
  };

  if (finished) {
    return (
      <SoftShell>
        <PageHeader eyebrow="SOS Mode" title="You made it through this minute.">
          Let that count. You do not have to become okay all at once.
        </PageHeader>

        <Card className="p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Right now</p>
          <h2 className="mt-3 text-2xl font-semibold leading-snug text-slate-900">Choose the gentlest next room.</h2>
          <p className="mt-2 leading-7 text-slate-600">If the danger is immediate, contact local emergency help now or move near a trusted person.</p>
        </Card>

        <div className="mt-5 grid gap-3">
          <NextStepCard title="Calm my body" text="Stay body-first with breathing, grounding, or a kind voice." onClick={() => navigate("/calm")} tone="bg-blue-50/90" />
          <NextStepCard title="Write one line" text="Use a private journal if words are starting to return." onClick={() => navigate("/journal")} />
          <NextStepCard title="Open Care Kit" text="Return to the people, places, and words that help you stay safe." onClick={() => navigate("/care")} />
          <NextStepCard title="Talk to Wisdom" text="Receive a quiet response if you need steady words." onClick={() => navigate("/wisdom")} />
          <Button variant="quiet" onClick={() => navigate("/")}>Return home</Button>
        </div>
      </SoftShell>
    );
  }

  return (
    <SoftShell>
      <PageHeader eyebrow="SOS Mode" title="Stay with this minute.">
        For intense moments when even writing feels too much. Do these steps slowly. This is support for pausing, not medical care.
      </PageHeader>

      <div className="rounded-3xl bg-rose-50/90 p-4 text-sm leading-6 text-rose-800 shadow-sm ring-1 ring-rose-100">
        <p className="font-semibold">If there is immediate danger</p>
        <p className="mt-1">Contact local emergency help now. If you can, move near another person or call someone trusted.</p>
      </div>

      <Card className="mt-5 p-5">
        <div className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-500">
          <span>Step {stepIndex + 1} of {SOS_STEPS.length}</span>
          <span>{progress}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/75">
          <div className="h-full rounded-full bg-slate-900 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <div className="my-7 grid place-items-center">
          <div className="grid h-36 w-36 animate-[sosPulse_5s_ease-in-out_infinite] place-items-center rounded-full bg-gradient-to-br from-blue-100 via-violet-100 to-rose-100 shadow-inner ring-1 ring-white/80">
            <span className="text-5xl font-semibold text-slate-700">{stepIndex + 1}</span>
          </div>
        </div>

        <h2 className="text-3xl font-semibold leading-tight text-slate-900">{currentStep.title}</h2>
        <p className="mt-4 text-lg leading-8 text-slate-700">{currentStep.text}</p>
        <Button className="mt-6 w-full" onClick={continueStep}>{isLastStep ? "I am here for this minute" : "Next step"}</Button>
      </Card>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NextStepCard title="Calm room" text="Try a longer body reset." onClick={() => navigate("/calm")} />
        <NextStepCard title="Pause texting" text="Slow down an urgent message." onClick={() => navigate("/pause")} />
      </div>

      <style>{`
        @keyframes sosPulse {
          0%, 100% { transform: scale(0.95); opacity: 0.82; }
          50% { transform: scale(1.05); opacity: 1; }
        }
      `}</style>
    </SoftShell>
  );
}

function PressureAreaCard({ area, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(area.id)}
      className={`rounded-3xl p-4 text-left ring-1 transition duration-200 ${
        selected
          ? "bg-slate-900 text-white ring-slate-900 shadow-lg shadow-slate-300/30"
          : "bg-white/75 text-slate-800 ring-white/80 hover:-translate-y-0.5 hover:bg-white"
      }`}
    >
      <p className="font-semibold leading-snug">{area.label}</p>
      <p className={`mt-2 text-sm leading-6 ${selected ? "text-slate-200" : "text-slate-600"}`}>{area.text}</p>
    </button>
  );
}

function CareKitField({ prompt, value, onChange }) {
  return (
    <div className="rounded-3xl bg-white/65 p-4 ring-1 ring-white/80">
      <label className="block text-sm font-semibold text-slate-600" htmlFor={`care-${prompt.id}`}>{prompt.label}</label>
      <input
        id={`care-${prompt.id}`}
        value={value}
        onChange={(event) => onChange(prompt.id, event.target.value)}
        placeholder={prompt.placeholder}
        className="mt-3 h-12 w-full rounded-2xl bg-white/75 px-4 text-base text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-200"
      />
      <p className="mt-2 text-sm leading-6 text-slate-500">{prompt.helper}</p>
    </div>
  );
}

function CareKitScreen() {
  const [kit, setKit] = useState(readStoredCareKit);
  const [draft, setDraft] = useState({
    person: kit.person || "",
    place: kit.place || "",
    action: kit.action || "",
    reminder: kit.reminder || ""
  });
  const [saved, setSaved] = useState(false);
  const hasKit = Boolean(kit.person || kit.place || kit.action || kit.reminder);
  const showPrivacyWarning = hasContactDetails(Object.values(draft).join(" "));

  const updateDraft = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const saveCareKit = () => {
    const nextKit = {
      person: draft.person.trim(),
      place: draft.place.trim(),
      action: draft.action.trim(),
      reminder: draft.reminder.trim(),
      updatedAt: new Date().toISOString()
    };
    saveStoredCareKit(nextKit);
    setKit(nextKit);
    setDraft(nextKit);
    setSaved(true);
  };

  return (
    <SoftShell>
      <PageHeader eyebrow="Care Kit" title="Keep your safe things close.">
        Build a small local kit for hard moments: who helps, where you can go, what action steadies you, and what words you need.
      </PageHeader>

      {hasKit && (
        <Card className="mb-4 p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Your saved kit</p>
          <div className="mt-4 grid gap-3">
            {kit.person && <p className="rounded-2xl bg-white/60 p-3 text-sm leading-6 text-slate-700"><span className="font-semibold">Person:</span> {kit.person}</p>}
            {kit.place && <p className="rounded-2xl bg-white/60 p-3 text-sm leading-6 text-slate-700"><span className="font-semibold">Place:</span> {kit.place}</p>}
            {kit.action && <p className="rounded-2xl bg-white/60 p-3 text-sm leading-6 text-slate-700"><span className="font-semibold">Action:</span> {kit.action}</p>}
            {kit.reminder && <p className="rounded-2xl bg-white/60 p-3 text-sm leading-6 text-slate-700"><span className="font-semibold">Reminder:</span> {kit.reminder}</p>}
          </div>
        </Card>
      )}

      <Card className="p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Make it personal</p>
        <h2 className="mt-2 text-2xl font-semibold leading-snug text-slate-900">What helps you return to yourself?</h2>
        <div className="mt-5 grid gap-4">
          {CARE_KIT_PROMPTS.map((prompt) => (
            <CareKitField key={prompt.id} prompt={prompt} value={draft[prompt.id] || ""} onChange={updateDraft} />
          ))}
        </div>
      </Card>

      {showPrivacyWarning && (
        <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-700">
          For privacy, avoid saving phone numbers, emails, or anything that identifies someone too clearly.
        </div>
      )}

      <Card className="mt-5 p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">If you are blank</p>
        <div className="mt-3 grid gap-2">
          {CARE_KIT_IDEAS.map((idea) => (
            <button
              key={idea}
              type="button"
              onClick={() => updateDraft("action", idea)}
              className="rounded-2xl bg-white/65 px-4 py-3 text-left text-sm font-semibold leading-6 text-slate-700 transition hover:bg-white"
            >
              {idea}
            </button>
          ))}
        </div>
      </Card>

      {saved && (
        <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm">
          Saved to this device. Your kit is ready when the moment gets loud.
        </div>
      )}

      <div className="grid gap-3 py-6">
        <Button onClick={saveCareKit} disabled={!Object.values(draft).some((value) => value.trim())}>Save Care Kit</Button>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button variant="secondary" onClick={() => navigate("/sos")}>Open SOS mode</Button>
          <Button variant="secondary" onClick={() => navigate("/calm")}>Calm my body</Button>
        </div>
      </div>
      <SafetyPanel className="mb-4" />
    </SoftShell>
  );
}

function PressureResetScreen() {
  const [storedPressure, setStoredPressure] = useState(readStoredPressureReset);
  const latest = storedPressure.latest || null;
  const [areaId, setAreaId] = useState(latest?.areaId || "exams");
  const [worry, setWorry] = useState("");
  const [savedEntry, setSavedEntry] = useState(null);
  const selectedArea = getPressureArea(areaId);
  const history = Array.isArray(storedPressure.history) ? storedPressure.history : [];

  const savePressureReset = () => {
    const cleanWorry = worry.trim();
    if (!cleanWorry) return;
    const entry = {
      id: `pressure-${Date.now()}`,
      areaId,
      worry: cleanWorry,
      reframe: selectedArea.reframe,
      action: selectedArea.action,
      savedAt: new Date().toISOString()
    };
    const nextValue = {
      latest: entry,
      history: [entry, ...history].slice(0, 12)
    };
    saveStoredPressureReset(nextValue);
    setStoredPressure(nextValue);
    setSavedEntry(entry);
    setWorry("");
  };

  return (
    <SoftShell>
      <PageHeader eyebrow="Pressure Reset" title="Make the pressure smaller.">
        For exams, family expectations, comparison, career worry, money stress, and future fear. We will turn the big cloud into one next step.
      </PageHeader>

      {latest && !savedEntry && (
        <Card className="mb-4 p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Last reset</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">{getPressureArea(latest.areaId).label}</h2>
          <p className="mt-2 leading-7 text-slate-600">{getPreviewText(latest.worry, 130)}</p>
        </Card>
      )}

      <section className="grid gap-4">
        <Card className="p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">01 Name it</p>
          <h2 className="mt-2 text-2xl font-semibold leading-snug text-slate-900">What kind of pressure is loudest?</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {PRESSURE_AREAS.map((area) => (
              <PressureAreaCard key={area.id} area={area} selected={area.id === areaId} onSelect={setAreaId} />
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">02 Empty the mind</p>
          <label className="mt-3 block text-sm font-semibold text-slate-600" htmlFor="pressure-worry">Write the worry in one messy paragraph</label>
          <textarea
            id="pressure-worry"
            value={worry}
            onChange={(event) => setWorry(event.target.value)}
            placeholder="I am scared that..."
            className="mt-3 min-h-[200px] w-full resize-none rounded-2xl bg-white/65 p-4 text-base leading-8 text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-200"
          />
          <p className="mt-3 text-sm text-slate-500">{worry.length} characters. One honest line is enough.</p>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">03 Return to one step</p>
          <h2 className="mt-3 text-xl font-semibold leading-8 text-slate-900">{selectedArea.reframe}</h2>
          <div className="mt-4 rounded-2xl bg-white/65 p-4">
            <p className="text-sm font-semibold text-slate-500">One action for today</p>
            <p className="mt-2 leading-7 text-slate-700">{selectedArea.action}</p>
          </div>
        </Card>
      </section>

      {savedEntry && (
        <Card className="mt-5 p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">Saved locally</p>
          <h2 className="mt-2 text-2xl font-semibold leading-snug text-slate-900">Pressure is still real, but it is smaller now.</h2>
          <p className="mt-3 leading-7 text-slate-600">{savedEntry.action}</p>
        </Card>
      )}

      <div className="grid gap-3 py-6">
        <Button onClick={savePressureReset} disabled={!worry.trim()}>Save my reset</Button>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button variant="secondary" onClick={() => navigate("/calm")}>Calm my body</Button>
          <Button variant="secondary" onClick={() => navigate("/today")}>Daily Sanctuary</Button>
        </div>
      </div>
      <SafetyPanel className="mb-4" />
    </SoftShell>
  );
}

function JournalScreen({ emotion, draftText, onTextChange, onSave }) {
  const title = emotion ? `Let's sit with ${emotion.shortLabel.toLowerCase()}.` : "Let's write softly.";
  const prompt = emotion?.prompt || "Write what is present right now.";

  return (
    <SoftShell>
      <PageHeader eyebrow="Let it out" title={title}>
        I will not rush you. Start with the line that feels most true.
      </PageHeader>
      <Card className="mb-4 p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Your prompt</p>
        <p className="mt-3 text-xl font-semibold leading-8 text-slate-900">{prompt}</p>
      </Card>
      <Card className="p-4">
        <textarea
          value={draftText}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder="You can write messy. You can write slowly. No one is grading this."
          className="min-h-[290px] w-full resize-none rounded-2xl bg-white/65 p-4 text-base leading-8 text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-200"
        />
        <div className="mt-3 flex items-center justify-between px-1 text-sm text-slate-500">
          <span>{draftText.length} characters</span>
          <span>No one else sees this.</span>
        </div>
      </Card>

      <div className="mt-auto grid gap-3 py-6">
        <Button onClick={onSave} disabled={!draftText.trim()}>Save & Continue</Button>
        <Button variant="secondary" onClick={() => navigate("/calm")}>I need help calming down</Button>
        <Button variant="quiet" onClick={() => navigate("/check-in")}>Choose a different feeling</Button>
      </div>
    </SoftShell>
  );
}

// ─── Reflection ───────────────────────────────────────────────────────────────

function ReflectionMessage({ emotion, journalText }) {
  const reflection = getReflectionCopy(emotion, journalText);
  return (
    <Card className="p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">A reflection</p>
      <div className="mt-4 space-y-4 text-lg leading-8 text-slate-700">
        <p>{reflection}</p>
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
        <ReflectionMessage emotion={emotion} journalText={journalText} />
        <WisdomFromScripture emotion={emotion} />
        <AftercarePrompt source="reflection" emotion={emotion} text={journalText} />
      </div>

      {saved && (
        <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm">
          Saved. Let this be enough for now.
        </div>
      )}

      <div className="mt-6 grid gap-3">
        <NextStepCard
          title="Talk to Wisdom"
          text="Share a little more and receive a calmer response."
          onClick={() => navigate("/wisdom")}
          tone="bg-violet-50/90"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <NextStepCard title="Calm my body" text="Take one soft breathing pause." onClick={() => navigate("/calm")} />
          <NextStepCard title="Start a journey" text="Turn this into a 7-day healing path." onClick={() => navigate("/journeys")} />
        </div>
        {(emotion?.id === "miss-someone" || emotion?.id === "rejected") && (
          <Button variant="secondary" onClick={() => navigate("/pause")}>I feel like texting them</Button>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="quiet" onClick={onWriteMore}>Write more</Button>
          <Button variant="quiet" onClick={saveReflection}>Save this</Button>
        </div>
      </div>
      <SafetyPanel className="mb-4" />

      <div className="hidden">
        <Button onClick={onWriteMore}>Write more</Button>
        <Button variant="secondary" onClick={() => navigate("/wisdom")}>Talk — someone is here to listen</Button>
        <Button variant="secondary" onClick={() => navigate("/calm")}>Start calming exercise</Button>
        <Button variant="secondary" onClick={() => navigate("/pause")}>I feel like texting them</Button>
        <Button variant="secondary" onClick={() => navigate("/journeys")}>Explore Healing Journeys</Button>
        <Button variant="secondary" onClick={() => navigate("/museum")}>Visit Museum of Unsaid Things</Button>
        <Button variant="quiet" onClick={saveReflection}>Save this</Button>
      </div>
    </SoftShell>
  );
}

// ─── Pause Before You Text ────────────────────────────────────────────────────

// Daily Sanctuary

function DailyEmotionButton({ emotion, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(emotion.id)}
      className={`rounded-3xl p-4 text-left shadow-[0_12px_30px_rgba(88,82,120,0.10)] ring-1 transition ${
        selected ? "bg-slate-900 text-white ring-slate-900" : `bg-gradient-to-br ${emotion.tone} text-slate-900 ring-white/80 hover:-translate-y-0.5`
      }`}
    >
      <p className="font-semibold leading-snug">{emotion.shortLabel}</p>
      <p className={`mt-2 text-sm leading-6 ${selected ? "text-slate-200" : "text-slate-600"}`}>{emotion.example}</p>
    </button>
  );
}

function DailyActionButton({ action, selected, suggested, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(action.id)}
      className={`rounded-3xl p-4 text-left ring-1 transition ${
        selected ? "bg-slate-900 text-white ring-slate-900" : "bg-white/70 text-slate-800 ring-white/80 hover:bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold leading-snug">{action.label}</p>
        {suggested && <span className={`rounded-full px-3 py-1 text-xs font-semibold ${selected ? "bg-white/10 text-slate-100" : "bg-violet-50 text-violet-700"}`}>Suggested</span>}
      </div>
      <p className={`mt-2 text-sm leading-6 ${selected ? "text-slate-200" : "text-slate-600"}`}>{action.text}</p>
    </button>
  );
}

function DailySanctuaryScreen() {
  const todayKey = getLocalDateKey();
  const [storedDaily, setStoredDaily] = useState(readStoredDailySanctuary);
  const todaysEntry = storedDaily[todayKey] || null;
  const [emotionId, setEmotionId] = useState(todaysEntry?.emotionId || "not-sure");
  const [note, setNote] = useState(todaysEntry?.note || "");
  const selectedEmotion = getEmotion(emotionId) || getEmotion("not-sure") || EMOTIONS[0];
  const suggestedAction = getDailyActionSuggestion(selectedEmotion);
  const [actionId, setActionId] = useState(todaysEntry?.action || suggestedAction.id);
  const selectedAction = DAILY_SANCTUARY_ACTIONS.find((action) => action.id === actionId) || suggestedAction;
  const completed = Boolean(todaysEntry);

  useEffect(() => {
    if (!todaysEntry) setActionId(getDailyActionSuggestion(selectedEmotion).id);
  }, [emotionId]);

  const saveToday = () => {
    const nextEntry = {
      date: todayKey,
      emotionId,
      note: note.trim(),
      action: actionId,
      savedAt: new Date().toISOString()
    };
    const nextDaily = { ...storedDaily, [todayKey]: nextEntry };
    saveStoredDailySanctuary(nextDaily);
    setStoredDaily(nextDaily);
  };

  if (completed) {
    const entryEmotion = getEmotion(todaysEntry.emotionId) || selectedEmotion;
    const entryAction = DAILY_SANCTUARY_ACTIONS.find((action) => action.id === todaysEntry.action) || selectedAction;
    return (
      <SoftShell>
        <PageHeader eyebrow="Daily Sanctuary" title="You showed up today. That is enough.">
          No streak. No score. Just one small moment of care saved for {todayKey}.
        </PageHeader>
        <Card className="p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Today you named</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">{entryEmotion.label}</h2>
          {todaysEntry.note && <p className="mt-4 whitespace-pre-wrap leading-7 text-slate-700">{todaysEntry.note}</p>}
          <div className="mt-5 rounded-2xl bg-white/60 p-4">
            <p className="text-sm font-semibold text-slate-500">One action</p>
            <p className="mt-1 font-semibold text-slate-800">{entryAction.label}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{entryAction.text}</p>
          </div>
        </Card>
        <AftercarePrompt source="daily" emotion={entryEmotion} text={todaysEntry.note || ""} title="What would care look like after this?" />
        <div className="mt-5 grid gap-3">
          <NextStepCard title="Talk to Wisdom" text="Share more if your heart still feels full." onClick={() => navigate("/wisdom")} />
          <NextStepCard title="Calm my body" text="Take one short body-first reset." onClick={() => navigate("/calm")} />
          <NextStepCard title="Start a Journey" text="Take this slowly across seven days." onClick={() => navigate("/journeys")} />
          <NextStepCard title="Visit the Museum" text="Read what others never sent." onClick={() => navigate("/museum")} />
        </div>
        <SafetyPanel className="mt-5" />
      </SoftShell>
    );
  }

  return (
    <SoftShell>
      <PageHeader eyebrow="Daily Sanctuary" title="A small ritual for today.">
        Name what is here, receive one calm line, then choose one small action. No pressure to be better instantly.
      </PageHeader>

      <section className="grid gap-4">
        <Card className="p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">01 Arrive</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">How are you arriving today?</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {EMOTIONS.map((emotion) => (
              <DailyEmotionButton key={emotion.id} emotion={emotion} selected={emotion.id === emotionId} onSelect={setEmotionId} />
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">02 Receive</p>
          <p className="mt-3 text-xl font-semibold leading-8 text-slate-900">{getDailyWisdom(selectedEmotion)}</p>
          <p className="mt-3 leading-7 text-slate-600">Let this be enough wisdom for the next small step.</p>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">03 Release</p>
          <label className="mt-3 block text-sm font-semibold text-slate-600" htmlFor="daily-note">One note for today</label>
          <textarea
            id="daily-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Today I am carrying..."
            className="mt-3 min-h-[180px] w-full resize-none rounded-2xl bg-white/65 p-4 text-base leading-8 text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-200"
          />
          <p className="mt-5 text-sm font-semibold text-slate-500">Choose one small action</p>
          <div className="mt-3 grid gap-3">
            {DAILY_SANCTUARY_ACTIONS.map((action) => (
              <DailyActionButton
                key={action.id}
                action={action}
                selected={action.id === actionId}
                suggested={action.id === suggestedAction.id}
                onSelect={setActionId}
              />
            ))}
          </div>
        </Card>
      </section>

      <div className="grid gap-3 py-6">
        <Button onClick={saveToday} disabled={!note.trim()}>Save today</Button>
        <Button variant="quiet" onClick={() => navigate("/")}>Return home</Button>
      </div>
      <SafetyPanel className="mb-4" />
    </SoftShell>
  );
}

function PauseShell({ children }) {
  return (
    <div className="min-h-screen bg-[linear-gradient(145deg,#e9e4ef_0%,#f5efe7_52%,#ddebf4_100%)] px-4 py-6 text-slate-800">
      <main className="mx-auto flex min-h-[calc(100vh-48px)] min-w-0 flex-col justify-center" style={{ width: "calc(100vw - 2rem)", maxWidth: "28rem" }}>
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="rounded-2xl bg-white/70 px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-white/80 transition hover:bg-white"
          >
            Home
          </button>
        </div>
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
      <div className="mt-6 grid gap-3">
        <Button className="w-full" onClick={onContinue}>Continue</Button>
        <Button variant="secondary" className="w-full" onClick={() => navigate("/calm")}>Calm my body first</Button>
      </div>
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
        <Button variant="secondary" onClick={() => navigate("/calm")}>Calm my body</Button>
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
      <div className="mt-6 grid gap-3">
        <Button variant="secondary" className="w-full" onClick={() => navigate("/calm")}>Calm my body</Button>
        <Button variant="quiet" className="w-full" onClick={onBackToWriting}>Take me back to writing</Button>
      </div>
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
  const currentPrompt = journey.prompts[journeyState.currentDay - 1];
  const latestEntry = [...journeyState.entries].sort((a, b) => b.day - a.day)[0] || null;
  return (
    <Card className="p-5">
      <div className="flex min-h-44 flex-col">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Healing Journey</p>
        <h2 className="mt-3 text-2xl font-semibold leading-snug text-slate-900">{journey.title}</h2>
        <p className="mt-2 leading-7 text-slate-600">{journey.subtitle}</p>
        <div className="mt-4 rounded-2xl bg-white/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Today's step</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-800">{currentPrompt}</p>
          {latestEntry?.text && (
            <p className="mt-2 text-sm leading-6 text-slate-500">Last saved: {getPreviewText(latestEntry.text, 72)}</p>
          )}
        </div>
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
      {isFinalDay && journeyState.entries.length >= journey.prompts.length && (
        <Card className="p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Journey complete</p>
          <p className="mt-2 leading-7 text-slate-700">You walked through all seven steps. Let this ending feel quiet, not pressured.</p>
        </Card>
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
  const featuredNote = notes[0];

  return (
    <SoftShell>
      <PageHeader eyebrow="A quiet wall" title="Museum of Unsaid Things">
        Read a few soft notes, or leave words you never had space to say.
      </PageHeader>

      <div className="grid gap-4 pb-5">
        <Button onClick={() => setShowComposer(true)}>Leave an unsaid note</Button>
        <div className="rounded-2xl bg-white/60 px-4 py-3 text-sm leading-6 text-slate-600 shadow-sm">
          Please do not share personal details, threats, or anything that could identify someone.
        </div>
      </div>

      {featuredNote && (
        <Card className="mb-5 p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Featured note</p>
          <p className="mt-3 text-lg leading-8 text-slate-800">{featuredNote.text}</p>
          <p className="mt-3 text-sm font-semibold text-slate-500">Someone left this here. You are not the only one carrying unsaid words.</p>
        </Card>
      )}

      <div className="mb-4">
        <p className="mb-2 text-sm font-semibold text-slate-500">Read something for how I feel</p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
          {MUSEUM_READING_FILTERS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setActiveCategory(item.category)}
              className="shrink-0 rounded-full bg-white/70 px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-white/80 transition hover:bg-white"
            >
              {item.label}
            </button>
          ))}
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

const FALLBACK_QUESTIONS = {
  longing: "When does the missing hit you hardest — mornings, or the quiet at night?",
  anxiety: "What is the thought that keeps looping right now?",
  rejection: "Was it the rejection itself, or the silence after, that hurt more?",
  heavy: "What has felt too heavy to say out loud to anyone?",
  numb: "If you could feel one thing right now, what would you want it to be?",
  loss: "What's one ordinary moment that keeps reminding you it's over?",
  "self-worth": "Where did you first start believing you weren't enough in this?",
  "letting-go": "What are you most afraid of losing if you actually let go?",
  hope: "What would things look like if they were even a little better?",
  overthinking: "Which thought feels like it's on the loudest repeat right now?",
  lost: "When did you last feel clear about who you were?"
};

const WISDOM_STARTERS = [
  "I keep overthinking and need calm.",
  "I miss someone and do not know what to do.",
  "I feel pressure about my future.",
  "I feel rejected and small right now."
];

const WISDOM_MOOD_CHIPS = [
  { label: "Anxious", text: "I feel anxious and my mind will not slow down." },
  { label: "Heart heavy", text: "My heart feels heavy and I do not know where to put it." },
  { label: "Lost", text: "I feel lost and need one honest step." },
  { label: "Need faith", text: "I need a little faith and steadiness right now." }
];

const WISDOM_GREETING = "This space is only yours. Whatever brought you here — a breakup, losing someone, something you can't put words to — you can share it. I am not going to judge you, advise you, or rush you. I am just here to listen. Start wherever feels right.";

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
          <p className="leading-7 text-slate-800">{message.acknowledgment}</p>
        )}
        {message.question && (
          <p className="mt-4 leading-7 text-violet-800 font-medium">{message.question}</p>
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

  const buildLocalFallback = (userText, allMessages) => {
    const theme = detectThemeFromText(userText);
    const themeData = WISDOM_BY_THEME[theme] || WISDOM_BY_THEME.longing;
    const userMessages = allMessages.filter((m) => m.role === "user");
    const isEarlyTurn = userMessages.length <= 1;

    // Early turns: just listen and ask a question
    if (isEarlyTurn) {
      return {
        id: `w-${Date.now()}`,
        role: "wisdom",
        acknowledgment: themeData.acknowledgment,
        question: FALLBACK_QUESTIONS[theme] || "What has been the hardest part to sit with?",
        createdAt: new Date().toISOString()
      };
    }

    // Later turns: offer scripture
    const scripture = getRandomWisdom(theme);
    const reflection = WISDOM_REFLECTIONS_BY_THEME[theme] || WISDOM_REFLECTIONS_BY_THEME.longing;
    return {
      id: `w-${Date.now()}`,
      role: "wisdom",
      acknowledgment: themeData.acknowledgment,
      scripture,
      reflection,
      createdAt: new Date().toISOString()
    };
  };

  const handleSend = async () => {
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

    let wisdomMsg;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: withUser })
      });

      if (!response.ok) throw new Error("API unavailable");

      const data = await response.json();

      wisdomMsg = {
        id: `w-${Date.now()}`,
        role: "wisdom",
        acknowledgment: data.acknowledgment || "",
        question: data.question || null,
        scripture: data.scripture || null,
        reflection: data.reflection || "",
        createdAt: new Date().toISOString()
      };
    } catch {
      wisdomMsg = buildLocalFallback(userMsg.text, withUser);
    }

    const final = [...withUser, wisdomMsg];
    setMessages(final);
    saveStoredWisdomChat({ messages: final });
    setIsTyping(false);
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

  const useLastJournal = () => {
    const stored = readStoredFlow();
    if (stored?.journalText) setInput(stored.journalText);
  };

  const hasJournalDraft = Boolean(readStoredFlow()?.journalText);
  const hasOnlyGreeting = messages.filter((message) => message.role === "user").length === 0;

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
              onClick={() => navigate("/")}
              className="rounded-2xl bg-white/70 px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-white/80 hover:bg-white transition"
            >
              Home
            </button>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-500">Private space. Send only what you choose.</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-3">
        <div className="mx-auto max-w-md">
          {messages.map((message) =>
            message.role === "user"
              ? <UserBubble key={message.id} message={message} />
              : <WisdomBubble key={message.id} message={message} />
          )}
          {hasOnlyGreeting && !isTyping && (
            <Card className="mb-4 p-4">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Start gently</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {WISDOM_MOOD_CHIPS.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setInput(chip.text)}
                    className="rounded-full bg-white/70 px-3 py-2 text-sm font-semibold text-slate-600 ring-1 ring-white/80 transition hover:bg-white"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-2">
                {WISDOM_STARTERS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => setInput(starter)}
                    className="rounded-2xl bg-slate-50/80 px-4 py-3 text-left text-sm font-semibold leading-6 text-slate-700 transition hover:bg-white"
                  >
                    {starter}
                  </button>
                ))}
              </div>
              {hasJournalDraft && (
                <Button variant="secondary" className="mt-4 w-full" onClick={useLastJournal}>Use my last journal as a draft</Button>
              )}
            </Card>
          )}
          {isTyping && <ThinkingBubble />}
          <SafetyPanel className="mb-4" />
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

// ─── Home Hub ────────────────────────────────────────────────────────────────

const HOME_STORAGE_KEYS = {
  flow: STORAGE_KEY,
  journeys: JOURNEY_STORAGE_KEY,
  museum: MUSEUM_STORAGE_KEY,
  wisdom: WISDOM_CHAT_STORAGE_KEY,
  daily: DAILY_SANCTUARY_STORAGE_KEY,
  calm: GUIDED_CALM_STORAGE_KEY,
  pressure: PRESSURE_RESET_STORAGE_KEY,
  care: CARE_KIT_STORAGE_KEY,
  welcome: WELCOME_STORAGE_KEY,
  aftercare: AFTERCARE_STORAGE_KEY,
  onboarding: ONBOARDING_PREFERENCES_STORAGE_KEY
};

function readHomeJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return parsed || fallback;
  } catch {
    return fallback;
  }
}

function getLatestBySavedAt(values) {
  return values
    .filter(Boolean)
    .sort((a, b) => new Date(b.savedAt || b.createdAt || b.date || 0) - new Date(a.savedAt || a.createdAt || a.date || 0))[0] || null;
}

function getCompanionSnapshot() {
  const flow = readHomeJson(HOME_STORAGE_KEYS.flow, {});
  const journeys = readHomeJson(HOME_STORAGE_KEYS.journeys, {});
  const museum = readHomeJson(HOME_STORAGE_KEYS.museum, []);
  const wisdom = readHomeJson(HOME_STORAGE_KEYS.wisdom, {});
  const daily = readHomeJson(HOME_STORAGE_KEYS.daily, {});
  const calm = readHomeJson(HOME_STORAGE_KEYS.calm, {});
  const pressure = readHomeJson(HOME_STORAGE_KEYS.pressure, {});
  const care = readHomeJson(HOME_STORAGE_KEYS.care, {});
  const pause = readHomeJson(PAUSE_STORAGE_KEY, {});
  const todayEntry = daily[getLocalDateKey()] || null;
  const latestDaily = getLatestBySavedAt(Object.values(daily || {}));
  const lastJourney = getLastJourneyProgress(journeys);
  const latestMuseumNote = Array.isArray(museum) ? getLatestBySavedAt(museum) : null;
  const emotion = getEmotion(todayEntry?.emotionId || latestDaily?.emotionId || flow?.emotionId);
  const journalTheme = getTextTheme(flow?.journalText || latestDaily?.note || "");
  const hasWisdomChat = Array.isArray(wisdom?.messages) && wisdom.messages.length > 1;

  return {
    flow,
    journeys,
    museum,
    wisdom,
    daily,
    calm,
    pressure,
    care,
    pause,
    todayEntry,
    latestDaily,
    lastJourney,
    latestMuseumNote,
    emotion,
    journalTheme,
    hasWisdomChat,
    latestPressure: pressure?.latest || null,
    hasCareKit: Boolean(care?.person || care?.place || care?.action || care?.reminder)
  };
}

function getCompanionNextStep(snapshot) {
  if (snapshot.lastJourney) {
    return {
      title: `Continue ${snapshot.lastJourney.journey.title}`,
      text: `Day ${snapshot.lastJourney.state.currentDay} is waiting without pressure.`,
      href: `/journeys/${snapshot.lastJourney.journey.id}`
    };
  }

  if (snapshot.calm.latestExerciseId && (snapshot.journalTheme === "anxiety" || snapshot.emotion?.wisdomTheme === "anxiety")) {
    const exercise = getCalmExercise(snapshot.calm.latestExerciseId);
    return {
      title: "Return to what helped your body",
      text: `Last time, ${exercise.title.toLowerCase()} gave you a pause. You can use that again.`,
      href: "/calm"
    };
  }

  if (snapshot.latestPressure) {
    const pressureArea = getPressureArea(snapshot.latestPressure.areaId);
    return {
      title: `Reset ${pressureArea.label.toLowerCase()}`,
      text: "You named this pressure once. You can make it smaller again.",
      href: "/pressure"
    };
  }

  if (!snapshot.hasCareKit && (snapshot.calm.latestExerciseId || snapshot.todayEntry || snapshot.flow?.journalText)) {
    return {
      title: "Build your Care Kit",
      text: "Save the people, places, actions, and words that help on hard days.",
      href: "/care"
    };
  }

  if (snapshot.flow?.journalText) {
    return {
      title: "Bring this to Wisdom",
      text: "You already named something real. Let Wisdom answer it softly.",
      href: "/wisdom"
    };
  }

  if (!snapshot.todayEntry) {
    return {
      title: "Begin with today's small ritual",
      text: "Daily Sanctuary is the gentlest doorway when you are not sure where to start.",
      href: "/today"
    };
  }

  return {
    title: "Stay close to yourself",
    text: "You have already shown up today. A short calm reset is enough.",
    href: "/calm"
  };
}

function hasCompanionMemory(snapshot) {
  return Boolean(
    snapshot.todayEntry ||
    snapshot.latestDaily ||
    snapshot.flow?.journalText ||
    snapshot.calm.latestExerciseId ||
    snapshot.latestPressure ||
    snapshot.hasCareKit ||
    snapshot.lastJourney ||
    snapshot.latestMuseumNote ||
    snapshot.hasWisdomChat ||
    snapshot.pause?.choice
  );
}

function CompanionMemoryCard({ label, title, text, href }) {
  const content = (
    <>
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <h2 className="mt-3 text-xl font-semibold leading-snug text-slate-900">{title}</h2>
      <p className="mt-2 leading-7 text-slate-600">{text}</p>
    </>
  );

  if (href) {
    return <a href={href} className="rounded-3xl bg-white/75 p-5 shadow-[0_14px_35px_rgba(88,82,120,0.12)] ring-1 ring-white/75 transition duration-200 hover:-translate-y-0.5 hover:bg-white">{content}</a>;
  }

  return <Card className="p-5">{content}</Card>;
}

function CompanionMemoryScreen() {
  const [snapshot, setSnapshot] = useState(getCompanionSnapshot);

  useEffect(() => {
    const refresh = () => setSnapshot(getCompanionSnapshot());
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const nextStep = getCompanionNextStep(snapshot);
  const calmExercise = snapshot.calm.latestExerciseId ? getCalmExercise(snapshot.calm.latestExerciseId) : null;
  const pressureArea = snapshot.latestPressure ? getPressureArea(snapshot.latestPressure.areaId) : null;
  const journeyDay = snapshot.lastJourney?.state.currentDay || 1;
  const journeyTotal = snapshot.lastJourney?.journey.prompts.length || 7;
  const memoryExists = hasCompanionMemory(snapshot);

  return (
    <SoftShell>
      <PageHeader eyebrow="My quiet space" title="A small place that remembers what helped.">
        Everything here starts on this device. Sync is optional, and private writing stays local in this version.
      </PageHeader>

      <SyncPanel />
      <div className="mt-5">
        <LocalDataVault />
      </div>

      <div className="mb-4 rounded-3xl bg-slate-900 p-5 text-white shadow-[0_18px_50px_rgba(15,23,42,0.18)] ring-1 ring-slate-800/20">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Your quiet pattern</p>
        <h2 className="mt-3 text-2xl font-semibold leading-snug">
          {snapshot.emotion ? `You have been arriving with ${snapshot.emotion.shortLabel.toLowerCase()}.` : memoryExists ? "Your pattern is starting to appear." : "This space will grow as you use the app."}
        </h2>
        <p className="mt-3 leading-7 text-slate-200">
          {memoryExists ? "The app is noticing the rooms that helped you pause, write, and return to yourself." : "Start with one gentle check-in, calm reset, or note. This page will stay private and local."}
        </p>
      </div>

      <section className="grid gap-4">
        <CompanionMemoryCard
          label="Today"
          title={snapshot.todayEntry ? "Daily Sanctuary is complete" : "Daily Sanctuary is waiting"}
          text={snapshot.todayEntry ? getPreviewText(snapshot.todayEntry.note || "You showed up today. That is enough.", 110) : "One feeling, one wisdom line, one small action."}
          href="/today"
        />
        <CompanionMemoryCard
          label="Reflection"
          title={snapshot.flow?.journalText ? (getEmotion(snapshot.flow.emotionId)?.shortLabel || "Last reflection") : "No journal saved yet"}
          text={snapshot.flow?.journalText ? getPreviewText(snapshot.flow.journalText, 120) : "When you write, a soft preview will appear here."}
          href={snapshot.flow?.journalText ? "/reflect" : "/journal"}
        />
        <CompanionMemoryCard
          label="Body"
          title={calmExercise ? `Last calm: ${calmExercise.shortTitle}` : "No calm exercise yet"}
          text={calmExercise ? `Completed ${snapshot.calm.completedCount || 1} calm session${Number(snapshot.calm.completedCount || 1) === 1 ? "" : "s"} on this device.` : "Try breathing, grounding, unclenching, or a kind voice script."}
          href="/calm"
        />
        <CompanionMemoryCard
          label="Pressure"
          title={pressureArea ? pressureArea.label : "No pressure reset yet"}
          text={snapshot.latestPressure ? getPreviewText(snapshot.latestPressure.worry, 118) : "For exams, family expectations, comparison, career, money, and future worry."}
          href="/pressure"
        />
        <CompanionMemoryCard
          label="Care Kit"
          title={snapshot.hasCareKit ? "Your kit is ready" : "No care kit yet"}
          text={snapshot.hasCareKit ? getPreviewText(snapshot.care.reminder || snapshot.care.action || snapshot.care.person || "Your saved supports are here.", 118) : "Save who helps, where to go, one action, and one reminder."}
          href="/care"
        />
        <CompanionMemoryCard
          label="Journey"
          title={snapshot.lastJourney ? snapshot.lastJourney.journey.title : "No journey started yet"}
          text={snapshot.lastJourney ? `Day ${journeyDay} of ${journeyTotal}: ${snapshot.lastJourney.journey.prompts[journeyDay - 1]}` : "A 7-day path can hold what one page cannot."}
          href={snapshot.lastJourney ? `/journeys/${snapshot.lastJourney.journey.id}` : "/journeys"}
        />
      </section>

      <Card className="mt-5 p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">What helped last time</p>
        <h2 className="mt-3 text-2xl font-semibold leading-snug text-slate-900">{nextStep.title}</h2>
        <p className="mt-2 leading-7 text-slate-600">{nextStep.text}</p>
        <Button className="mt-5 w-full" onClick={() => navigate(nextStep.href)}>Go there</Button>
      </Card>

      <div className="mt-5 grid gap-3">
        <NextStepCard title="Open Personal Compass" text="See your current emotional season and the room that may help next." onClick={() => navigate("/compass")} />
        <NextStepCard title="Visit the Museum" text={snapshot.latestMuseumNote ? getPreviewText(snapshot.latestMuseumNote.text, 82) : "Read soft anonymous words from this device."} onClick={() => navigate("/museum")} />
        <NextStepCard title="Pause Before You Text" text={snapshot.pause?.choice ? "Your pause choice is saved here when you need it again." : "Use this when urgency feels louder than clarity."} onClick={() => navigate("/pause")} />
      </div>
      <SafetyPanel className="my-5" />
    </SoftShell>
  );
}

function CompassScreen() {
  const [insights, setInsights] = useState(getCompassInsights);

  useEffect(() => {
    const current = readCompassState();
    saveCompassState({
      ...current,
      lastOpenedAt: new Date().toISOString()
    });
    setInsights(getCompassInsights());

    const refresh = () => setInsights(getCompassInsights());
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  if (insights.isEmpty) {
    return (
      <SoftShell>
        <PageHeader eyebrow="Personal Compass" title="Your compass is still quiet.">
          Use one room first, then this page will become a softer mirror.
        </PageHeader>

        <Card className="mb-5 p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Private mirror</p>
          <h2 className="mt-3 text-2xl font-semibold leading-snug text-slate-900">Nothing is being scored.</h2>
          <p className="mt-3 leading-7 text-slate-600">
            Personal Compass reads only this browser. Start with a small room, and it will gently reflect what seems to help.
          </p>
        </Card>

        <section className="grid gap-3">
          <NextStepCard title="Find your first room" text="Answer one gentle question and begin where you are." href="/welcome" />
          <NextStepCard title="Start Daily Sanctuary" text="Name one feeling, receive one wisdom line, and choose one small action." href="/today" />
          <NextStepCard title="Calm my body" text="Use a short body-first reset if words feel too hard." href="/calm" />
        </section>

        <SafetyPanel className="my-5" />
      </SoftShell>
    );
  }

  const helpedBefore = insights.helpedBefore.length > 0 ? insights.helpedBefore : [
    { title: "Daily Sanctuary", text: "A simple ritual can become your first signal.", href: "/today" },
    { title: "Guided Calm", text: "A body-first reset is often enough to begin.", href: "/calm" }
  ];

  return (
    <SoftShell>
      <PageHeader eyebrow="Personal Compass" title="This is not a score. It is a mirror.">
        Everything here is built from this browser only.
      </PageHeader>

      <section className="grid gap-4">
        <CompassInsightCard eyebrow="Your current season" title={insights.seasonTitle} text={insights.seasonText} />

        <CompassInsightCard
          eyebrow="What has helped before"
          title="Small things left a trail."
          text="These are the rooms your local data says you have already touched."
        >
          <div className="grid gap-3">
            {helpedBefore.map((item) => (
              <a
                key={`${item.href}-${item.title}`}
                href={item.href}
                className="block rounded-2xl bg-white/72 p-4 ring-1 ring-white/80 transition hover:-translate-y-0.5 hover:bg-white"
              >
                <p className="font-semibold leading-snug text-slate-900">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
              </a>
            ))}
          </div>
        </CompassInsightCard>

        <RecommendedRoomCard action={insights.recommendedAction} />
        <PrivatePatternPanel stats={insights.patternStats} />
      </section>

      <div className="my-5 grid gap-3 sm:grid-cols-2">
        <NextStepCard title="My quiet space" text="See your data vault, sync settings, and saved supports." onClick={() => navigate("/me")} />
        <NextStepCard title="Emotion Timeline" text="Look back at saved moments by date." onClick={() => navigate("/timeline")} />
      </div>

      <SafetyPanel className="mb-5" />
    </SoftShell>
  );
}

const TIMELINE_FILTERS = ["All", "Daily", "Journal", "Calm", "Pressure", "Care", "Journey"];

function getTimelineTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatTimelineDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  const today = getLocalDateKey();
  if (getLocalDateKey(date) === today) return "Today";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function getTimelineItems() {
  const flow = readHomeJson(HOME_STORAGE_KEYS.flow, {});
  const journeys = readHomeJson(HOME_STORAGE_KEYS.journeys, {});
  const daily = readHomeJson(HOME_STORAGE_KEYS.daily, {});
  const calm = readHomeJson(HOME_STORAGE_KEYS.calm, {});
  const pressure = readHomeJson(HOME_STORAGE_KEYS.pressure, {});
  const care = readHomeJson(HOME_STORAGE_KEYS.care, {});
  const items = [];

  Object.values(daily || {}).forEach((entry) => {
    if (!entry) return;
    const emotion = getEmotion(entry.emotionId);
    items.push({
      id: `daily-${entry.date || entry.savedAt}`,
      type: "Daily",
      title: emotion ? `Daily Sanctuary: ${emotion.shortLabel}` : "Daily Sanctuary",
      text: entry.note || "You showed up today. That is enough.",
      date: entry.savedAt || entry.date,
      href: "/today"
    });
  });

  if (flow?.journalText) {
    const emotion = getEmotion(flow.emotionId);
    items.push({
      id: `journal-${flow.updatedAt || "latest"}`,
      type: "Journal",
      title: emotion ? `Journal: ${emotion.shortLabel}` : "Journal reflection",
      text: flow.journalText,
      date: flow.updatedAt || new Date().toISOString(),
      href: "/reflect"
    });
  }

  if (calm?.latestExerciseId) {
    const exercise = getCalmExercise(calm.latestExerciseId);
    items.push({
      id: `calm-${calm.latestCompletedAt || calm.latestExerciseId}`,
      type: "Calm",
      title: `Guided Calm: ${exercise.shortTitle}`,
      text: `Latest of ${Number(calm.completedCount || 1)} calm session${Number(calm.completedCount || 1) === 1 ? "" : "s"} saved on this device.`,
      date: calm.latestCompletedAt || new Date().toISOString(),
      href: "/calm"
    });
  }

  const pressureHistory = Array.isArray(pressure?.history) ? pressure.history : [];
  pressureHistory.forEach((entry) => {
    const area = getPressureArea(entry.areaId);
    items.push({
      id: entry.id || `pressure-${entry.savedAt || area.id}`,
      type: "Pressure",
      title: `Pressure Reset: ${area.label}`,
      text: `${entry.worry || "Pressure named."} - ${entry.action || area.action}`,
      date: entry.savedAt || new Date().toISOString(),
      href: "/pressure"
    });
  });

  if (care?.updatedAt && (care.person || care.place || care.action || care.reminder)) {
    items.push({
      id: `care-${care.updatedAt}`,
      type: "Care",
      title: "Care Kit updated",
      text: care.reminder || care.action || care.person || "Your saved supports are ready.",
      date: care.updatedAt,
      href: "/care"
    });
  }

  HEALING_JOURNEYS.forEach((journey) => {
    const state = getJourneyState(journeys || {}, journey);
    state.entries.forEach((entry) => {
      items.push({
        id: `journey-${journey.id}-${entry.day}-${entry.savedAt || ""}`,
        type: "Journey",
        title: `${journey.title}: Day ${entry.day}`,
        text: `${entry.prompt || journey.prompts[entry.day - 1]} - ${entry.text || "Saved journey entry."}`,
        date: entry.savedAt || new Date().toISOString(),
        href: `/journeys/${journey.id}`
      });
    });
  });

  return items.sort((a, b) => getTimelineTimestamp(b.date) - getTimelineTimestamp(a.date));
}

function TimelineItemCard({ item }) {
  return (
    <a
      href={item.href}
      className="block rounded-3xl bg-white/75 p-5 shadow-[0_14px_35px_rgba(88,82,120,0.12)] ring-1 ring-white/75 transition duration-200 hover:-translate-y-0.5 hover:bg-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="rounded-full bg-slate-50/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{item.type}</p>
        <p className="text-sm font-semibold text-slate-500">{formatTimelineDay(item.date)}</p>
      </div>
      <h2 className="mt-4 text-xl font-semibold leading-snug text-slate-900">{item.title}</h2>
      <p className="mt-2 leading-7 text-slate-600">{getPreviewText(item.text, 150)}</p>
    </a>
  );
}

function EmotionTimelineScreen() {
  const [items, setItems] = useState(getTimelineItems);
  const [activeFilter, setActiveFilter] = useState("All");

  useEffect(() => {
    const refresh = () => setItems(getTimelineItems());
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const filteredItems = activeFilter === "All" ? items : items.filter((item) => item.type === activeFilter);
  const firstItem = items[0];

  return (
    <SoftShell>
      <PageHeader eyebrow="Emotion Timeline" title="See the quiet proof that you kept going.">
        A private timeline from this device only: daily notes, journal reflections, calm sessions, and healing journey entries.
      </PageHeader>

      <Card className="mb-4 p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Private progress</p>
        <h2 className="mt-3 text-2xl font-semibold leading-snug text-slate-900">
          {items.length > 0 ? `${items.length} saved moment${items.length === 1 ? "" : "s"}` : "No saved moments yet"}
        </h2>
        <p className="mt-2 leading-7 text-slate-600">
          {firstItem ? `Latest: ${firstItem.title}` : "Start with Daily Sanctuary, Guided Calm, a journal entry, or a Healing Journey."}
        </p>
      </Card>

      <div className="mb-4 flex flex-wrap gap-2">
        {TIMELINE_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setActiveFilter(filter)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeFilter === filter ? "bg-slate-900 text-white" : "bg-white/70 text-slate-600 hover:bg-white"}`}
          >
            {filter}
          </button>
        ))}
      </div>

      {filteredItems.length > 0 ? (
        <section className="grid gap-4">
          {filteredItems.map((item) => (
            <TimelineItemCard key={item.id} item={item} />
          ))}
        </section>
      ) : (
        <Card className="p-5">
          <h2 className="text-xl font-semibold text-slate-900">Nothing here yet.</h2>
          <p className="mt-2 leading-7 text-slate-600">Maybe one small note belongs here first.</p>
          <Button className="mt-5 w-full" onClick={() => navigate("/today")}>Start today</Button>
        </Card>
      )}

      <div className="my-5 grid gap-3">
        <NextStepCard title="My quiet space" text="See what helped before and choose the next gentle step." onClick={() => navigate("/me")} />
        <NextStepCard title="Add today" text="Name one feeling and save one small note." onClick={() => navigate("/today")} />
      </div>
    </SoftShell>
  );
}

function getHomeStatus() {
  const flow = readHomeJson(HOME_STORAGE_KEYS.flow, {});
  const journeys = readHomeJson(HOME_STORAGE_KEYS.journeys, {});
  const museum = readHomeJson(HOME_STORAGE_KEYS.museum, []);
  const wisdom = readHomeJson(HOME_STORAGE_KEYS.wisdom, {});
  const daily = readHomeJson(HOME_STORAGE_KEYS.daily, {});
  const calm = readHomeJson(HOME_STORAGE_KEYS.calm, {});
  const pressure = readHomeJson(HOME_STORAGE_KEYS.pressure, {});
  const care = readHomeJson(HOME_STORAGE_KEYS.care, {});
  const welcome = readHomeJson(HOME_STORAGE_KEYS.welcome, {});
  const aftercare = readHomeJson(HOME_STORAGE_KEYS.aftercare, {});
  const onboarding = readHomeJson(HOME_STORAGE_KEYS.onboarding, {});
  const compass = getCompassInsights();
  const timelineCount = getTimelineItems().length;
  const journeyValues = Object.values(journeys || {});
  const lastJourney = getLastJourneyProgress(journeys);
  const unfinishedJourney = getUnfinishedJourneyProgress(journeys);
  const todayEntry = daily[getLocalDateKey()] || null;
  const hasJournal = Boolean(flow?.journalText);
  const welcomeReason = getWelcomeReason(welcome.reasonId);
  const aftercareAction = aftercare?.latest ? getAftercareAction(aftercare.latest.actionId) : null;
  const onboardingRecommendation = onboarding?.completedAt ? getOnboardingRecommendation(onboarding.arrivalId, onboarding.supportStyleId) : null;
  const hasAnyProgress = Boolean(todayEntry) || hasJournal || Boolean(calm.latestExerciseId) || Boolean(pressure?.latest) || Boolean(care?.updatedAt) || Boolean(welcome.reasonId) || Boolean(aftercareAction) || journeyValues.some((j) => (j?.entries || []).length > 0 || Number(j?.currentDay) > 1);

  return {
    welcome: onboardingRecommendation ? `Saved: ${onboardingRecommendation.title}` : welcomeReason ? `Started with ${welcomeReason.label}` : "Find your starting point",
    checkIn: hasJournal ? "Continue your reflection" : "Start with one feeling",
    wisdom: Array.isArray(wisdom?.messages) && wisdom.messages.length > 1 ? "Conversation waiting here" : "Private listening space",
    journeys: lastJourney ? `Day ${lastJourney.state.currentDay} waiting` : "Choose a 7-day path",
    museum: Array.isArray(museum) && museum.length > 0 ? "Wall has notes on this device" : "Read or leave soft notes",
    pause: localStorage.getItem(PAUSE_STORAGE_KEY) ? "Pause answers saved" : "Slow down before acting",
    daily: todayEntry ? "Today checked in" : "One gentle ritual",
    calm: calm.latestExerciseId ? `Last calm: ${getCalmExercise(calm.latestExerciseId).shortTitle}` : "A one-minute reset",
    sos: "Fast grounding path",
    pressure: pressure?.latest ? `Last reset: ${getPressureArea(pressure.latest.areaId).label}` : "Student stress reset",
    care: care?.updatedAt ? "Your supports are saved" : "Build your support kit",
    aftercare: aftercareAction ? `Saved: ${aftercareAction.title}` : "Save what helps",
    aftercareCard: aftercareAction ? {
      title: "Last helpful step",
      text: aftercareAction.text,
      status: aftercareAction.title,
      href: aftercareAction.href
    } : null,
    companion: hasJournal || todayEntry || calm.latestExerciseId || pressure?.latest || care?.updatedAt || lastJourney || Array.isArray(wisdom?.messages) && wisdom.messages.length > 1 ? "Quiet pattern ready" : "Starts as you use it",
    compass: compass.isEmpty ? "Needs one signal" : compass.seasonTitle,
    timeline: timelineCount > 0 ? `${timelineCount} saved moment${timelineCount === 1 ? "" : "s"}` : "Builds privately",
    primary: unfinishedJourney
      ? {
          title: `Continue ${unfinishedJourney.journey.title}`,
          text: `Day ${unfinishedJourney.state.currentDay}: ${unfinishedJourney.journey.prompts[unfinishedJourney.state.currentDay - 1]}`,
          href: `/journeys/${unfinishedJourney.journey.id}`,
          status: "Continue where you left off"
        }
      : onboardingRecommendation
      ? {
          title: "Start like last time",
          text: onboardingRecommendation.text,
          href: onboardingRecommendation.href,
          emotionId: onboardingRecommendation.emotionId || "",
          status: onboardingRecommendation.title
        }
      : !welcome.reasonId && !hasAnyProgress
      ? {
          title: "Find your starting point",
          text: "Answer two gentle questions and I will take you to the best place to start.",
          href: "/welcome",
          status: "New here"
        }
      : todayEntry
        ? {
            title: "Today checked in",
            text: "You showed up today. That is enough.",
            href: "/today",
            status: "Daily ritual done"
          }
        : {
            title: "Daily Sanctuary",
            text: "One gentle ritual for how you are arriving today.",
            href: "/today",
            status: "Start today's check-in"
          },
    hasAnyProgress
  };
}

function HomeCard({ title, text, status, href, featured = false, onClick }) {
  const className = `${featured ? "bg-slate-900 text-white shadow-[0_22px_55px_rgba(15,23,42,0.24)] hover:bg-slate-800" : "bg-white/75 text-slate-800 shadow-[0_14px_35px_rgba(88,82,120,0.12)] hover:bg-white/90"} group rounded-3xl p-5 text-left ring-1 ring-white/70 backdrop-blur transition duration-200 hover:-translate-y-0.5`;
  const content = (
      <div className={featured ? "flex min-h-36 flex-col" : "flex min-h-28 flex-col"}>
        <h2 className={`${featured ? "text-2xl text-white" : "text-xl text-slate-900"} font-semibold leading-snug`}>{title}</h2>
        <p className={`${featured ? "text-slate-200" : "text-slate-600"} mt-2 flex-1 leading-7`}>{text}</p>
        {status && (
          <p className={`${featured ? "bg-white/10 text-slate-100" : "bg-slate-50/80 text-slate-500"} mt-4 rounded-2xl px-4 py-2 text-sm font-semibold`}>{status}</p>
        )}
      </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return (
    <a href={href} className={className}>
      {content}
    </a>
  );
}

function HomeMiniCard({ title, text, status, href, tone = "bg-white/75" }) {
  return (
    <a
      href={href}
      className={`flex min-h-36 flex-col rounded-3xl ${tone} p-4 text-left shadow-[0_14px_35px_rgba(88,82,120,0.10)] ring-1 ring-white/75 transition duration-200 hover:-translate-y-0.5 hover:bg-white/90`}
    >
      <h2 className="text-base font-semibold leading-snug text-slate-900">{title}</h2>
      <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{text}</p>
      {status && <p className="mt-3 rounded-2xl bg-white/65 px-3 py-2 text-xs font-semibold leading-5 text-slate-500">{status}</p>}
    </a>
  );
}

function HomeSection({ title, children }) {
  return (
    <section className="py-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</h2>
      {children}
    </section>
  );
}

function HomeHubScreen({ onQuickEmotion }) {
  const [status, setStatus] = useState(getHomeStatus);

  useEffect(() => {
    const refresh = () => setStatus(getHomeStatus());
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const quickEmotions = ["overthinking", "anxious", "miss-someone", "heavy", "not-sure"].map(getEmotion).filter(Boolean);
  const startQuickEmotion = (emotion) => {
    if (onQuickEmotion) {
      onQuickEmotion(emotion);
      return;
    }

    saveStoredFlow({
      emotionId: emotion.id,
      journalText: "",
      updatedAt: new Date().toISOString()
    });
    navigate("/journal");
  };
  const startPrimary = () => {
    if (!status.primary.emotionId) return undefined;
    const emotion = getEmotion(status.primary.emotionId);
    if (!emotion) return undefined;
    return () => startQuickEmotion(emotion);
  };

  const reliefCards = [
    { title: "SOS", text: "For intense moments.", status: status.sos, href: "/sos", tone: "bg-rose-50/90" },
    { title: "Calm", text: "Body-first reset.", status: status.calm, href: "/calm", tone: "bg-blue-50/90" },
    { title: "Care Kit", text: "Your saved supports.", status: status.care, href: "/care", tone: "bg-emerald-50/90" },
    { title: "Pressure", text: "Exams, family, future.", status: status.pressure, href: "/pressure", tone: "bg-amber-50/90" }
  ];

  const guidedCards = [
    { title: "Start here", text: "Find the right room fast.", status: status.welcome, href: "/welcome" },
    { title: "Check in", text: "Name one feeling and write privately.", status: status.checkIn, href: "/check-in" },
    { title: "Wisdom", text: "Talk through what feels heavy.", status: status.wisdom, href: "/wisdom" },
    { title: "Journey", text: "A 7-day path for slower healing.", status: status.journeys, href: "/journeys" },
    { title: "Museum", text: "Read soft unsent notes.", status: status.museum, href: "/museum" }
  ];

  const returnCards = [
    ...(status.aftercareCard ? [status.aftercareCard] : []),
    { title: "My quiet space", text: "What helped before.", status: status.companion, href: "/me" },
    { title: "Personal Compass", text: "Your private pattern and next room.", status: status.compass, href: "/compass" },
    { title: "Timeline", text: "See saved moments.", status: status.timeline, href: "/timeline" },
    { title: "Pause texting", text: "Slow an urgent message.", status: status.pause, href: "/pause" }
  ];

  return (
    <main className="sacred-app-bg min-h-screen overflow-x-hidden px-4 pb-24 pt-5 text-slate-800 sm:px-6 sm:pb-8">
      <div className="sacred-page-enter mx-auto flex min-h-[calc(100vh-40px)] min-w-0 flex-col" style={{ width: "calc(100vw - 2rem)", maxWidth: "64rem" }}>
        <AppTopNav currentPath={window.location.pathname} onNavigate={navigate} />
        <header className="sacred-hero rounded-[2rem] p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Eternal</p>
            <a href="/me" className="rounded-2xl bg-white/70 px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-white/80 sm:hidden">Profile</a>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <h1 className="mt-5 text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl">A soft place to land when life feels loud.</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">Choose the room your heart can enter right now. Gentle reflection, Gita-inspired steadiness, body-first calm, and privacy-first support for anyone carrying too much.</p>
            </div>
            <div className="rounded-3xl bg-white/60 p-4 ring-1 ring-white/80">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Trust model</p>
              <div className="mt-3 grid gap-2">
                {["Private by default", "Sync only if you choose", "Your words stay yours"].map((item) => (
                  <span key={item} className="rounded-full bg-white/76 px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-white/80">{item}</span>
                ))}
              </div>
            </div>
          </div>
        </header>

        <div className="mt-4 grid gap-3 lg:grid-cols-[0.82fr_1.18fr]">
          <a
            href="/sos"
            className="rounded-3xl bg-rose-50/95 p-4 text-left shadow-[0_14px_35px_rgba(88,82,120,0.10)] ring-1 ring-rose-100 transition hover:-translate-y-0.5 hover:bg-rose-50"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-rose-700">If it feels urgent</p>
            <h2 className="mt-2 text-xl font-semibold leading-snug text-slate-900">Open SOS Mode first.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">A fast grounding path for moments when thinking is too much.</p>
          </a>

          <HomeCard featured title={status.primary.title} text={status.primary.text} status={status.primary.status} href={status.primary.href} onClick={startPrimary()} />
        </div>

        <HomeSection title="How are you arriving?">
          <div className="flex flex-wrap gap-2">
            {quickEmotions.map((emotion) => (
              <button
                key={emotion.id}
                type="button"
                onClick={() => startQuickEmotion(emotion)}
                className="rounded-full bg-white/75 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-white/80 transition hover:bg-white"
              >
                {emotion.shortLabel}
              </button>
            ))}
          </div>
        </HomeSection>

        <HomeSection title="Need relief now">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {reliefCards.map((card) => (
              <HomeMiniCard key={card.href} {...card} />
            ))}
          </div>
        </HomeSection>

        <HomeSection title="Choose a guided room">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {guidedCards.map((card) => (
              <HomeMiniCard key={card.href} {...card} />
            ))}
          </div>
        </HomeSection>

        <HomeSection title="Come back to yourself">
          <div className="grid gap-3 lg:grid-cols-3">
            {returnCards.map((card) => (
              <HomeCard key={card.href} {...card} />
            ))}
          </div>
        </HomeSection>
        <SafetyPanel className="mb-3" />
        <div className="mt-auto rounded-3xl bg-white/60 p-4 text-sm leading-6 text-slate-600 shadow-sm ring-1 ring-white/70">
          Most writing stays only on this device. Sync is optional from My quiet space, and your private words are not uploaded in this version.
        </div>
      </div>
      <AppBottomNav currentPath={window.location.pathname} onNavigate={navigate} />
    </main>
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

  const startWelcomeReason = (reason) => {
    const arrivalId = reason.arrival?.id || reason.id || "";
    const supportStyleId = reason.supportStyle?.id || "";
    const recommendedRoute = reason.href || reason.route || "/today";
    const completedAt = new Date().toISOString();

    if (arrivalId && supportStyleId) {
      saveStoredOnboardingPreferences({
        version: 1,
        arrivalId,
        supportStyleId,
        recommendedRoute,
        completedAt
      });
    }

    saveStoredWelcome({
      reasonId: arrivalId,
      route: recommendedRoute,
      selectedAt: completedAt
    });

    if (reason.emotionId) {
      const emotion = getEmotion(reason.emotionId);
      if (emotion) {
        selectEmotion(emotion);
        return;
      }
    }

    navigate(recommendedRoute);
  };

  if (route === "/") return <HomeHubScreen onQuickEmotion={selectEmotion} />;

  if (route === "/welcome") return <WelcomeScreen onStartReason={startWelcomeReason} />;

  if (route === "/today") return <DailySanctuaryScreen />;

  if (route === "/calm") return <GuidedCalmRoom />;

  if (route === "/sos") return <SOSModeScreen />;

  if (route === "/pressure") return <PressureResetScreen />;

  if (route === "/care") return <CareKitScreen />;

  if (route === "/compass") return <CompassScreen />;

  if (route === "/me") return <CompanionMemoryScreen />;

  if (route === "/timeline") return <EmotionTimelineScreen />;

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

export default App;
