/**
 * Session persistence policy for the "Remember me" option.
 *
 * The generated Supabase client always stores its token in localStorage.
 * When the user does NOT choose "Remember me", we mirror the token into
 * sessionStorage and drop it from localStorage when the tab/browser closes,
 * so the session cannot survive a browser restart.
 */

const FLAG_KEY = "ncvc-session-only";
const MIRROR_KEY = "ncvc-session-token";
export const LAST_ACTIVITY_KEY = "ncvc-last-activity";
export const SESSION_START_KEY = "ncvc-session-start";

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

function tokenKeys(): string[] {
  if (!hasWindow()) return [];
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) keys.push(key);
  }
  return keys;
}

export function isSessionOnly(): boolean {
  if (!hasWindow()) return false;
  return localStorage.getItem(FLAG_KEY) === "1";
}

/** Copies the current auth token into sessionStorage (session-only mode). */
export function mirrorSessionToken(): void {
  if (!hasWindow() || !isSessionOnly()) return;
  const key = tokenKeys()[0];
  if (!key) return;
  const value = localStorage.getItem(key);
  if (!value) return;
  try {
    sessionStorage.setItem(MIRROR_KEY, JSON.stringify({ key, value }));
  } catch {
    /* storage may be unavailable */
  }
}

/** Removes the persistent copy of the token, keeping only the per-tab mirror. */
export function dropPersistentToken(): void {
  if (!hasWindow() || !isSessionOnly()) return;
  mirrorSessionToken();
  for (const key of tokenKeys()) localStorage.removeItem(key);
}

/** Chooses whether the session should survive a browser restart. */
export function setRememberMe(remember: boolean): void {
  if (!hasWindow()) return;
  if (remember) {
    localStorage.removeItem(FLAG_KEY);
    try {
      sessionStorage.removeItem(MIRROR_KEY);
    } catch {
      /* ignore */
    }
    return;
  }
  localStorage.setItem(FLAG_KEY, "1");
  mirrorSessionToken();
}

/** Clears every session bookkeeping value (used on sign out). */
export function clearSessionBookkeeping(): void {
  if (!hasWindow()) return;
  localStorage.removeItem(FLAG_KEY);
  localStorage.removeItem(LAST_ACTIVITY_KEY);
  localStorage.removeItem(SESSION_START_KEY);
  try {
    sessionStorage.removeItem(MIRROR_KEY);
  } catch {
    /* ignore */
  }
}

export function markActivity(now = Date.now()): void {
  if (!hasWindow()) return;
  localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
}

export function readActivity(): number {
  if (!hasWindow()) return Date.now();
  const raw = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
  return Number.isFinite(raw) && raw > 0 ? raw : Date.now();
}

export function ensureSessionStart(): number {
  if (!hasWindow()) return Date.now();
  const raw = Number(localStorage.getItem(SESSION_START_KEY));
  if (Number.isFinite(raw) && raw > 0) return raw;
  const now = Date.now();
  localStorage.setItem(SESSION_START_KEY, String(now));
  return now;
}

export function resetSessionStart(): void {
  if (!hasWindow()) return;
  localStorage.setItem(SESSION_START_KEY, String(Date.now()));
}

/**
 * Runs once before the Supabase client reads storage:
 * restores a per-tab session, or discards a session-only token left behind
 * by a previous browser session.
 */
export function applySessionStoragePolicy(): void {
  if (!hasWindow() || !isSessionOnly()) return;
  let mirror: string | null = null;
  try {
    mirror = sessionStorage.getItem(MIRROR_KEY);
  } catch {
    mirror = null;
  }
  if (mirror) {
    try {
      const parsed = JSON.parse(mirror) as { key?: string; value?: string };
      if (parsed.key && parsed.value) localStorage.setItem(parsed.key, parsed.value);
      return;
    } catch {
      /* fall through to cleanup */
    }
  }
  // New browser session with no per-tab mirror: the session must not survive.
  for (const key of tokenKeys()) localStorage.removeItem(key);
  clearSessionBookkeeping();
}

if (hasWindow()) {
  applySessionStoragePolicy();
}
