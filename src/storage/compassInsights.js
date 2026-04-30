import { LOCAL_STORAGE_KEYS } from "./progressSnapshot.js";

export const COMPASS_STORAGE_KEY = "neeraj-eternal-compass";

const JOURNEY_TITLES = {
  "letting-go": "Letting Go",
  "self-worth": "Self Worth",
  "understanding-love": "Understanding Love"
};

const EMOTION_THEMES = {
  "miss-someone": "longing",
  overthinking: "overthinking",
  rejected: "rejection",
  anxious: "anxiety",
  numb: "numb",
  heavy: "heavy",
  "not-sure": "lost",
  lost: "lost"
};

const CALM_TITLES = {
  breathing: "Breathing",
  grounding: "Grounding",
  unclench: "Unclench",
  "kind-voice": "Kind voice"
};

const PRESSURE_TITLES = {
  exams: "Exams or marks",
  family: "Family expectations",
  career: "Career pressure",
  comparison: "Comparison",
  future: "Future anxiety",
  money: "Money stress"
};

const ACTION_ROOMS = {
  calm: { title: "Open Guided Calm", href: "/calm", text: "Start with the body before trying to solve the whole story." },
  pause: { title: "Pause Before You Text", href: "/pause", text: "Slow down an urgent message without shaming the feeling." },
  journeys: { title: "Start a Healing Journey", href: "/journeys", text: "Let seven quiet days hold what one page cannot." },
  pressure: { title: "Open Pressure Reset", href: "/pressure", text: "Make exams, family, career, or future stress smaller." },
  care: { title: "Open Care Kit", href: "/care", text: "Keep trusted people, safe places, and steady reminders close." },
  wisdom: { title: "Talk to Wisdom", href: "/wisdom", text: "Bring the feeling to a calmer, spiritual conversation." },
  today: { title: "Start Daily Sanctuary", href: "/today", text: "Name one feeling, receive one line, and choose one small action." },
  welcome: { title: "Find Your First Room", href: "/welcome", text: "Answer one gentle question and begin where you are." }
};

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readJson(key, fallback) {
  if (!canUseStorage()) return fallback;
  try {
    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) return fallback;
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage can fail in private or restricted browser modes. The app remains usable.
  }
}

function latestByTime(values) {
  return values
    .filter(Boolean)
    .sort((a, b) => new Date(b.savedAt || b.createdAt || b.updatedAt || b.date || 0) - new Date(a.savedAt || a.createdAt || a.updatedAt || a.date || 0))[0] || null;
}

function getTextTheme(text) {
  const value = typeof text === "string" ? text.toLowerCase() : "";
  if (!value.trim()) return "";
  if (/(exam|study|marks|college|career|job|future|fail|failure|disappoint|family|parents|money)/.test(value)) return "pressure";
  if (/(miss|text|reply|message|come back|remember|profile|blocked|unblocked|yaad)/.test(value)) return "longing";
  if (/(reject|ignored|left|chosen|not enough|unwanted|replace|worth|self respect|self-respect)/.test(value)) return "rejection";
  if (/(anxious|anxiety|panic|scared|afraid|fear|worried|overthink|overthinking)/.test(value)) return "anxiety";
  if (/(numb|empty|nothing|blank)/.test(value)) return "numb";
  if (/(heavy|tired|exhausted|alone|lonely|lost|hopeless)/.test(value)) return "heavy";
  return "";
}

function getJourneySummary(journeys) {
  const entries = Object.entries(journeys || {}).map(([journeyId, state]) => {
    const currentDay = Math.min(Math.max(Number(state?.currentDay) || 1, 1), 7);
    const savedEntries = Array.isArray(state?.entries) ? state.entries : [];
    const latestEntry = latestByTime(savedEntries);
    const hasStarted = savedEntries.length > 0 || currentDay > 1;
    const isComplete = currentDay >= 7 && savedEntries.length >= 7;

    return {
      journeyId,
      title: JOURNEY_TITLES[journeyId] || "Healing Journey",
      currentDay,
      entryCount: savedEntries.length,
      latestEntry,
      hasStarted,
      isComplete
    };
  });

  const started = entries.filter((entry) => entry.hasStarted);
  const unfinished = started.find((entry) => !entry.isComplete) || null;
  const latest = started.sort((a, b) => {
    const aTime = new Date(a.latestEntry?.savedAt || 0).getTime() || a.currentDay;
    const bTime = new Date(b.latestEntry?.savedAt || 0).getTime() || b.currentDay;
    return bTime - aTime;
  })[0] || null;

  return {
    started,
    unfinished,
    latest,
    entryCount: entries.reduce((total, entry) => total + entry.entryCount, 0)
  };
}

