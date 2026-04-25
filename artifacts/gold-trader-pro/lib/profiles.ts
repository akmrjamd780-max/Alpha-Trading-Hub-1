import type { Settings } from "@/context/SettingsContext";

// =============================================================
// Trading mode profiles — preset bundles tuned for different
// trade-horizon styles. Applying a profile overrides only the
// fields it owns; user can then keep editing freely.
// =============================================================

export type TradingMode =
  | "scalp"
  | "intraday"
  | "swing"
  | "position"
  | "custom";

export type SignalStyle =
  | "instant"
  | "pending"
  | "confirmed"
  | "conservative"
  | "aggressive";

export type RiskLevel = "low" | "medium" | "high";

export const TRADING_MODE_PRESETS: Record<
  Exclude<TradingMode, "custom">,
  Partial<Settings>
> = {
  scalp: {
    swingLength: 3,
    engineMode: "fast",
    adxThreshold: 18,
    minVolatilityMult: 0.2,
    spikeFilterMult: 3.0,
    minConfidence: 45,
    minRiskReward: 1.2,
    confluenceMode: "any",
    rsiPeriod: 9,
    emaRsiPeriod: 5,
    adxPeriod: 9,
    atrPeriod: 10,
    slMethod: "atr",
    tpMethod: "atr",
    atrSlMult: 1.0,
    atrTpMult: 1.5,
    useTrailing: true,
    enableEarlyWarning: true,
    enableBOS: true,
    enableFVG: true,
    requireFvgConfluence: false,
    requireGoldenZone: false,
    allowCounterTrend: true,
    useMtfFilter: false,
  },
  intraday: {
    swingLength: 5,
    engineMode: "balanced",
    adxThreshold: 22,
    minVolatilityMult: 0.3,
    spikeFilterMult: 2.5,
    minConfidence: 55,
    minRiskReward: 1.6,
    confluenceMode: "majority",
    rsiPeriod: 14,
    emaRsiPeriod: 9,
    adxPeriod: 14,
    atrPeriod: 14,
    slMethod: "structural",
    tpMethod: "structural",
    atrSlMult: 1.5,
    atrTpMult: 2.0,
    useTrailing: true,
    enableBOS: true,
    enableFVG: true,
    requireFvgConfluence: false,
    requireGoldenZone: false,
    useMtfFilter: true,
    useMacdDivFilter: true,
    allowCounterTrend: true,
  },
  swing: {
    swingLength: 7,
    engineMode: "balanced",
    adxThreshold: 25,
    minVolatilityMult: 0.35,
    spikeFilterMult: 2.2,
    minConfidence: 62,
    minRiskReward: 2.0,
    confluenceMode: "majority",
    rsiPeriod: 14,
    emaRsiPeriod: 9,
    adxPeriod: 14,
    atrPeriod: 14,
    slMethod: "structural",
    tpMethod: "fib",
    fibTp1: "1.272",
    fibTp2: "1.618",
    atrSlMult: 1.8,
    atrTpMult: 3.0,
    useTrailing: true,
    enableBOS: true,
    enableFVG: true,
    requireFvgConfluence: false,
    requireGoldenZone: true,
    useGoldenZone: true,
    useMtfFilter: true,
    useMacdDivFilter: true,
    allowCounterTrend: false,
  },
  position: {
    swingLength: 10,
    engineMode: "slow",
    adxThreshold: 28,
    minVolatilityMult: 0.4,
    spikeFilterMult: 2.0,
    minConfidence: 70,
    minRiskReward: 2.5,
    confluenceMode: "all",
    rsiPeriod: 21,
    emaRsiPeriod: 14,
    adxPeriod: 21,
    atrPeriod: 21,
    slMethod: "fib",
    tpMethod: "fib",
    fibTp1: "1.618",
    fibTp2: "2.618",
    atrSlMult: 2.5,
    atrTpMult: 4.0,
    useTrailing: true,
    enableBOS: true,
    enableFVG: true,
    requireFvgConfluence: true,
    requireGoldenZone: true,
    useGoldenZone: true,
    useMtfFilter: true,
    useMacdDivFilter: true,
    allowCounterTrend: false,
  },
};

export const TRADING_MODE_DESC: Record<
  TradingMode,
  { ar: string; en: string }
> = {
  scalp: {
    ar: "صفقات سريعة جداً — دقائق إلى ساعة. حساسية عالية، أهداف صغيرة، وقف ضيق.",
    en: "Very fast trades — minutes to an hour. High sensitivity, small targets, tight stops.",
  },
  intraday: {
    ar: "صفقات يوم واحد — ساعات. توازن بين السرعة والدقة.",
    en: "Single-day trades — hours. Balanced sensitivity and accuracy.",
  },
  swing: {
    ar: "صفقات سوينج — أيام إلى أسابيع. شروط أعلى، أهداف فيبوناتشي.",
    en: "Swing trades — days to weeks. Stricter filters, Fibonacci targets.",
  },
  position: {
    ar: "صفقات مركزية — أسابيع إلى أشهر. أعلى مرشحات، أهداف ممتدة.",
    en: "Position trades — weeks to months. Strictest filters, extended targets.",
  },
  custom: {
    ar: "إعدادات مخصصة بالكامل بواسطتك.",
    en: "Fully custom — your own settings.",
  },
};

/** Apply a trading-mode preset patch on top of an existing settings object. */
export function applyTradingMode(
  base: Settings,
  mode: TradingMode,
): Partial<Settings> {
  if (mode === "custom") return { tradingMode: mode };
  const preset = TRADING_MODE_PRESETS[mode];
  return { ...preset, tradingMode: mode };
}
