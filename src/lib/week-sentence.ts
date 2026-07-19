import type { Lang } from "./i18n";

/**
 * The honest week for the You hub, spoken as one sentence. Real counts only,
 * never invented percentages. Pure + dependency-light so it can be unit-tested.
 *
 * Gender-neutral in both tongues: the Hindi verbs agree with the NOUNS
 * (दिन / पन्ने / हाल), never with the reader, so it never mis-genders anyone.
 */
export type Week = { daysShowedUp: number; checkins: number; pages: number };

const SMALL_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"] as const;
const word = (n: number) => SMALL_WORDS[n] ?? String(n);
const SMALL_WORDS_HI = ["शून्य", "एक", "दो", "तीन", "चार", "पाँच", "छह", "सात", "आठ", "नौ", "दस"] as const;
const wordHi = (n: number) => SMALL_WORDS_HI[n] ?? String(n);

export function weekSentence(week: Week, lang: Lang): string {
  if (lang === "hi") return weekSentenceHi(week);
  if (week.daysShowedUp === 0) {
    return "this book is just beginning — its first page is yours whenever you're ready.";
  }
  const days = `you came back ${week.daysShowedUp === 1 ? "one day" : `${word(week.daysShowedUp)} days`} this week`;
  const pages = week.pages > 0 ? ` and kept ${week.pages === 1 ? "one page" : `${word(week.pages)} pages`}` : "";
  const felt = week.checkins === 1 ? "once" : `${word(week.checkins)} times`;
  // With pages the check-ins ride along as a participle; without, they need
  // their own finite verb ("…and named how it felt twice").
  const checkins = week.checkins > 0
    ? (pages ? `, naming how it felt ${felt}` : ` and named how it felt ${felt}`)
    : "";
  return `${days}${pages}${checkins}.`;
}

function weekSentenceHi(week: Week): string {
  if (week.daysShowedUp === 0) {
    return "यह किताब अभी शुरू ही हुई है — इसका पहला पन्ना आपका है, जब भी आप तैयार हों।";
  }
  const parts: string[] = [];
  parts.push(week.daysShowedUp === 1
    ? "एक दिन आपके साथ बीता"
    : `${wordHi(week.daysShowedUp)} दिन आपके साथ बीते`);
  if (week.pages > 0) {
    parts.push(week.pages === 1 ? "एक पन्ना रखा गया" : `${wordHi(week.pages)} पन्ने रखे गए`);
  }
  if (week.checkins > 0) {
    parts.push(`${week.checkins === 1 ? "एक" : wordHi(week.checkins)} बार मन का हाल दर्ज हुआ`);
  }
  const body = parts.length === 1
    ? parts[0]
    : `${parts.slice(0, -1).join(", ")} और ${parts[parts.length - 1]}`;
  return `इस हफ़्ते ${body}।`;
}
