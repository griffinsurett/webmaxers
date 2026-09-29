import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

const THEME_KEY = "theme";

const resolveStoredTheme = (): ThemeMode | null => {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
};

const resolveSystemTheme = (): ThemeMode => {
  if (typeof window === "undefined") return "dark";

  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
};

export function UseMode() {
  const [storedTheme, setStoredTheme] = useState<ThemeMode | null>(() =>
    resolveStoredTheme()
  );
  const [systemTheme, setSystemTheme] = useState<ThemeMode>(() =>
    resolveSystemTheme()
  );

  const theme = storedTheme ?? systemTheme;

  const isLight = theme === "light";
  const setIsLight = (value: boolean) => {
    const nextTheme = value ? "light" : "dark";
    setStoredTheme(nextTheme);

    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(THEME_KEY, nextTheme);
    } catch {
      // Ignore storage write failures and keep the in-memory theme.
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const handleChange = (event: MediaQueryListEvent) => {
      if (resolveStoredTheme() !== null) return;
      setSystemTheme(event.matches ? "light" : "dark");
    };

    setSystemTheme(mediaQuery.matches ? "light" : "dark");

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) return;
      if (event.key !== THEME_KEY) return;

      const nextTheme =
        event.newValue === "light" || event.newValue === "dark"
          ? event.newValue
          : null;

      setStoredTheme(nextTheme);
      if (nextTheme === null) {
        setSystemTheme(resolveSystemTheme());
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const nextTheme = isLight ? "light" : "dark";

    root.setAttribute("data-theme", nextTheme);
    root.style.colorScheme = nextTheme;

    const computed = getComputedStyle(root)
      .getPropertyValue("--color-bg3")
      .trim();

    if (computed) {
      let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "theme-color";
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", computed);
    }
  }, [isLight]);

  return [isLight, setIsLight] as const;
}
