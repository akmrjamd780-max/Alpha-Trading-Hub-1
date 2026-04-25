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
import type { ThemeName } from "@/constants/colors";
import {
  TRADING_MODE_PRESETS,
  type TradingMode,
  type SignalStyle,
  type RiskLevel,
} from "@/lib/profiles";

export type EngineMode = "fast" | "balanced" | "slow";
export type SLMethod = "structural" | "atr" | "fib";
export type TPMethod = "structural" | "fib" | "atr";
export type SessionFilter = "all" | "asia" | "london" | "ny" | "london_ny";
export type ConfluenceMode = "any" | "majority" | "all";
export type { TradingMode, SignalStyle, RiskLevel };

export interface Settings {
  lang: Lang;
  theme: ThemeName;

  // Profile + style
  tradingMode: TradingMode;
  signalStyle: SignalStyle;
  riskLevel: RiskLevel;

  // Visual / behaviour toggles
  showRecommendations: boolean;
  showDrawings: boolean;
  enableNotifications: boolean;
  enableAiAnalysis: boolean;
  enableVisualAnalysis: boolean;

  // Market structure
  swingLength: number;
  enableWall: boolean;
  enableWarZone: boolean;
  enableBOS: boolean;
  enableFVG: boolean;
  requireFvgConfluence: boolean;
  allowCounterTrend: boolean;

  // Fibonacci
  useGoldenZone: boolean;
  requireGoldenZone: boolean;

  // Breakouts
  enableOrb: boolean;

  // Engine
  engineMode: EngineMode;
  enableQFCross: boolean;
  useCustomRsiZones: boolean;
  buyZoneLow: number;
  buyZoneHigh: number;
  sellZoneLow: number;
  sellZoneHigh: number;
  rsiPeriod: number;
  emaRsiPeriod: number;
  adxPeriod: number;
  atrPeriod: number;

  // Mandatory filters
  adxThreshold: number;
  spikeFilterMult: number;
  minVolatilityMult: number; // candleRange must exceed atr * this

  // Optional filters (each can be disabled)
  useMtfFilter: boolean;
  useVwapFilter: boolean;
  useMacdDivFilter: boolean;
  useDxyFilter: boolean;
  useMoonFilter: boolean;
  sessionFilter: SessionFilter;

  // Confidence weights (0..30)
  weightBOS: number;
  weightWall: number;
  weightGoldenZone: number;
  weightFVG: number;
  weightMacdDiv: number;
  weightMtf: number;
  weightVwap: number;
  weightOrb: number;
  weightMoon: number;

  // Filtering
  confluenceMode: ConfluenceMode;
  minConfidence: number;
  minRiskReward: number;

  // Early warning
  enableEarlyWarning: boolean;

  // Risk management
  slMethod: SLMethod;
  tpMethod: TPMethod;
  atrSlMult: number;
  atrTpMult: number;
  fibTp1: string; // "1.272"
  fibTp2: string; // "1.618"
  useTrailing: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  lang: "ar",
  theme: "dark",

  tradingMode: "intraday",
  signalStyle: "confirmed",
  riskLevel: "medium",

  showRecommendations: true,
  showDrawings: true,
  enableNotifications: true,
  enableAiAnalysis: true,
  enableVisualAnalysis: true,

  swingLength: 5,
  enableWall: true,
  enableWarZone: true,
  enableBOS: true,
  enableFVG: true,
  requireFvgConfluence: false,
  allowCounterTrend: true,

  useGoldenZone: true,
  requireGoldenZone: false,

  enableOrb: true,

  engineMode: "balanced",
  enableQFCross: true,
  useCustomRsiZones: false,
  buyZoneLow: 35,
  buyZoneHigh: 45,
  sellZoneLow: 55,
  sellZoneHigh: 65,
  rsiPeriod: 14,
  emaRsiPeriod: 9,
  adxPeriod: 14,
  atrPeriod: 14,

  adxThreshold: 25,
  spikeFilterMult: 2.5,
  minVolatilityMult: 0.3,

  useMtfFilter: true,
  useVwapFilter: false,
  useMacdDivFilter: true,
  useDxyFilter: false,
  useMoonFilter: false,
  sessionFilter: "all",

  weightBOS: 10,
  weightWall: 8,
  weightGoldenZone: 8,
  weightFVG: 6,
  weightMacdDiv: 10,
  weightMtf: 6,
  weightVwap: 4,
  weightOrb: 5,
  weightMoon: 3,

  confluenceMode: "any",
  minConfidence: 50,
  minRiskReward: 1.5,

  enableEarlyWarning: true,

  slMethod: "structural",
  tpMethod: "structural",
  atrSlMult: 1.5,
  atrTpMult: 2.0,
  fibTp1: "1.272",
  fibTp2: "1.618",
  useTrailing: true,
};

interface Ctx {
  settings: Settings;
  ready: boolean;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
  setLang: (l: Lang) => void;
  setTheme: (theme: ThemeName) => void;
  applyTradingMode: (mode: TradingMode) => void;
}

const SettingsCtx = createContext<Ctx | null>(null);
const KEY = "gtp_settings_v3";

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
    I18nManager.allowRTL(true);
  }, [settings, ready]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setSettings((prev) => ({ ...prev, lang: l }));
  }, []);

  const setTheme = useCallback((theme: ThemeName) => {
    setSettings((prev) => ({ ...prev, theme }));
  }, []);

  const applyTradingMode = useCallback((mode: TradingMode) => {
    setSettings((prev) => {
      if (mode === "custom") return { ...prev, tradingMode: mode };
      const preset = TRADING_MODE_PRESETS[mode];
      return { ...prev, ...preset, tradingMode: mode };
    });
  }, []);

  const value = useMemo<Ctx>(
    () => ({ settings, ready, update, reset, setLang, setTheme, applyTradingMode }),
    [settings, ready, update, reset, setLang, setTheme, applyTradingMode],
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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { tr, T } = require("@/lib/i18n") as typeof import("@/lib/i18n");
  const t = (key: string) => tr(key as keyof typeof T, lang);
  return { t, lang, isRTL };
}

// Counts how many filters/conditions are currently enabled
export function activeFilterCount(s: Settings): number {
  let n = 0;
  if (s.enableWall) n++;
  if (s.enableWarZone) n++;
  if (s.enableBOS) n++;
  if (s.enableFVG) n++;
  if (s.requireFvgConfluence) n++;
  if (!s.allowCounterTrend) n++;
  if (s.useGoldenZone) n++;
  if (s.requireGoldenZone) n++;
  if (s.enableOrb) n++;
  if (s.enableQFCross) n++;
  if (s.useMtfFilter) n++;
  if (s.useVwapFilter) n++;
  if (s.useMacdDivFilter) n++;
  if (s.useDxyFilter) n++;
  if (s.useMoonFilter) n++;
  if (s.sessionFilter !== "all") n++;
  if (s.enableEarlyWarning) n++;
  if (s.useTrailing) n++;
  return n;
}
