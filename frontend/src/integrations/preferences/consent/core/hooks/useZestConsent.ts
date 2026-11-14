import { useCallback, useEffect, useState } from "react";
import type { ConsentCategory } from "../consentConfig";

type ConsentState = Partial<Record<ConsentCategory, boolean>>;

interface ZestApi {
  hasConsentDecision(): boolean;
  getConsent(): ConsentState | null;
  acceptAll(): unknown;
  rejectAll(): unknown;
  updateConsent(selections: ConsentState): unknown;
}

interface ZestWindow extends Window {
  Zest?: ZestApi;
  __webmaxxersZestInitSnapshot?: { geoPending?: boolean };
}

function getZest(): ZestApi | null {
  if (typeof window === "undefined") return null;
  return (window as ZestWindow).Zest ?? null;
}

function readGeoPending(): boolean {
  if (typeof window === "undefined") return true;
  return (
    (window as ZestWindow).__webmaxxersZestInitSnapshot?.geoPending === true
  );
}

export function useZestConsent() {
  const [decided, setDecided] = useState<boolean | null>(null);
  const [geoPending, setGeoPending] = useState<boolean | null>(null);
  const [consent, setConsent] = useState<ConsentState>({});

  const sync = useCallback(() => {
    const zest = getZest();
    if (!zest) return;
    setDecided(zest.hasConsentDecision());
    setGeoPending(readGeoPending());
    setConsent(zest.getConsent() ?? {});
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener("zest:change", sync);
    window.addEventListener("zest:geo", sync);
    return () => {
      window.removeEventListener("zest:change", sync);
      window.removeEventListener("zest:geo", sync);
    };
  }, [sync]);

  return {
    decided,
    geoPending,
    consent,
    acceptAll: useCallback(() => getZest()?.acceptAll(), []),
    rejectAll: useCallback(() => getZest()?.rejectAll(), []),
    updateConsent: useCallback(
      (selections: ConsentState) => getZest()?.updateConsent(selections),
      [],
    ),
  };
}

export const OPEN_SETTINGS_EVENT = "open-cookie-preferences";

export function requestCookieSettings() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT));
  }
}

export function useCookieSettingsRequests(onRequest: () => void) {
  useEffect(() => {
    window.addEventListener(OPEN_SETTINGS_EVENT, onRequest);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, onRequest);
  }, [onRequest]);
}
