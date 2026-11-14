// src/components/BlueprintAgent/session.ts
// Remembers the conversation id for this browser tab so an accidental refresh resumes the same
// conversation. There is no login, so the id is just an unguessable random token.
//
// Where it is kept, and why:
//  1. history.state (primary). It survives a reload of the same tab, is not a cookie or a storage
//     write (so it does not need cookie consent: the site's consent engine blocks unlisted storage
//     keys until the visitor accepts), and is NOT part of the URL, so copying or sharing the link
//     never shares someone's plan.
//  2. sessionStorage (secondary). Works for visitors who have consented; harmless otherwise.
// Both can be unavailable or throw (private mode, blocked, wrapped by a consent engine), so every
// call is guarded and the feature degrades to "a refresh starts a fresh conversation".

const KEY = 'webmaxxers.blueprint.session';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isSessionId = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Hist = Pick<History, 'state' | 'replaceState'>;

function safeStorage(): Store | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}
function safeHistory(): Hist | null {
  try {
    return typeof history === 'undefined' ? null : history;
  } catch {
    return null;
  }
}

const stateObject = (h: Hist): Record<string, unknown> => {
  const s = h.state as unknown;
  return typeof s === 'object' && s !== null && !Array.isArray(s) ? (s as Record<string, unknown>) : {};
};

export function loadSessionId(storage: Store | null = safeStorage(), hist: Hist | null = safeHistory()): string | null {
  try {
    const fromHistory = hist ? stateObject(hist)[KEY] : undefined;
    if (isSessionId(fromHistory)) return fromHistory;
  } catch {
    /* fall through */
  }
  try {
    const fromStorage = storage?.getItem(KEY);
    return isSessionId(fromStorage) ? fromStorage : null;
  } catch {
    return null;
  }
}

export function saveSessionId(id: string, storage: Store | null = safeStorage(), hist: Hist | null = safeHistory()): void {
  if (!isSessionId(id)) return;
  try {
    // Keep whatever the page/router already keeps in history.state; only add our key.
    if (hist) hist.replaceState({ ...stateObject(hist), [KEY]: id }, '');
  } catch {
    /* ignore */
  }
  try {
    storage?.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}

export function clearSessionId(storage: Store | null = safeStorage(), hist: Hist | null = safeHistory()): void {
  try {
    if (hist) {
      const { [KEY]: _removed, ...rest } = stateObject(hist);
      hist.replaceState(Object.keys(rest).length > 0 ? rest : null, '');
    }
  } catch {
    /* ignore */
  }
  try {
    storage?.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
