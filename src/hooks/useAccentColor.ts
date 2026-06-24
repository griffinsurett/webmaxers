import { useEffect } from "react";
import useLocalStorage from "./useLocalStorage";
import { ACCENT_COLORS, type AccentColor } from "@/utils/theme";

export function useAccentColor() {
  const getDefaultAccent = (): AccentColor => ACCENT_COLORS[0];
  const [accent, setAccent] = useLocalStorage<AccentColor>(
    "accent",
    getDefaultAccent,
    {
      raw: true,
      validate: (value): value is AccentColor =>
        ACCENT_COLORS.includes(value as AccentColor),
      syncTabs: true,
    }
  );

  useEffect(() => {
    document.documentElement.style.setProperty("--color-accent", accent);
  }, [accent]);

  return {
    accent,
    setAccent,
    accents: ACCENT_COLORS,
  } as const;
}

export { ACCENT_COLORS } from "@/utils/theme";
export type { AccentColor } from "@/utils/theme";
