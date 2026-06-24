import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark" | "system";
type Density = "compact" | "normal" | "comfortable";

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  density: Density;
  setDensity: (d: Density) => void;
  accentColor: string;
  setAccentColor: (c: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "system",
  setTheme: () => {},
  density: "normal",
  setDensity: () => {},
  accentColor: "azul",
  setAccentColor: () => {},
});

export const useTheme = () => useContext(ThemeContext);

const ACCENT_COLORS: Record<string, { light: string; dark: string; ring: string }> = {
  azul: { light: "205 90% 60%", dark: "205 90% 65%", ring: "205 90% 60%" },
  turquesa: { light: "166 64% 49%", dark: "166 64% 49%", ring: "166 64% 49%" },
  roxo: { light: "268 57% 36%", dark: "268 57% 42%", ring: "268 57% 36%" },
  emerald: { light: "160 84% 39%", dark: "160 84% 39%", ring: "160 84% 39%" },
  orange: { light: "25 95% 53%", dark: "25 95% 53%", ring: "25 95% 53%" },
  rose: { light: "347 77% 50%", dark: "347 77% 50%", ring: "347 77% 50%" },
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem("fc-theme") as Theme) || "light");
  const [density, setDensityState] = useState<Density>(() => (localStorage.getItem("fc-density") as Density) || "normal");
  const [accentColor, setAccentState] = useState(() => {
    const stored = localStorage.getItem("fc-accent");
    // Migração: turquesa antigo vira azul (novo padrão)
    if (stored === "turquesa") { localStorage.setItem("fc-accent", "azul"); return "azul"; }
    return stored || "azul";
  });

  const applyTheme = (t: Theme) => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    if (t === "system") {
      const sys = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(sys);
    } else {
      root.classList.add(t);
    }
  };

  const applyAccent = (color: string) => {
    const root = document.documentElement;
    const isDark = root.classList.contains("dark");
    const palette = ACCENT_COLORS[color] || ACCENT_COLORS.azul;
    const val = isDark ? palette.dark : palette.light;
    root.style.setProperty("--primary", val);
    root.style.setProperty("--ring", palette.ring);
    root.style.setProperty("--sidebar-primary", val);
    root.style.setProperty("--sidebar-ring", palette.ring);
  };

  useEffect(() => {
    applyTheme(theme);
    applyAccent(accentColor);
  }, [theme, accentColor]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => { if (theme === "system") { applyTheme("system"); applyAccent(accentColor); } };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme, accentColor]);

  const setTheme = (t: Theme) => { setThemeState(t); localStorage.setItem("fc-theme", t); };
  const setDensity = (d: Density) => { setDensityState(d); localStorage.setItem("fc-density", d); };
  const setAccentColor = (c: string) => { setAccentState(c); localStorage.setItem("fc-accent", c); };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, density, setDensity, accentColor, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
}
