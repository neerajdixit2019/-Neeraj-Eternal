/**
 * Roving arrow-key navigation for custom radio groups (the check-in orbs,
 * the lamp-dial). Arrows move FOCUS only — selection stays on Space/Enter,
 * because selecting a mood triggers real work (logging, AI follow-ups) that
 * must never fire once per keystroke.
 */
export function radioArrowNav(e: React.KeyboardEvent<HTMLElement>) {
  if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key)) return;
  const group = (e.currentTarget as HTMLElement).closest('[role="radiogroup"]');
  if (!group) return;
  e.preventDefault();
  const radios = Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]'));
  const i = radios.indexOf(e.currentTarget as HTMLElement);
  if (i === -1) return;
  const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
  radios[(i + dir + radios.length) % radios.length]?.focus();
}
