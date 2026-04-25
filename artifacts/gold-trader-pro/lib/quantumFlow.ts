import type { Candle } from "./marketData";
import { ema, rsi, macd, atr, bollinger } from "./indicators";

// =============================================================
// Quantum Flow Alpha — Akram Alhaddad
// Full TypeScript port (originally specified for Pine Script v6 +
// Python backend). Self-contained engine for in-app analysis.
// =============================================================

export interface SwingPoint {
  index: number;
  price: number;
  type: "HIGH" | "LOW";
  time: number;
}

export interface FVGZone {
  index: number;
  topIdx: number;
  botIdx: number;
  high: number;
  low: number;
  side: "BULL" | "BEAR";
  filled: boolean;
}

export interface FibLevels {
  startIdx: number;
  endIdx: number;
  startPrice: number;
  endPrice: number;
  direction: "UP" | "DOWN";
  levels: Record<string, number>; // "0.30" etc
  goldenZone: { low: number; high: number };
}

export interface WarZone {
  active: boolean;
  high: number;
  low: number;
  startIdx: number;
}

export interface WallInfo {
  exists: boolean;
  broken: boolean;
  side: "UP" | "DOWN" | null;
  price: number;
}

export interface BOSInfo {
  detected: boolean;
  direction: "UP" | "DOWN" | null;
  brokenLevel: number;
}

export type Trend = "UPTREND" | "DOWNTREND" | "RANGE";
export type SignalDir = "BUY" | "SELL" | "NEUTRAL";

export type SessionFilter = "all" | "asia" | "london" | "ny" | "london_ny";
export type ConfluenceMode = "any" | "majority" | "all";

export interface QFASettings {
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
  // Engine + RSI cross
  engineMode: "fast" | "balanced" | "slow";
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
  minVolatilityMult: number;
  // Optional filters
  useMtfFilter: boolean;
  useVwapFilter: boolean;
  useMacdDivFilter: boolean;
  useDxyFilter: boolean;
  useMoonFilter: boolean;
  sessionFilter: SessionFilter;
  // Weights
  weightBOS: number;
  weightWall: number;
  weightGoldenZone: number;
  weightFVG: number;
  weightMacdDiv: number;
  weightMtf: number;
  weightVwap: number;
  weightOrb: number;
  weightMoon: number;
  // Confidence/RR gates
  confluenceMode: ConfluenceMode;
  minConfidence: number;
  minRiskReward: number;
  // Early warning
  enableEarlyWarning: boolean;
  // Risk
  slMethod: "structural" | "atr" | "fib";
  tpMethod: "structural" | "fib" | "atr";
  atrSlMult: number;
  atrTpMult: number;
  fibTp1: string;
  fibTp2: string;
  useTrailing: boolean;
}

export interface QFAResult {
  signal: SignalDir;
  confidence: number; // 0..100
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  analysisSummary: string;
  activeTriggers: string[];
  explainability: string[];
  warningFlags: string[];
  fibLevels: Record<string, number>;
  warZoneActive: boolean;
  orbStatus: "NONE" | "BREAKOUT_UP" | "BREAKOUT_DOWN";
  trend: Trend;
  swingHighs: SwingPoint[];
  swingLows: SwingPoint[];
  fvgZones: FVGZone[];
  warZone: WarZone;
  wall: WallInfo;
  bos: BOSInfo;
  fib: FibLevels | null;
  earlyWarning: boolean;
  adx: number;
  rsi: number;
  emaRsi: number;
  atr: number;
}

// ----- Helpers -----

export function detectSwingPoints(
  candles: Candle[],
  length = 5,
): { highs: SwingPoint[]; lows: SwingPoint[] } {
  const highs: SwingPoint[] = [];
  const lows: SwingPoint[] = [];
  for (let i = length; i < candles.length - length; i++) {
    const c = candles[i]!;
    let isH = true;
    let isL = true;
    for (let j = 1; j <= length; j++) {
      if ((candles[i - j]?.h ?? 0) > c.h) isH = false;
      if ((candles[i + j]?.h ?? 0) > c.h) isH = false;
      if ((candles[i - j]?.l ?? Infinity) < c.l) isL = false;
      if ((candles[i + j]?.l ?? Infinity) < c.l) isL = false;
    }
    if (isH) highs.push({ index: i, price: c.h, type: "HIGH", time: c.t });
    if (isL) lows.push({ index: i, price: c.l, type: "LOW", time: c.t });
  }
  return { highs, lows };
}

