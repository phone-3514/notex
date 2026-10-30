// The three colour themes: the plain light page, the tmux-style dark one
// ("dark"), and a simple black-and-green terminal one ("terminal"). Both
// dark-ish themes carry the `dark` class on <html> — so every existing
// `dark:` utility applies to them — and the terminal one adds
// `theme-terminal` on top to override the palette (see globals.css).

export type Theme = "light" | "dark" | "terminal";

export const THEMES: { theme: Theme; label: string }[] = [
  { theme: "light", label: "Light" },
  { theme: "dark", label: "Dark" },
  { theme: "terminal", label: "Term" },
];

export const DEFAULT_THEME: Theme = "light";

// The stored value, or (when there's none, or it's unrecognised) a theme
// chosen from the OS colour-scheme preference.
export function parseStoredTheme(raw: string | null, prefersDark: boolean): Theme {
  if (raw === "light" || raw === "dark" || raw === "terminal") return raw;
  return prefersDark ? "dark" : DEFAULT_THEME;
}

export function themeClasses(theme: Theme): { dark: boolean; terminal: boolean } {
  return { dark: theme !== "light", terminal: theme === "terminal" };
}
