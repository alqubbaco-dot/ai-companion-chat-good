import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { readStored, writeStored } from "./storage";

export type Theme = "light" | "dark";

// ثيمات الألوان (ميزة "themes" بالنقاط). "default" = ألوان التطبيق الأصلية
export type Accent = "default" | "emerald" | "rose" | "sunset" | "ocean" | "midnight";

export const ACCENTS: { id: Accent; label: string; swatch: string }[] = [
  { id: "default", label: "الأصلي", swatch: "oklch(0.58 0.22 275)" },
  { id: "emerald", label: "زمردي", swatch: "oklch(0.56 0.19 160)" },
  { id: "rose", label: "وردي", swatch: "oklch(0.56 0.22 0)" },
  { id: "sunset", label: "غروب", swatch: "oklch(0.62 0.2 45)" },
  { id: "ocean", label: "محيط", swatch: "oklch(0.56 0.2 225)" },
  { id: "midnight", label: "ليلي", swatch: "oklch(0.5 0.24 300)" },
];

type ThemeValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  accent: Accent;
  setAccent: (accent: Accent) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [accent, setAccentState] = useState<Accent>("default");

  useEffect(() => {
    setThemeState(readStored<Theme>("theme", "light"));
    const saved = readStored<Accent>("accent", "default");
    setAccentState(ACCENTS.some((a) => a.id === saved) ? saved : "default");
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (accent === "default") delete document.documentElement.dataset.accent;
    else document.documentElement.dataset.accent = accent;
  }, [accent]);

  const setAccent = useCallback((next: Accent) => {
    setAccentState(next);
    writeStored("accent", next);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    writeStored("theme", next);
  }, []);

  const value = useMemo<ThemeValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
      accent,
      setAccent,
    }),
    [theme, setTheme, accent, setAccent],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