export function determineTrend(
  highs: SwingPoint[],
  lows: SwingPoint[],
): Trend {
  const lh = highs.slice(-3);
  const ll = lows.slice(-3);
  if (lh.length < 2 || ll.length < 2) return "RANGE";
  const hh = lh[lh.length - 1]!.price > lh[lh.length - 2]!.price;
  const hl = ll[ll.length - 1]!.price > ll[ll.length - 2]!.price;
  const lh_ = lh[lh.length - 1]!.price < lh[lh.length - 2]!.price;
  const ll_ = ll[ll.length - 1]!.price < ll[ll.length - 2]!.price;
  if (hh && hl) return "UPTREND";
  if (lh_ && ll_) return "DOWNTREND";
  return "RANGE";
}

export function detectBOS(
  highs: SwingPoint[],
  lows: SwingPoint[],
  candles: Candle[],
): BOSInfo {
  if (candles.length === 0) return { detected: false, direction: null, brokenLevel: 0 };
  const last = candles[candles.length - 1]!;
  const lastHigh = highs[highs.length - 1];
  const lastLow = lows[lows.length - 1];
  if (lastHigh && last.c > lastHigh.price) {
    return { detected: true, direction: "UP", brokenLevel: lastHigh.price };
  }
  if (lastLow && last.c < lastLow.price) {
    return { detected: true, direction: "DOWN", brokenLevel: lastLow.price };
  }
  return { detected: false, direction: null, brokenLevel: 0 };
}

export function detectWall(
  candles: Candle[],
  atrSeries: (number | null)[],
): WallInfo {
  // Find last candle with body > 1.5*ATR — the "wall"
  for (let i = candles.length - 2; i >= Math.max(0, candles.length - 50); i--) {
    const c = candles[i]!;
    const a = atrSeries[i];
    if (a == null) continue;
    const body = Math.abs(c.c - c.o);
    if (body > a * 1.5) {
      const wallSide: "UP" | "DOWN" = c.c > c.o ? "UP" : "DOWN";
      const wallLevel = wallSide === "UP" ? c.h : c.l;
      const last = candles[candles.length - 1]!;
      const broken =
        wallSide === "UP" ? last.c > wallLevel : last.c < wallLevel;
      return { exists: true, broken, side: wallSide, price: wallLevel };
    }
  }
  return { exists: false, broken: false, side: null, price: 0 };
}

export function detectWarZone(
  candles: Candle[],
  lookback = 30,
): WarZone {
  if (candles.length < lookback) {
    return { active: false, high: 0, low: 0, startIdx: 0 };
  }
  const slice = candles.slice(-lookback);
  let h = -Infinity;
  let l = Infinity;
  for (const c of slice) {
    if (c.h > h) h = c.h;
    if (c.l < l) l = c.l;
  }
  const last = candles[candles.length - 1]!;
  const range = h - l;
  // War zone is active when price is in middle 60% of the range (no clear direction)
  const mid = (h + l) / 2;
  const inMiddle = Math.abs(last.c - mid) < range * 0.3;
  return {
    active: inMiddle && range > 0,
    high: h,
    low: l,
    startIdx: candles.length - lookback,
  };
}

export function fibFromSwings(
  highs: SwingPoint[],
  lows: SwingPoint[],
): FibLevels | null {
  if (highs.length === 0 || lows.length === 0) return null;
  const lastHigh = highs[highs.length - 1]!;
  const lastLow = lows[lows.length - 1]!;
  const isUp = lastHigh.index > lastLow.index;
  const start = isUp ? lastLow : lastHigh;
  const end = isUp ? lastHigh : lastLow;
  const startPrice = start.price;
  const endPrice = end.price;
  const range = endPrice - startPrice; // signed
  const levels: Record<string, number> = {};
  for (const r of [0.0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.272, 1.618]) {
    levels[r.toFixed(3)] = endPrice - range * r;
  }
  const goldenLow = endPrice - range * 0.618;
  const goldenHigh = endPrice - range * 0.5;
  return {
    startIdx: start.index,
    endIdx: end.index,
    startPrice,
    endPrice,
    direction: isUp ? "UP" : "DOWN",
    levels,
    goldenZone: {
      low: Math.min(goldenLow, goldenHigh),
      high: Math.max(goldenLow, goldenHigh),
    },
  };
}

export function isInGoldenZone(price: number, fib: FibLevels | null): boolean {
  if (!fib) return false;
  return price >= fib.goldenZone.low && price <= fib.goldenZone.high;
}

export function detectFVG(candles: Candle[], lookback = 80): FVGZone[] {
  const out: FVGZone[] = [];
  const start = Math.max(2, candles.length - lookback);
  for (let i = start; i < candles.length; i++) {
    const c0 = candles[i - 2]!;
    const c2 = candles[i]!;
    // Bullish FVG: c0.h < c2.l
    if (c0.h < c2.l) {
      const filled = candles
        .slice(i + 1)
        .some((k) => k.l <= c0.h);
      out.push({
        index: i,
        topIdx: i,
        botIdx: i - 2,
        high: c2.l,
        low: c0.h,
        side: "BULL",
        filled,
      });
    } else if (c0.l > c2.h) {
      const filled = candles
        .slice(i + 1)
        .some((k) => k.h >= c0.l);
      out.push({
        index: i,
        topIdx: i - 2,
        botIdx: i,
        high: c0.l,
        low: c2.h,
        side: "BEAR",
        filled,
      });
    }
  }
  return out;
}

