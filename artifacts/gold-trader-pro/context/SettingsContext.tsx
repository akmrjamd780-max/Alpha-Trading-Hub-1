import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { I18nManager } from "react-native";

import type { Lang } from "@/lib/i18n";

export type EngineMode = "fast" | "balanced" | "slow";
export type SLMethod = "structural" | "atr" | "fib";
export type TPMethod = "structural" | "fib";

export interface Settings {
  lang: Lang;
  swingLength: number;
  enableWall: boolean;
  enableWarZone: boolean;
  useGoldenZone: boolean;
  enableOrb: boolean;
  engineMode: EngineMode;
  adxThreshold: number;
  spikeFilterMult: number;
  useMtfFilter: boolean;
  useVwapFilter: boolean;
  useMacdDivFilter: boolean;
  useDxyFilter: boolean;
  useMoonFilter: boolean;
  enableEarlyWarning: boolean;
  slMethod: SLMethod;
  tpMethod: TPMethod;
  useTrailing: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  lang: "ar",
  swingLength: 5,
  enableWall: true,
  enableWarZone: true,
  useGoldenZone: true,
  enableOrb: true,
  engineMode: "balanced",
  adxThreshold: 25,
  spikeFilterMult: 2.5,
  useMtfFilter: true,
  useVwapFilter: false,
  useMacdDivFilter: true,
  useDxyFilter: true,
  useMoonFilter: false,
  enableEarlyWarning: true,
  slMethod: "structural",
  tpMethod: "structural",
  useTrailing: true,
};

interface Ctx {
  settings: Settings;
  ready: boolean;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
  setLang: (l: Lang) => void;
}

const SettingsCtx = createContext<Ctx | null>(null);
const KEY = "gtp_settings_v1";

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<Settings>;
          setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        }
      } catch {
        // ignore
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(KEY, JSON.stringify(settings)).catch(() => {});
    // Allow RTL — we don't forceRTL because that requires app reload;
    // we use writingDirection / direction CSS in component styles.
    I18nManager.allowRTL(true);
  }, [settings, ready]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const setLang = useCallback(
    (l: Lang) => {
      setSettings((prev) => ({ ...prev, lang: l }));
    },
    [],
  );

  const value = useMemo<Ctx>(
    () => ({ settings, ready, update, reset, setLang }),
    [settings, ready, update, reset, setLang],
  );

  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

export function useSettings(): Ctx {
  const v = useContext(SettingsCtx);
  if (!v) throw new Error("useSettings must be used within SettingsProvider");
  return v;
}

export function useT(): { t: (key: string) => string; lang: Lang; isRTL: boolean } {
  const { settings } = useSettings();
  const lang = settings.lang;
  const isRTL = lang === "ar";
  // Lazy require to avoid circular
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { tr, T } = require("@/lib/i18n") as typeof import("@/lib/i18n");
  const t = (key: string) => tr(key as keyof typeof T, lang);
  return { t, lang, isRTL };
}
