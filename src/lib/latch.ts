/**
 * The latch — a door that locks from the inside.
 *
 * An optional 4-digit key for THIS device. It is glance protection for a
 * held or borrowed phone, not encryption: the data is already guarded by
 * the account (RLS) and never leaves the server unprotected. The key never
 * leaves the device — only a salted, iterated hash is stored locally.
 *
 * Safety properties (load-bearing, pinned by tests):
 *  - The steady room (/sos) is NEVER behind the latch. Crisis beats privacy.
 *  - Wrong attempts are gently paced but can never lock anyone out.
 *  - Forgetting the key costs a sign-in, nothing more.
 */

const STORE_KEY = "mqs-latch";
const HIDDEN_AT_KEY = "mqs-latch-hidden-at";
const MISSES_KEY = "mqs-latch-misses";

/** Hidden longer than this and the latch asks for the key again. */
export const RELATCH_AFTER_MS = 90_000;
/** PBKDF2 rounds — raises the cost of offline recovery from the stored
 * record. A 4-digit space can never be made safe, which is why the UI
 * tells people not to reuse a PIN that matters elsewhere. */
const ITERATIONS = 210_000;
/** Pacing after misses is capped: slow a guesser, never bar the door. */
export const MAX_ATTEMPT_DELAY_MS = 5_000;

type LatchRecord = { salt: string; hash: string; iters: number };

function subtle(): SubtleCrypto {
  return globalThis.crypto.subtle;
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPin(pin: string, salt: string, iters: number): Promise<string> {
  const enc = new TextEncoder();
  const key = await subtle().importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle().deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: iters },
    key,
    256,
  );
  return toHex(bits);
}

export function makeSalt(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return toHex(bytes.buffer as ArrayBuffer);
}

/** A valid key is exactly four digits — small on purpose; it's a latch, not a vault. */
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/**
 * Gentle pacing: 0 for the first try, then 600ms per miss, capped so a
 * panicked or forgetful person is slowed by at most a few seconds.
 */
export function attemptDelayMs(misses: number): number {
  if (misses <= 0) return 0;
  return Math.min(misses * 600, MAX_ATTEMPT_DELAY_MS);
}

/** Should a return from the background ask for the key again? */
export function shouldRelatch(hiddenAtMs: number | null, nowMs: number): boolean {
  if (hiddenAtMs == null) return false;
  return nowMs - hiddenAtMs >= RELATCH_AFTER_MS;
}

/* ── device storage (browser only) ─────────────────────────────────── */

function read(): LatchRecord | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as LatchRecord;
    return rec.salt && rec.hash && rec.iters ? rec : null;
  } catch {
    return null;
  }
}

export function latchEnabled(): boolean {
  return read() != null;
}

export async function setPin(pin: string): Promise<void> {
  if (!isValidPin(pin)) throw new Error("The key is four digits.");
  const salt = makeSalt();
  const hash = await hashPin(pin, salt, ITERATIONS);
  localStorage.setItem(STORE_KEY, JSON.stringify({ salt, hash, iters: ITERATIONS }));
}

export function clearPin(): void {
  try {
    localStorage.removeItem(STORE_KEY);
    sessionStorage.removeItem(HIDDEN_AT_KEY);
    sessionStorage.removeItem(MISSES_KEY);
  } catch {
    /* ignore */
  }
}

export async function verifyPin(pin: string): Promise<boolean> {
  const rec = read();
  if (!rec) return true;
  if (!isValidPin(pin)) return false;
  return (await hashPin(pin, rec.salt, rec.iters)) === rec.hash;
}

/* hidden-time bookkeeping — sessionStorage so a closed tab always relatches */

export function noteHidden(nowMs: number): void {
  try {
    sessionStorage.setItem(HIDDEN_AT_KEY, String(nowMs));
  } catch {
    /* ignore */
  }
}

export function readHiddenAt(): number | null {
  try {
    const raw = sessionStorage.getItem(HIDDEN_AT_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

export function clearHidden(): void {
  try {
    sessionStorage.removeItem(HIDDEN_AT_KEY);
  } catch {
    /* ignore */
  }
}

/* miss-count bookkeeping — persisted so pacing survives reloads and the
 * gate's own escape doors; cleared the moment the right key opens it */

export function readMisses(): number {
  try {
    const n = Number(sessionStorage.getItem(MISSES_KEY) ?? "0");
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function noteMiss(): number {
  const next = readMisses() + 1;
  try {
    sessionStorage.setItem(MISSES_KEY, String(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function clearMisses(): void {
  try {
    sessionStorage.removeItem(MISSES_KEY);
  } catch {
    /* ignore */
  }
}