// Wilder ADX
export function adx(
  candles: Candle[],
  period = 14,
): { adx: (number | null)[]; pdi: (number | null)[]; mdi: (number | null)[] } {
  const n = candles.length;
  const tr: number[] = new Array(n).fill(0);
  const pdm: number[] = new Array(n).fill(0);
  const mdm: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const c = candles[i]!;
    const p = candles[i - 1]!;
    const upMove = c.h - p.h;
    const downMove = p.l - c.l;
    pdm[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    mdm[i] = downMove > upMove && downMove > 0 ? downMove : 0;
    tr[i] = Math.max(c.h - c.l, Math.abs(c.h - p.c), Math.abs(c.l - p.c));
  }
  const trN: number[] = new Array(n).fill(0);
  const pN: number[] = new Array(n).fill(0);
  const mN: number[] = new Array(n).fill(0);
  let trSum = 0, pSum = 0, mSum = 0;
  for (let i = 1; i <= period && i < n; i++) {
    trSum += tr[i] ?? 0;
    pSum += pdm[i] ?? 0;
    mSum += mdm[i] ?? 0;
  }
  trN[period] = trSum;
  pN[period] = pSum;
  mN[period] = mSum;
  for (let i = period + 1; i < n; i++) {
    trN[i] = (trN[i - 1] ?? 0) - (trN[i - 1] ?? 0) / period + (tr[i] ?? 0);
    pN[i] = (pN[i - 1] ?? 0) - (pN[i - 1] ?? 0) / period + (pdm[i] ?? 0);
    mN[i] = (mN[i - 1] ?? 0) - (mN[i - 1] ?? 0) / period + (mdm[i] ?? 0);
  }
  const pdi: (number | null)[] = new Array(n).fill(null);
  const mdi: (number | null)[] = new Array(n).fill(null);
  const dx: number[] = new Array(n).fill(0);
  for (let i = period; i < n; i++) {
    const t = trN[i] ?? 0;
    if (t === 0) continue;
    pdi[i] = ((pN[i] ?? 0) / t) * 100;
    mdi[i] = ((mN[i] ?? 0) / t) * 100;
    const pp = pdi[i] ?? 0;
    const mm = mdi[i] ?? 0;
    dx[i] = pp + mm > 0 ? (Math.abs(pp - mm) / (pp + mm)) * 100 : 0;
  }
  const adxArr: (number | null)[] = new Array(n).fill(null);
  let adxStart = period * 2;
  if (n > adxStart) {
    let s = 0;
    for (let i = period + 1; i <= adxStart; i++) s += dx[i] ?? 0;
    adxArr[adxStart] = s / period;
    for (let i = adxStart + 1; i < n; i++) {
      adxArr[i] = (((adxArr[i - 1] ?? 0) * (period - 1)) + (dx[i] ?? 0)) / period;
    }
  }
  return { adx: adxArr, pdi, mdi };
}

export function vwap(candles: Candle[]): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  let pvSum = 0;
  let vSum = 0;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]!;
    const tp = (c.h + c.l + c.c) / 3;
    const v = c.v || 1;
    pvSum += tp * v;
    vSum += v;
    out[i] = vSum > 0 ? pvSum / vSum : null;
  }
  return out;
}

// MACD divergence — simple regular bullish/bearish over last 30 bars
export function detectMacdDivergence(
  closes: number[],
  histogram: (number | null)[],
): "BULL_DIV" | "BEAR_DIV" | "NONE" {
  const n = closes.length;
  if (n < 30) return "NONE";
  const window = 25;
  const slice = closes.slice(-window);
  const histSlice = histogram.slice(-window).map((v) => v ?? 0);
  const minPriceIdx = slice.indexOf(Math.min(...slice));
  const maxPriceIdx = slice.indexOf(Math.max(...slice));
  // bullish: lower price low but higher hist low
  if (minPriceIdx > 5 && minPriceIdx < window - 5) {
    const earlierMin = slice.slice(0, minPriceIdx).indexOf(Math.min(...slice.slice(0, minPriceIdx)));
    if (earlierMin >= 0 && (slice[minPriceIdx] ?? 0) < (slice[earlierMin] ?? 0) && (histSlice[minPriceIdx] ?? 0) > (histSlice[earlierMin] ?? 0)) {
      return "BULL_DIV";
    }
  }
  if (maxPriceIdx > 5 && maxPriceIdx < window - 5) {
    const earlierMax = slice.slice(0, maxPriceIdx).indexOf(Math.max(...slice.slice(0, maxPriceIdx)));
    if (earlierMax >= 0 && (slice[maxPriceIdx] ?? 0) > (slice[earlierMax] ?? 0) && (histSlice[maxPriceIdx] ?? 0) < (histSlice[earlierMax] ?? 0)) {
      return "BEAR_DIV";
    }
  }
  return "NONE";
}