function getThemeFromLocalData({ flow, daily, pressure, pause }) {
  const latestDaily = latestByTime(Object.values(daily || {}));
  const emotionTheme = EMOTION_THEMES[latestDaily?.emotionId] || EMOTION_THEMES[flow?.emotionId] || "";
  const textTheme = getTextTheme([flow?.journalText, latestDaily?.note, pressure?.latest?.worry, pause?.answers?.hope, pause?.answers?.expectation].filter(Boolean).join(" "));

  if (pressure?.latest?.areaId || textTheme === "pressure") return "pressure";
  return textTheme || emotionTheme || "";
}

function getSeason(theme, hasAnyData) {
  if (!hasAnyData) {
    return {
      seasonTitle: "Your compass is still quiet.",
      seasonText: "Use one room first, then this page will become a softer mirror."
    };
  }

  if (theme === "pressure") {
    return {
      seasonTitle: "A season of pressure",
      seasonText: "Your mind may be carrying expectations, exams, family, career, or future fear. The next step is to make the big cloud smaller."
    };
  }

  if (theme === "anxiety" || theme === "overthinking") {
    return {
      seasonTitle: "A season of loud thoughts",
      seasonText: "Your system is asking for certainty and safety. A body-first pause may help before more analysis."
    };
  }

  if (theme === "longing") {
    return {
      seasonTitle: "A season of missing and meaning",
      seasonText: "Something or someone still matters to you. The task is to honor that truth without letting urgency choose for you."
    };
  }

  if (theme === "rejection" || theme === "self-worth") {
    return {
      seasonTitle: "A season of rebuilding worth",
      seasonText: "A painful response may have shaken your value. This is a good moment for self-respect, slower healing, and gentler evidence."
    };
  }

  if (theme === "heavy" || theme === "numb" || theme === "lost") {
    return {
      seasonTitle: "A season of gentle return",
      seasonText: "You may not need a big answer first. You may need safety, care, and one small sign that you are not alone with it."
    };
  }

  return {
    seasonTitle: "A season of becoming honest",
    seasonText: "You have been using quiet rooms to name what is real. Keep choosing the room that gives your nervous system more space."
  };
}

function getRecommendation({ theme, journeySummary, pause }) {
  if (journeySummary.unfinished) {
    return {
      title: `Continue ${journeySummary.unfinished.title}`,
      text: `Day ${journeySummary.unfinished.currentDay} is already waiting. Stay with the path you began.`,
      href: `/journeys/${journeySummary.unfinished.journeyId}`
    };
  }

  if (theme === "anxiety" || theme === "overthinking") return ACTION_ROOMS.calm;
  if (theme === "longing" || pause?.choice || getTextTheme(JSON.stringify(pause || {})) === "longing") return ACTION_ROOMS.pause;
  if (theme === "rejection" || theme === "self-worth") return ACTION_ROOMS.journeys;
  if (theme === "pressure") return ACTION_ROOMS.pressure;
  if (theme === "heavy" || theme === "numb" || theme === "lost") return ACTION_ROOMS.care;
  return ACTION_ROOMS.wisdom;
}

function buildHelpedBefore({ daily, calm, pressure, care, aftercare, journeySummary, wisdom }) {
  const latestDaily = latestByTime(Object.values(daily || {}));
  const helped = [];

  if (calm?.latestExerciseId) {
    helped.push({
      title: `Last calm: ${CALM_TITLES[calm.latestExerciseId] || "Guided Calm"}`,
      text: `${Number(calm.completedCount || 1)} calm session${Number(calm.completedCount || 1) === 1 ? "" : "s"} saved on this device.`,
      href: "/calm"
    });
  }

  if (journeySummary.latest) {
    helped.push({
      title: `${journeySummary.latest.title} is in progress`,
      text: `You have saved ${journeySummary.latest.entryCount} journey entr${journeySummary.latest.entryCount === 1 ? "y" : "ies"}.`,
      href: `/journeys/${journeySummary.latest.journeyId}`
    });
  }

  if (pressure?.latest) {
    helped.push({
      title: `Pressure named: ${PRESSURE_TITLES[pressure.latest.areaId] || "Stress"}`,
      text: "You made one pressure more specific, which makes it easier to carry.",
      href: "/pressure"
    });
  }

  if (care?.updatedAt && (care.person || care.place || care.action || care.reminder)) {
    helped.push({
      title: "Your Care Kit exists",
      text: "You have saved at least one support for hard moments.",
      href: "/care"
    });
  }

  if (latestDaily) {
    helped.push({
      title: "Daily Sanctuary helped you show up",
      text: latestDaily.action || "One small daily action is already saved here.",
      href: "/today"
    });
  }

  if (aftercare?.latest) {
    helped.push({
      title: "You saved a helpful next step",
      text: "Your home hub can keep pointing you back to what felt steady.",
      href: aftercare.latest.href || "/"
    });
  }

  if (Array.isArray(wisdom?.messages) && wisdom.messages.length > 1) {
    helped.push({
      title: "Wisdom has heard you before",
      text: "A private conversation is already waiting on this device.",
      href: "/wisdom"
    });
  }

  return helped.slice(0, 4);
}

