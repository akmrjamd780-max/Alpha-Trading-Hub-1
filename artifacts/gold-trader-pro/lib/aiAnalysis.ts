import type { Candle } from "./marketData";
import type { Settings } from "@/context/SettingsContext";
import { analyzeQuantumFlow, type QFAResult } from "./quantumFlow";

export function runAIAnalysis(
  candles: Candle[],
  settings: Settings,
  lang: "ar" | "en" = "ar",
): QFAResult {
  return analyzeQuantumFlow(
    candles,
    {
      swingLength: settings.swingLength,
      enableWall: settings.enableWall,
      enableWarZone: settings.enableWarZone,
      useGoldenZone: settings.useGoldenZone,
      enableOrb: settings.enableOrb,
      engineMode: settings.engineMode,
      adxThreshold: settings.adxThreshold,
      spikeFilterMult: settings.spikeFilterMult,
      useMtfFilter: settings.useMtfFilter,
      useVwapFilter: settings.useVwapFilter,
      useMacdDivFilter: settings.useMacdDivFilter,
      useDxyFilter: settings.useDxyFilter,
      useMoonFilter: settings.useMoonFilter,
      enableEarlyWarning: settings.enableEarlyWarning,
      slMethod: settings.slMethod,
      tpMethod: settings.tpMethod,
      useTrailing: settings.useTrailing,
    },
    lang,
  );
}