// Quantum Flow Engine
export interface QFCheckResult {
  buyTrigger: boolean;
  sellTrigger: boolean;
  reason: string;
}

export function quantumFlowCheck(
  rsiSeries: (number | null)[],
  emaRsiSeries: (number | null)[],
  mode: "fast" | "balanced" | "slow",
  customZones?: { buyLow: number; buyHigh: number; sellLow: number; sellHigh: number },
): QFCheckResult {
  const n = rsiSeries.length;
  if (n < 3) return { buyTrigger: false, sellTrigger: false, reason: "insufficient data" };
  const r = rsiSeries[n - 1] ?? null;
  const rPrev = rsiSeries[n - 2] ?? null;
  const e = emaRsiSeries[n - 1] ?? null;
  const ePrev = emaRsiSeries[n - 2] ?? null;
  if (r == null || rPrev == null || e == null || ePrev == null) {
    return { buyTrigger: false, sellTrigger: false, reason: "missing values" };
  }
  const presetLow = mode === "fast" ? [30, 40] : mode === "slow" ? [40, 50] : [35, 45];
  const presetHigh = mode === "fast" ? [60, 70] : mode === "slow" ? [50, 60] : [55, 65];
  const lowZone = customZones ? [customZones.buyLow, customZones.buyHigh] : presetLow;
  const highZone = customZones ? [customZones.sellLow, customZones.sellHigh] : presetHigh;
  const buyTrigger = rPrev <= ePrev && r > e && rPrev >= lowZone[0]! && rPrev <= lowZone[1]! && r > 50;
  const sellTrigger = rPrev >= ePrev && r < e && rPrev >= highZone[0]! && rPrev <= highZone[1]! && r < 50;
  return {
    buyTrigger,
    sellTrigger,
    reason: buyTrigger
      ? `RSI cross↑ from charge zone ${lowZone[0]}-${lowZone[1]}`
      : sellTrigger
      ? `RSI cross↓ from charge zone ${highZone[0]}-${highZone[1]}`
      : "no cross",
  };
}

// Composite momentum (early warning)
export function compositeMomentum(
  rsiSeries: (number | null)[],
  closes: number[],
  atrSeries: (number | null)[],
  window = 5,
): { values: number[]; weakening: boolean } {
  const n = closes.length;
  const values: number[] = [];
  for (let i = Math.max(window, n - window); i < n; i++) {
    const r = rsiSeries[i] ?? 50;
    const a = atrSeries[i] ?? 1;
    const priceMom = ((closes[i] ?? 0) - (closes[i - window] ?? 0)) / a;
    values.push((r - 50) + priceMom * 5);
  }
  if (values.length < 3) return { values, weakening: false };
  const weakening =
    values[values.length - 1]! < values[values.length - 2]! &&
    values[values.length - 2]! < values[values.length - 3]!;
  return { values, weakening };
}

// Moon phase (simple synodic — Conway approximation)
export function moonPhase(date: Date): number {
  const lp = 2551443; // synodic month seconds
  const newMoon = new Date(1970, 0, 7, 20, 35, 0).getTime() / 1000;
  const phase = ((date.getTime() / 1000 - newMoon) % lp) / lp;
  return phase; // 0..1
}
export function moonFavors(phase: number): "BULL" | "BEAR" | "NEUTRAL" {
  // crude: full moon (≈0.5) → bullish bias; new moon (≈0) → bearish
  const d = Math.abs(phase - 0.5);
  if (d < 0.1) return "BULL";
  if (phase < 0.1 || phase > 0.9) return "BEAR";
  return "NEUTRAL";
}