function buildPatternStats({ flow, daily, calm, museum, wisdom, journeySummary, pressure, care }) {
  const dailyCount = Object.keys(daily || {}).length;
  const wisdomMessages = Array.isArray(wisdom?.messages) ? wisdom.messages.length : 0;
  const museumNotes = Array.isArray(museum) ? museum.length : 0;
  const pressureCount = Array.isArray(pressure?.history) ? pressure.history.length : pressure?.latest ? 1 : 0;
  const careCount = care?.updatedAt ? [care.person, care.place, care.action, care.reminder].filter(Boolean).length : 0;

  return [
    { label: "Private journal", value: flow?.journalText ? "Saved" : "Quiet", text: flow?.journalText ? "One reflection exists here." : "No journal text yet." },
    { label: "Daily days", value: String(dailyCount), text: "Daily Sanctuary entries on this device." },
    { label: "Calm sessions", value: String(Number(calm?.completedCount || 0)), text: "Body-first resets completed." },
    { label: "Journey entries", value: String(journeySummary.entryCount), text: "Longer healing pages saved." },
    { label: "Pressure resets", value: String(pressureCount), text: "Stress clouds made smaller." },
    { label: "Care supports", value: String(careCount), text: "People, places, actions, or words saved." },
    { label: "Museum notes", value: String(museumNotes), text: "Unsent words placed here." },
    { label: "Wisdom messages", value: String(wisdomMessages), text: "Private chat messages saved." }
  ];
}

export function readCompassState() {
  return readJson(COMPASS_STORAGE_KEY, {
    lastOpenedAt: "",
    dismissedTips: []
  });
}

export function saveCompassState(nextState) {
  const current = readCompassState();
  const safeState = {
    lastOpenedAt: nextState?.lastOpenedAt || current.lastOpenedAt || "",
    dismissedTips: Array.isArray(nextState?.dismissedTips) ? nextState.dismissedTips : current.dismissedTips || []
  };
  writeJson(COMPASS_STORAGE_KEY, safeState);
  return safeState;
}

export function getCompassInsights() {
  const flow = readJson(LOCAL_STORAGE_KEYS.flow, {});
  const pause = readJson(LOCAL_STORAGE_KEYS.pause, {});
  const journeys = readJson(LOCAL_STORAGE_KEYS.journeys, {});
  const museum = readJson(LOCAL_STORAGE_KEYS.museum, []);
  const wisdom = readJson(LOCAL_STORAGE_KEYS.wisdom, {});
  const daily = readJson(LOCAL_STORAGE_KEYS.daily, {});
  const calm = readJson(LOCAL_STORAGE_KEYS.calm, {});
  const pressure = readJson(LOCAL_STORAGE_KEYS.pressure, {});
  const care = readJson(LOCAL_STORAGE_KEYS.care, {});
  const welcome = readJson(LOCAL_STORAGE_KEYS.welcome, {});
  const aftercare = readJson(LOCAL_STORAGE_KEYS.aftercare, {});
  const compass = readCompassState();
  const journeySummary = getJourneySummary(journeys);
  const theme = getThemeFromLocalData({ flow, daily, pressure, pause });
  const helpedBefore = buildHelpedBefore({ daily, calm, pressure, care, aftercare, journeySummary, wisdom });
  const patternStats = buildPatternStats({ flow, daily, calm, museum, wisdom, journeySummary, pressure, care });

  const hasAnyData = Boolean(
    flow?.journalText ||
    flow?.emotionId ||
    Object.keys(daily || {}).length ||
    calm?.latestExerciseId ||
    pressure?.latest ||
    care?.updatedAt ||
    welcome?.reasonId ||
    aftercare?.latest ||
    journeySummary.started.length ||
    (Array.isArray(museum) && museum.length > 0) ||
    (Array.isArray(wisdom?.messages) && wisdom.messages.length > 1) ||
    pause?.choice ||
    pause?.answers
  );

  const season = getSeason(theme, hasAnyData);
  const recommendedAction = getRecommendation({ theme, journeySummary, pause });

  return {
    isEmpty: !hasAnyData,
    theme: theme || "quiet",
    seasonTitle: season.seasonTitle,
    seasonText: season.seasonText,
    helpedBefore,
    recommendedAction,
    patternStats,
    lastOpenedAt: compass.lastOpenedAt || "",
    dismissedTips: compass.dismissedTips || []
  };
}
