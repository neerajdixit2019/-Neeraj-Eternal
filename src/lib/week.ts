import { istWeekStartKey, istIsSunday } from "./ist.ts";

// The weekly letter follows the reader's week in India, not the server's UTC
// week — otherwise "this week" and "is it Sunday yet?" shift by 5.5 hours and
// the letter can land on the wrong day. Anchored to IST (see ist.ts).

/** ISO date (YYYY-MM-DD) of the Monday that starts the current IST week. */
export function currentWeekStartISO(now: Date = new Date()): string {
  return istWeekStartKey(now);
}

/** True when it is Sunday in India (when the weekly letter is offered). */
export function isSundayLocal(now: Date = new Date()): boolean {
  return istIsSunday(now);
}
