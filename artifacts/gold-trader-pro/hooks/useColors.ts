import colors, { type ThemeName } from "@/constants/colors";
import { useSettings } from "@/context/SettingsContext";

export function useColors() {
  try {
    const { settings } = useSettings();
    const theme: ThemeName = (settings as { theme?: ThemeName }).theme ?? "dark";
    return colors.themes[theme] ?? colors.themes.dark;
  } catch {
    return colors.themes.dark;
  }
}

export function useRadius() {
  return colors.radius;
}
