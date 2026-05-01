export const LOCAL_STORAGE_KEYS = {
  flow: "eternal-emotional-flow",
  pause: "eternal-pause-before-text",
  journeys: "eternal-healing-journeys",
  museum: "eternal-museum-unsaid-notes",
  wisdom: "eternal-wisdom-chat",
  daily: "eternal-daily-sanctuary",
  calm: "eternal-guided-calm",
  pressure: "eternal-pressure-reset",
  care: "eternal-care-kit",
  welcome: "eternal-welcome",
  aftercare: "eternal-aftercare",
  compass: "eternal-compass",
  onboarding: "eternal-onboarding-preferences"
};

const LEGACY_STORAGE_PREFIX = ["nee", "raj", "-eternal-"].join("");
const LEGACY_LOCAL_STORAGE_KEYS = {
  flow: `${LEGACY_STORAGE_PREFIX}emotional-flow`,
  pause: `${LEGACY_STORAGE_PREFIX}pause-before-text`,
  journeys: `${LEGACY_STORAGE_PREFIX}healing-journeys`,
  museum: ["museum", "_unsaid", "_notes"].join(""),
  wisdom: `${LEGACY_STORAGE_PREFIX}wisdom-chat`,
  daily: `${LEGACY_STORAGE_PREFIX}daily-sanctuary`,
  calm: `${LEGACY_STORAGE_PREFIX}guided-calm`,
  pressure: `${LEGACY_STORAGE_PREFIX}pressure-reset`,
  care: `${LEGACY_STORAGE_PREFIX}care-kit`,
  welcome: `${LEGACY_STORAGE_PREFIX}welcome`,
  aftercare: `${LEGACY_STORAGE_PREFIX}aftercare`,
  compass: `${LEGACY_STORAGE_PREFIX}compass`,
  onboarding: `${LEGACY_STORAGE_PREFIX}onboarding-preferences`
};

function getLegacyKey(key) {
  const entry = Object.entries(LOCAL_STORAGE_KEYS).find(([, value]) => value === key);
  return entry ? LEGACY_LOCAL_STORAGE_KEYS[entry[0]] : null;
}

function readJson(key, fallback) {
  try {
    const legacyKey = getLegacyKey(key);
    const value = window.localStorage.getItem(key) || (legacyKey ? window.localStorage.getItem(legacyKey) : null);
    if (!value) return fallback;
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function readRaw(key) {
  try {
    const legacyKey = getLegacyKey(key);
    return window.localStorage.getItem(key) || (legacyKey ? window.localStorage.getItem(legacyKey) : null);
  } catch {
    return null;
  }
}

function byteSize(value) {
  return new Blob([value || ""]).size;
}

function latestByTime(values) {
  return values
    .filter(Boolean)
    .sort((a, b) => new Date(b.savedAt || b.createdAt || b.updatedAt || 0) - new Date(a.savedAt || a.createdAt || a.updatedAt || 0))[0] || null;
}

function summarizeJourneys(journeys) {
  return Object.fromEntries(
    Object.entries(journeys || {}).map(([journeyId, state]) => [
      journeyId,
      {
        currentDay: Number(state?.currentDay || 1),
        savedDays: Array.isArray(state?.entries) ? state.entries.map((entry) => entry.day).filter(Boolean) : [],
        entryCount: Array.isArray(state?.entries) ? state.entries.length : 0
      }
    ])
  );
}

export function getSyncableProgressSnapshot() {
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
  const onboarding = readJson(LOCAL_STORAGE_KEYS.onboarding, {});
  const latestDaily = latestByTime(Object.values(daily || {}));

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    welcome: {
      reasonId: welcome.reasonId || "",
      selectedAt: welcome.selectedAt || ""
    },
    onboarding: {
      arrivalId: onboarding.arrivalId || "",
      supportStyleId: onboarding.supportStyleId || "",
      recommendedRoute: onboarding.recommendedRoute || "",
      completedAt: onboarding.completedAt || ""
    },
    emotionalFlow: {
      emotionId: flow.emotionId || "",
      hasJournalText: Boolean(flow.journalText),
      updatedAt: flow.updatedAt || ""
    },
    daily: {
      completedDates: Object.keys(daily || {}),
      latestEmotionId: latestDaily?.emotionId || "",
      latestAction: latestDaily?.action || "",
      latestSavedAt: latestDaily?.savedAt || ""
    },
    calm: {
      completedCount: Number(calm.completedCount || 0),
      latestExerciseId: calm.latestExerciseId || "",
      latestCompletedAt: calm.latestCompletedAt || ""
    },
    pressure: {
      latestAreaId: pressure?.latest?.areaId || "",
      historyCount: Array.isArray(pressure.history) ? pressure.history.length : 0,
      latestSavedAt: pressure?.latest?.savedAt || ""
    },
    care: {
      hasTrustedPerson: Boolean(care.person),
      hasSafePlace: Boolean(care.place),
      hasAction: Boolean(care.action),
      hasReminder: Boolean(care.reminder),
      updatedAt: care.updatedAt || ""
    },
    journeys: summarizeJourneys(journeys),
    museum: {
      noteCount: Array.isArray(museum) ? museum.length : 0
    },
    wisdom: {
      messageCount: Array.isArray(wisdom.messages) ? wisdom.messages.length : 0,
      updatedAt: wisdom.updatedAt || ""
    },
    pause: {
      hasAnswers: Boolean(pause.answers),
      choice: pause.choice || ""
    },
    aftercare: {
      latestActionId: aftercare?.latest?.actionId || "",
      savedCount: Array.isArray(aftercare.history) ? aftercare.history.length : 0
    }
  };
}

export function getLocalDataVaultSnapshot() {
  const rawEntries = Object.entries(LOCAL_STORAGE_KEYS).map(([id, key]) => {
    const rawValue = readRaw(key);
    return {
      id,
      key,
      exists: rawValue !== null,
      bytes: byteSize(rawValue || "")
    };
  });

  const progress = getSyncableProgressSnapshot();
  const totalBytes = rawEntries.reduce((sum, entry) => sum + entry.bytes, 0);

  return {
    generatedAt: new Date().toISOString(),
    totalBytes,
    totalKeys: rawEntries.filter((entry) => entry.exists).length,
    entries: rawEntries,
    summary: {
      dailyDays: progress.daily.completedDates.length,
      calmSessions: progress.calm.completedCount,
      journeyCount: Object.keys(progress.journeys).length,
      museumNotes: progress.museum.noteCount,
      wisdomMessages: progress.wisdom.messageCount,
      hasJournalText: progress.emotionalFlow.hasJournalText,
      hasCareKit: progress.care.hasTrustedPerson || progress.care.hasSafePlace || progress.care.hasAction || progress.care.hasReminder
    }
  };
}

export function getLocalDataArchive() {
  return {
    exportedAt: new Date().toISOString(),
    app: "Eternal",
    warning: "This export can include private local writing. Keep it somewhere safe.",
    storage: Object.fromEntries(
      Object.entries(LOCAL_STORAGE_KEYS).map(([id, key]) => [id, {
        key,
        value: readRaw(key)
      }])
    )
  };
}

export function clearLocalAppData() {
  Object.values(LOCAL_STORAGE_KEYS).forEach((key) => {
    window.localStorage.removeItem(key);
  });
  Object.values(LEGACY_LOCAL_STORAGE_KEYS).forEach((key) => {
    window.localStorage.removeItem(key);
  });
}
