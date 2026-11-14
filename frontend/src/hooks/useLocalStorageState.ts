// src/hooks/useLocalStorageState.ts
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

type Validator<T> =
  | ((value: unknown) => value is T)
  | ((value: unknown) => boolean);

interface UseLocalStorageStateOptions<T> {
  raw?: boolean;
  validate?: Validator<T>;
  syncTabs?: boolean;
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
}

/**
 * A minimal, SSR-safe localStorage-backed state hook.
 *
 * Features:
 * - Synchronous initial value (reads LS once; falls back to `initialValue`)
 * - Optional validator to reject bad values
 * - Optional JSON mode (default is raw string/primitive storage)
 * - Cross-tab sync via "storage" events
 */
export default function useLocalStorageState<T>(
  key: string,
  initialValue: T | (() => T),
  {
    raw = true,
    validate,
    syncTabs = true,
    serialize = raw
      ? ((value: T) => String(value))
      : ((value: T) => JSON.stringify(value)),
    deserialize = raw
      ? ((value: string) => value as unknown as T)
      : ((value: string) => JSON.parse(value) as T),
  }: UseLocalStorageStateOptions<T> = {}
): [T, Dispatch<SetStateAction<T>>] {
  const initialRef = useRef<T | (() => T)>(initialValue);

  const resolveInitial = useCallback((): T => {
    const val = initialRef.current;
    return typeof val === "function" ? (val as () => T)() : val;
  }, []);

  const getInitial = useCallback((): T => {
    if (typeof window === "undefined") {
      return resolveInitial();
    }
    try {
      const rawVal = window.localStorage.getItem(key);
      if (rawVal != null) {
        const parsed = deserialize(rawVal);
        if (!validate || validate(parsed)) return parsed;
      }
    } catch {}
    return resolveInitial();
  }, [key, deserialize, validate, resolveInitial]);

  const [value, setValue] = useState<T>(getInitial);
  const hasHydratedRef = useRef(false);

  // Persist on change
  useEffect(() => {
    if (typeof window === "undefined") return;

    // During the first client render, sync from existing storage before writing.
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
      try {
        const rawVal = window.localStorage.getItem(key);
        if (rawVal != null) {
          const parsed = deserialize(rawVal);
          if (!validate || validate(parsed)) {
            if (parsed !== value) {
              setValue(parsed);
            }
            return; // defer writing; we'll write after state reflects storage
          }
        }
      } catch {}
      // fall through if there's no stored value or it was invalid
    }

    try {
      if (validate && !validate(value)) return;
      window.localStorage.setItem(key, serialize(value));
    } catch {}
  }, [key, value, serialize, validate, deserialize]);

  // Cross-tab sync
  useEffect(() => {
    if (!syncTabs || typeof window === "undefined") return;

    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== window.localStorage) return;
      if (e.key !== key) return;
      try {
        if (e.newValue == null) return; // ignore removals
        const next = deserialize(e.newValue);
        if (!validate || validate(next)) setValue(next);
      } catch {}
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key, deserialize, validate, syncTabs]);

  return [value, setValue];
}
