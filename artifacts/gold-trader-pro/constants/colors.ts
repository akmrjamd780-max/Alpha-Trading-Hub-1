export type ThemeName = "dark" | "medium" | "light";

const dark = {
  text: "#0a0a0a",
  tint: "#d4af37",

  background: "#0a0e1a",
  foreground: "#f5f5f5",

  card: "#131829",
  cardForeground: "#f5f5f5",
  cardElevated: "#1a2138",

  primary: "#d4af37",
  primaryForeground: "#0a0e1a",

  secondary: "#1a2138",
  secondaryForeground: "#f5f5f5",

  muted: "#1a2138",
  mutedForeground: "#7a8499",

  accent: "#1f2842",
  accentForeground: "#f5f5f5",

  destructive: "#ef4444",
  destructiveForeground: "#ffffff",

  success: "#22c55e",
  successForeground: "#ffffff",

  warning: "#f59e0b",
  warningForeground: "#0a0e1a",

  border: "#1f2842",
  input: "#1a2138",

  gold: "#d4af37",
  goldBright: "#ffd700",
  goldDeep: "#b8860b",

  bullish: "#22c55e",
  bearish: "#ef4444",
  neutral: "#7a8499",
};

const medium = {
  ...dark,
  background: "#161a26",
  foreground: "#e9eaef",
  card: "#1d2230",
  cardElevated: "#252a3a",
  muted: "#252a3a",
  mutedForeground: "#9aa3b8",
  border: "#2b3148",
  input: "#252a3a",
  accent: "#2b3148",
};

const light = {
  text: "#0a0a0a",
  tint: "#b8860b",

  background: "#f6f7fb",
  foreground: "#0f172a",

  card: "#ffffff",
  cardForeground: "#0f172a",
  cardElevated: "#f1f3fa",

  primary: "#b8860b",
  primaryForeground: "#ffffff",

  secondary: "#eef0f7",
  secondaryForeground: "#0f172a",

  muted: "#eef0f7",
  mutedForeground: "#5b6478",

  accent: "#e6e9f3",
  accentForeground: "#0f172a",

  destructive: "#dc2626",
  destructiveForeground: "#ffffff",

  success: "#16a34a",
  successForeground: "#ffffff",

  warning: "#d97706",
  warningForeground: "#ffffff",

  border: "#e1e4ee",
  input: "#ffffff",

  gold: "#b8860b",
  goldBright: "#d4af37",
  goldDeep: "#8a6508",

  bullish: "#16a34a",
  bearish: "#dc2626",
  neutral: "#5b6478",
};

const palettes: Record<ThemeName, typeof dark> = {
  dark,
  medium,
  light,
};

const colors = {
  // Backwards-compatible default
  light: dark,
  // New theme map
  themes: palettes,
  radius: 14,
};

export default colors;
