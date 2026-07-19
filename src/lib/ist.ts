/**
 * India Standard Time — the app's sense of "a day" and "the time of day".
 *
 * My Quiet Space is for youth in India, so a check-in at 11pm and one at 1am
 * should feel like different days the way the reader lives them, and the
 * morning/evening rooms should follow the sun over India — NOT the UTC clock
 * the server runs on, and NOT a possibly-misconfigured device clock. Every
 * day-boundary, weekday, and hour decision is therefore anchored to IST
 * (Asia/Kolkata).
 *
 * IST is a fixed UTC+5:30 — India has not observed daylight saving since the
 * 1940s — so these are PURE and DETERMINISTIC: for the same instant they
 * return the same civil fields on the server and the client, which also makes
 * them SSR-safe (no hydration drift from a server/client timezone gap). This
 * module is React-free so the pattern engine can import it under node:test.
 */

/** Minutes east of UTC. Fixed; IST observes no DST. */
export const IST_OFFSET_MIN = 330; // +05:30

type Instant = Date | number | string;
const toMs = (d: Instant): number =>
  typeof d === "number" ? d : typeof d === "string" ? Date.parse(d) : d.getTime();

export interface IstParts {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
  hour: number; // 0..23
  minute: number; // 0..59
  weekday: number; // 0..6, Sunday..Saturday
}

/** The wall-clock (civil) fields of an instant, as read in India. */
export function istParts(d: Instant = Date.now()): IstParts {
  // Shift the instant by +5:30, then read its UTC fields — those ARE the IST
  // wall-clock fields, computed identically wherever this runs.
  const s = new Date(toMs(d) + IST_OFFSET_MIN * 60_000);
  return {
    year: s.getUTCFullYear(),
    month: s.getUTCMonth() + 1,
    day: s.getUTCDate(),
    hour: s.getUTCHours(),
    minute: s.getUTCMinutes(),
    weekday: s.getUTCDay(),
  };
}

/** "YYYY-MM-DD" for the IST calendar day of an instant. */
export function istDayKey(d: Instant = Date.now()): string {
  const p = istParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Hour 0..23 in IST. */
export function istHour(d: Instant = Date.now()): number {
  return istParts(d).hour;
}

/** Weekday 0..6 (Sun..Sat) in IST. */
export function istWeekday(d: Instant = Date.now()): number {
  return istParts(d).weekday;
}

/** Day-of-month 1..31 in IST (seed for once-a-day rotations). */
export function istDayOfMonth(d: Instant = Date.now()): number {
  return istParts(d).day;
}

/** The UTC instant at which the IST day of `d` begins (00:00 IST). */
export function istStartOfDay(d: Instant = Date.now()): Date {
  const p = istParts(d);
  return new Date(Date.UTC(p.year, p.month - 1, p.day) - IST_OFFSET_MIN * 60_000);
}

/** "YYYY-MM-DD" of the IST Monday that starts the ISO week containing `d`. */
export function istWeekStartKey(d: Instant = Date.now()): string {
  const offset = (istWeekday(d) + 6) % 7; // days since Monday
  return istDayKey(istStartOfDay(d).getTime() - offset * 86_400_000);
}

/** True when it is Sunday in India (the weekly-letter day). */
export function istIsSunday(d: Instant = Date.now()): boolean {
  return istWeekday(d) === 0;
}

/**
 * Coarse time-of-day band in IST, shared by the adaptive room, the arrival
 * greeting, and the companion's context. Boundaries: late night <5, morning
 * <12, afternoon <17, evening <21, else night.
 */
export type TimeOfDay = "late night" | "morning" | "afternoon" | "evening" | "night";
export function istTimeOfDay(d: Instant = Date.now()): TimeOfDay {
  const h = istHour(d);
  return h < 5 ? "late night" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night";
}
