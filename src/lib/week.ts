// Returns the ISO date (YYYY-MM-DD) of the Monday on or before today (local time).
export function currentWeekStartISO(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = d.getDay(); // 0..6, Sun..Sat
  const offset = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function isSundayLocal(now: Date = new Date()): boolean {
  return now.getDay() === 0;
}