// ORB — last bar within session window
export function orbStatus(
  candles: Candle[],
  sessionStartHourUTC = 13,
  sessionStartMin = 30,
  sessionDurationMin = 15,
): "NONE" | "BREAKOUT_UP" | "BREAKOUT_DOWN" {
  if (candles.length < 5) return "NONE";
  // Find today's session candles in UTC
  const last = candles[candles.length - 1]!;
  const lastDate = new Date(last.t);
  const dayStart = Date.UTC(
    lastDate.getUTCFullYear(),
    lastDate.getUTCMonth(),
    lastDate.getUTCDate(),
  );
  const sessStart = dayStart + (sessionStartHourUTC * 60 + sessionStartMin) * 60 * 1000;
  const sessEnd = sessStart + sessionDurationMin * 60 * 1000;
  let high = -Infinity;
  let low = Infinity;
  let found = false;
  for (const c of candles) {
    if (c.t >= sessStart && c.t <= sessEnd) {
      if (c.h > high) high = c.h;
      if (c.l < low) low = c.l;
      found = true;
    }
  }
  if (!found) return "NONE";
  if (last.c > high) return "BREAKOUT_UP";
  if (last.c < low) return "BREAKOUT_DOWN";
  return "NONE";
}

// Default QFA settings (used by strategies/backtester when no user settings present)
export const DEFAULT_QFA_SETTINGS: QFASettings = {
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

// =============================================================
// Main analysis function
// =============================================================
// Helper: detect which trading session a UTC timestamp belongs to
function inSession(t: number, filter: SessionFilter): boolean {
  if (filter === "all") return true;
  const d = new Date(t);
  const h = d.getUTCHours();
  // Approx (UTC): Asia 00-08, London 07-16, NY 13-21
  if (filter === "asia") return h >= 0 && h < 8;
  if (filter === "london") return h >= 7 && h < 16;
  if (filter === "ny") return h >= 13 && h < 21;
  if (filter === "london_ny") return h >= 7 && h < 21;
  return true;
}

// =============================================================
// Main analysis function — fully customizable via settings
// =============================================================
export function analyzeQuantumFlow(
  candles: Candle[],
  settings: QFASettings,
  lang: "ar" | "en" = "ar",
): QFAResult {
  const closes = candles.map((c) => c.c);
  const last = candles[candles.length - 1] ?? { t: 0, o: 0, h: 0, l: 0, c: 0, v: 0 };

  // 1. Swing points
  const { highs, lows } = detectSwingPoints(candles, settings.swingLength);
  // 2. Indicators (use periods from settings)
  const adxRes = adx(candles, settings.adxPeriod);
  const atrSeries = atr(candles, settings.atrPeriod);
  const rsiSeries = rsi(closes, settings.rsiPeriod);
  const rsiNumeric = rsiSeries.map((v) => v ?? 50);
  const emaRsi = ema(rsiNumeric, settings.emaRsiPeriod);
  const macdRes = macd(closes);
  const bb = bollinger(closes, 20, 2);
  const vwapSeries = vwap(candles);

  const lastIdx = candles.length - 1;
  const adxV = adxRes.adx[lastIdx] ?? 0;
  const atrV = atrSeries[lastIdx] ?? 0;
  const rsiV = rsiSeries[lastIdx] ?? 50;
  const emaRsiV = emaRsi[lastIdx] ?? 50;
  const vwapV = vwapSeries[lastIdx] ?? last.c;

  // 3. Trend
  const trend = determineTrend(highs, lows);
  // 4. BOS + Wall (each individually toggleable)
  const bos = settings.enableBOS
    ? detectBOS(highs, lows, candles)
    : { detected: false, direction: null as "UP" | "DOWN" | null, brokenLevel: 0 };
  const wall = settings.enableWall
    ? detectWall(candles, atrSeries)
    : { exists: false, broken: false, side: null as "UP" | "DOWN" | null, price: 0 };
  // 5. War zone
  const warZone = settings.enableWarZone
    ? detectWarZone(candles, 30)
    : { active: false, high: 0, low: 0, startIdx: 0 };
  // 6. Fibonacci
  const fib = fibFromSwings(highs, lows);
  // 7. FVG + ORB
  const fvgZones = settings.enableFVG ? detectFVG(candles, 80) : [];
  const orb = settings.enableOrb ? orbStatus(candles) : "NONE";

  // 8. Mandatory filters
  const adxOk = adxV >= settings.adxThreshold;
  const candleRange = last.h - last.l;
  const spike = atrV > 0 && candleRange > settings.spikeFilterMult * atrV;
  const volatilityOk = candleRange > atrV * settings.minVolatilityMult;
  const sessionOk = inSession(last.t, settings.sessionFilter);

  // 9. Quantum Flow trigger (respect custom zones if enabled)
  const qf = settings.enableQFCross
    ? quantumFlowCheck(
        rsiSeries,
        emaRsi,
        settings.engineMode,
        settings.useCustomRsiZones
          ? {
              buyLow: settings.buyZoneLow,
              buyHigh: settings.buyZoneHigh,
              sellLow: settings.sellZoneLow,
              sellHigh: settings.sellZoneHigh,
            }
          : undefined,
      )
    : { buyTrigger: false, sellTrigger: false, reason: "QF cross disabled" };

  // 10. Optional filters
  const macdDiv = settings.useMacdDivFilter
    ? detectMacdDivergence(closes, macdRes.hist)
    : "NONE";
  const vwapOk = (side: SignalDir) =>
    !settings.useVwapFilter || (side === "BUY" ? last.c > vwapV : last.c < vwapV);
  const moon = settings.useMoonFilter
    ? moonFavors(moonPhase(new Date(last.t)))
    : "NEUTRAL";

  // Decision
  const triggers: string[] = [];
  const explain: string[] = [];
  const warnings: string[] = [];
  if (warZone.active)
    warnings.push(lang === "ar" ? "السعر داخل منطقة الحرب" : "Price inside War Zone");
  if (!adxOk)
    warnings.push(
      lang === "ar"
        ? `ADX ضعيف (${adxV.toFixed(0)} < ${settings.adxThreshold})`
        : `Weak ADX (${adxV.toFixed(0)} < ${settings.adxThreshold})`,
    );
  if (spike)
    warnings.push(lang === "ar" ? "شمعة شاذة — تأخير الإشارة" : "Spike candle — signal delayed");
  if (!volatilityOk)
    warnings.push(lang === "ar" ? "تذبذب منخفض" : "Low volatility");
  if (!sessionOk)
    warnings.push(lang === "ar" ? "خارج الجلسة المختارة" : "Outside selected session");

  let signal: SignalDir = "NEUTRAL";
  let entry = last.c;
  let confidence = 0;

  const allowSignal = !warZone.active && adxOk && !spike && volatilityOk && sessionOk;

  if (allowSignal) {
    // Primary trigger: QF cross
    if (settings.enableQFCross && qf.buyTrigger) {
      signal = "BUY";
      triggers.push("QF_CROSS_UP");
      explain.push(
        lang === "ar"
          ? "تقاطع RSI صاعد من منطقة الشحن"
          : "Bullish RSI cross from charge zone",
      );
    } else if (settings.enableQFCross && qf.sellTrigger) {
      signal = "SELL";
      triggers.push("QF_CROSS_DOWN");
      explain.push(
        lang === "ar"
          ? "تقاطع RSI هابط من منطقة الشحن"
          : "Bearish RSI cross from charge zone",
      );
    }
    // Fallback trigger: BOS in trend direction (only if BOS enabled)
    if (signal === "NEUTRAL" && settings.enableBOS) {
      const bullOk = settings.allowCounterTrend || trend !== "DOWNTREND";
      const bearOk = settings.allowCounterTrend || trend !== "UPTREND";
      if (bos.detected && bos.direction === "UP" && bullOk) {
        signal = "BUY";
        triggers.push("BOS_BULL");
        explain.push(lang === "ar" ? "كسر هيكل صاعد" : "Bullish break of structure");
      } else if (bos.detected && bos.direction === "DOWN" && bearOk) {
        signal = "SELL";
        triggers.push("BOS_BEAR");
        explain.push(lang === "ar" ? "كسر هيكل هابط" : "Bearish break of structure");
      }
    }
    // Apply optional filters
    if (signal !== "NEUTRAL") {
      if (settings.useMtfFilter) {
        const sma50 =
          closes.slice(-50).reduce((a, b) => a + b, 0) / Math.min(50, closes.length);
        const mtfBull = last.c > sma50;
        if ((signal === "BUY" && !mtfBull) || (signal === "SELL" && mtfBull)) {
          warnings.push(lang === "ar" ? "تعارض مع الفريم الأعلى" : "Conflicts with higher timeframe");
          signal = "NEUTRAL";
        } else {
          triggers.push("MTF_OK");
        }
      }
      if (signal !== "NEUTRAL" && !vwapOk(signal)) {
        warnings.push(lang === "ar" ? "تعارض مع VWAP" : "Conflicts with VWAP");
        signal = "NEUTRAL";
      } else if (signal !== "NEUTRAL" && settings.useVwapFilter) {
        triggers.push("VWAP_OK");
      }
      if (signal !== "NEUTRAL" && settings.useMacdDivFilter) {
        if (signal === "BUY" && macdDiv === "BULL_DIV") triggers.push("MACD_BULL_DIV");
        if (signal === "SELL" && macdDiv === "BEAR_DIV") triggers.push("MACD_BEAR_DIV");
      }
      if (signal !== "NEUTRAL" && settings.useDxyFilter) {
        // proxy: use VWAP slope as DXY-direction proxy
        const vwapSlope = (vwapV - (vwapSeries[Math.max(0, lastIdx - 5)] ?? vwapV)) /
          (atrV || 1);
        if ((signal === "BUY" && vwapSlope < 0) || (signal === "SELL" && vwapSlope > 0)) {
          triggers.push("DXY_OK");
        } else {
          warnings.push(lang === "ar" ? "تعارض مع مؤشر الدولار" : "Conflicts with DXY");
          // soft penalty only — don't kill signal
        }
      }
      if (signal !== "NEUTRAL" && settings.useMoonFilter) {
        if ((signal === "BUY" && moon === "BEAR") || (signal === "SELL" && moon === "BULL")) {
          warnings.push(lang === "ar" ? "طور القمر يعارض الإشارة" : "Moon phase opposes signal");
        } else {
          triggers.push(`MOON_${moon}`);
        }
      }
    }
  }

  // Bonus context triggers
  const inGZ = !!(fib && isInGoldenZone(last.c, fib));
  if (inGZ && settings.useGoldenZone) {
    triggers.push("GOLDEN_ZONE");
    explain.push(
      lang === "ar"
        ? "السعر داخل المنطقة الذهبية لفيبوناتشي"
        : "Price within Fib golden zone",
    );
  }
  // Mandatory golden zone gate
  if (signal !== "NEUTRAL" && settings.requireGoldenZone && !inGZ) {
    warnings.push(
      lang === "ar"
        ? "خارج المنطقة الذهبية — مطلوبة"
        : "Outside Golden Zone — required",
    );
    signal = "NEUTRAL";
  }
  // FVG context
  const lastFvg = fvgZones[fvgZones.length - 1];
  if (settings.enableFVG && lastFvg && !lastFvg.filled) {
    triggers.push(lastFvg.side === "BULL" ? "FVG_BULL_TOUCH" : "FVG_BEAR_TOUCH");
  }
  // Mandatory FVG confluence gate
  if (signal !== "NEUTRAL" && settings.requireFvgConfluence) {
    const want = signal === "BUY" ? "BULL" : "BEAR";
    const hasFvg = fvgZones.some((z) => !z.filled && z.side === want);
    if (!hasFvg) {
      warnings.push(
        lang === "ar"
          ? "لا توجد فجوة FVG داعمة — مطلوبة"
          : "No supporting FVG — required",
      );
      signal = "NEUTRAL";
    }
  }
  if (settings.enableWall && wall.exists && wall.broken) {
    triggers.push(wall.side === "UP" ? "WALL_BREAK_UP" : "WALL_BREAK_DOWN");
    explain.push(
      lang === "ar"
        ? `كسر الجدار ${wall.side === "UP" ? "الصاعد" : "الهابط"}`
        : `Wall break ${wall.side}`,
    );
  }
  if (orb !== "NONE") triggers.push(`ORB_${orb.replace("BREAKOUT_", "")}`);

  // Confidence scoring with user-defined weights
  if (signal !== "NEUTRAL") {
    let score = 50;
    if (triggers.includes("BOS_BULL") || triggers.includes("BOS_BEAR"))
      score += settings.weightBOS;
    if (triggers.includes("WALL_BREAK_UP") || triggers.includes("WALL_BREAK_DOWN"))
      score += settings.weightWall;
    if (triggers.includes("GOLDEN_ZONE")) score += settings.weightGoldenZone;
    if (triggers.includes("MACD_BULL_DIV") || triggers.includes("MACD_BEAR_DIV"))
      score += settings.weightMacdDiv;
    if (triggers.some((t) => t.startsWith("FVG_"))) score += settings.weightFVG;
    if (triggers.includes("MTF_OK")) score += settings.weightMtf;
    if (triggers.some((t) => t.startsWith("ORB_"))) score += settings.weightOrb;
    if (triggers.includes("VWAP_OK")) score += settings.weightVwap;
    if (triggers.some((t) => t.startsWith("MOON_"))) score += settings.weightMoon;
    score -= warnings.length * 4;
    if (adxV >= settings.adxThreshold + 5) score += 4;
    confidence = Math.max(0, Math.min(99, score));
  }

  // Confluence-mode gate
  if (signal !== "NEUTRAL") {
    const optionalActive = [
      settings.useMtfFilter,
      settings.useVwapFilter,
      settings.useMacdDivFilter,
      settings.useDxyFilter,
      settings.useMoonFilter,
    ].filter(Boolean).length;
    const optionalConfirmed = [
      triggers.includes("MTF_OK"),
      triggers.includes("VWAP_OK"),
      triggers.includes("MACD_BULL_DIV") || triggers.includes("MACD_BEAR_DIV"),
      triggers.includes("DXY_OK"),
      triggers.some((t) => t.startsWith("MOON_")),
    ].filter(Boolean).length;
    if (settings.confluenceMode === "all" && optionalActive > 0 && optionalConfirmed < optionalActive) {
      warnings.push(lang === "ar" ? "نقص الإجماع المطلوب (الكل)" : "Missing required confluence (all)");
      signal = "NEUTRAL";
    } else if (
      settings.confluenceMode === "majority" &&
      optionalActive > 1 &&
      optionalConfirmed < Math.ceil(optionalActive / 2)
    ) {
      warnings.push(lang === "ar" ? "نقص الإجماع المطلوب (أغلبية)" : "Missing required confluence (majority)");
      signal = "NEUTRAL";
    }
  }

  // Min-confidence gate
  if (signal !== "NEUTRAL" && confidence < settings.minConfidence) {
    warnings.push(
      lang === "ar"
        ? `الثقة (${confidence}) أقل من الحد الأدنى (${settings.minConfidence})`
        : `Confidence (${confidence}) below minimum (${settings.minConfidence})`,
    );
    signal = "NEUTRAL";
  }

  // Stops / targets
  let sl = entry;
  let tp1 = entry;
  let tp2 = entry;
  if (signal !== "NEUTRAL") {
    const dir = signal === "BUY" ? 1 : -1;
    if (settings.slMethod === "structural") {
      const ref =
        signal === "BUY"
          ? (lows[lows.length - 1]?.price ?? entry - atrV)
          : (highs[highs.length - 1]?.price ?? entry + atrV);
      sl = ref;
    } else if (settings.slMethod === "atr") {
      sl = entry - dir * atrV * settings.atrSlMult;
    } else if (settings.slMethod === "fib" && fib) {
      sl = fib.startPrice;
    }
    const risk = Math.abs(entry - sl) || atrV;
    if (settings.tpMethod === "structural") {
      const tgt = signal === "BUY" ? highs[highs.length - 1]?.price : lows[lows.length - 1]?.price;
      tp1 =
        tgt && (signal === "BUY" ? tgt > entry : tgt < entry)
          ? tgt
          : entry + dir * risk * 1.5;
      tp2 = entry + dir * risk * 3;
    } else if (settings.tpMethod === "fib" && fib) {
      tp1 = fib.levels[settings.fibTp1] ?? entry + dir * risk * 2;
      tp2 = fib.levels[settings.fibTp2] ?? entry + dir * risk * 3;
    } else if (settings.tpMethod === "atr") {
      tp1 = entry + dir * atrV * settings.atrTpMult;
      tp2 = entry + dir * atrV * settings.atrTpMult * 1.6;
    } else {
      tp1 = entry + dir * risk * 2;
      tp2 = entry + dir * risk * 3;
    }

    // Min RR gate
    const rr = Math.abs(tp1 - entry) / (Math.abs(entry - sl) || 1);
    if (rr < settings.minRiskReward) {
      warnings.push(
        lang === "ar"
          ? `R:R (${rr.toFixed(2)}) أقل من الحد (${settings.minRiskReward})`
          : `R:R (${rr.toFixed(2)}) below min (${settings.minRiskReward})`,
      );
      signal = "NEUTRAL";
      confidence = 0;
    }
  }

  // Early warning
  const cm = compositeMomentum(rsiSeries, closes, atrSeries, 5);
  const earlyWarning = settings.enableEarlyWarning && cm.weakening;
  if (earlyWarning)
    warnings.push(
      lang === "ar" ? "ضعف في الزخم — انقل الوقف" : "Momentum weakening — trail stop",
    );

  const summaryParts: string[] = [];
  summaryParts.push(
    lang === "ar"
      ? `الاتجاه: ${trend === "UPTREND" ? "صاعد" : trend === "DOWNTREND" ? "هابط" : "عرضي"}`
      : `Trend: ${trend}`,
  );
  summaryParts.push(`ADX ${adxV.toFixed(0)}`);
  summaryParts.push(`RSI ${rsiV.toFixed(1)}`);
  if (warZone.active) summaryParts.push(lang === "ar" ? "منطقة الحرب" : "WarZone");
  if (orb !== "NONE") summaryParts.push(`ORB ${orb}`);
  summaryParts.push(
    lang === "ar"
      ? `الإجماع: ${settings.confluenceMode === "all" ? "الكل" : settings.confluenceMode === "majority" ? "أغلبية" : "أي"}`
      : `Conf: ${settings.confluenceMode}`,
  );

  return {
    signal,
    confidence,
    entryPrice: entry,
    stopLoss: sl,
    takeProfit1: tp1,
    takeProfit2: tp2,
    analysisSummary: summaryParts.join(" · "),
    activeTriggers: triggers,
    explainability: explain,
    warningFlags: warnings,
    fibLevels: fib?.levels ?? {},
    warZoneActive: warZone.active,
    orbStatus: orb,
    trend,
    swingHighs: highs,
    swingLows: lows,
    fvgZones,
    warZone,
    wall,
    bos,
    fib,
    earlyWarning,
    adx: adxV,
    rsi: rsiV,
    emaRsi: emaRsiV,
    atr: atrV,
  };
}
