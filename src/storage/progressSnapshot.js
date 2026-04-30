export const LOCAL_STORAGE_KEYS = {
  flow: "neeraj-eternal-emotional-flow",
  pause: "neeraj-eternal-pause-before-text",
  journeys: "neeraj-eternal-healing-journeys",
  museum: "museum_unsaid_notes",
  wisdom: "neeraj-eternal-wisdom-chat",
  daily: "neeraj-eternal-daily-sanctuary",
  calm: "neeraj-eternal-guided-calm",
  pressure: "neeraj-eternal-pressure-reset",
  care: "neeraj-eternal-care-kit",
  welcome: "neeraj-eternal-welcome",
  aftercare: "neeraj-eternal-aftercare"
};

function readJson(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    if (!value) return fallback;
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
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
  const latestDaily = latestByTime(Object.values(daily || {}));

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    welcome: {
      reasonId: welcome.reasonId || "",
      selectedAt: welcome.selectedAt || ""
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
