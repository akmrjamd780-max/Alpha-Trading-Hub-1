import type { Candle } from "./marketData";
import type { Settings } from "@/context/SettingsContext";
import { runAIAnalysis } from "./aiAnalysis";
import type { QFAResult } from "./quantumFlow";
import { ema, rsi, macd, atr, bollinger, stochastic } from "./indicators";
import { detectPatterns, patternBias, type DetectedPattern } from "./patterns";
import { detectChartPatterns, type ChartPattern } from "./chartPatterns";

// =============================================================
// Advanced Analysis — wraps the Quantum Flow engine and adds the
// rich, structured trade plan: TP1/2/3, reversal probabilities,
// confirmation/cancellation conditions, support/resistance lists,
// demand/supply/liquidity zones, factor scoring board, candle
// patterns, pending-order suggestion, and an overall A+..D rating.
// Everything is fully driven by the user's Settings and lang.
// =============================================================

export type FactorState = "POS" | "NEG" | "NEU";
export type FactorImpact = "LOW" | "MED" | "HIGH";

export interface FactorScore {
  key: string;
  labelAr: string;
  labelEn: string;
  state: FactorState;
  strength: number; // 0..100
  impact: FactorImpact;
  rawAr: string;
  rawEn: string;
}

export interface PriceLevel {
  price: number;
  labelAr: string;
  labelEn: string;
  strength: number; // 0..100
}

export interface Zone {
  high: number;
  low: number;
  side: "DEMAND" | "SUPPLY" | "LIQUIDITY";
  labelAr: string;
  labelEn: string;
  strength: number;
}

export interface PendingOrder {
  type: "BUY_LIMIT" | "SELL_LIMIT" | "BUY_STOP" | "SELL_STOP";
  price: number;
  reasonAr: string;
  reasonEn: string;
}

export type Rating = "A+" | "A" | "B" | "C" | "D";

export interface AdvancedAnalysis {
  base: QFAResult;
  // Trade plan
  tp1: number;
  tp2: number;
  tp3: number;
  reversalP1: number; // % reversal probability at each TP
  reversalP2: number;
  reversalP3: number;
  riskReward: number;
  // Conditions
  confirmConditions: string[];
  cancelConditions: string[];
  reasons: string[];
  importantNotes: string[];
  // Levels & zones
  supports: PriceLevel[];
  resistances: PriceLevel[];
  demandZones: Zone[];
  supplyZones: Zone[];
  liquidityZones: Zone[];
  // Patterns
  patterns: DetectedPattern[];
  patternBias: number;
  // Chart patterns
  chartPatterns: ChartPattern[];
  chartPatternBias: number;
  // Factor board
  factors: FactorScore[];
  factorScore: number; // -100..+100
  // Suggested pending order (if better entry exists)
  pendingOrder: PendingOrder | null;
  // Breakeven / trailing suggestions
  breakevenSuggestion: string | null;
  trailingSuggestion: string | null;
  // Overall
  rating: Rating;
  ratingScore: number; // 0..100
  qualityLabelAr: string;
  qualityLabelEn: string;
}

function impact(weight: number): FactorImpact {
  if (weight >= 9) return "HIGH";
  if (weight >= 5) return "MED";
  return "LOW";
}

function topNUnique(arr: number[], n: number, asc: boolean): number[] {
  const sorted = [...arr].sort((a, b) => (asc ? a - b : b - a));
  const out: number[] = [];
  for (const v of sorted) {
    if (!out.some((o) => Math.abs(o - v) / Math.max(o, 1) < 0.0008)) {
      out.push(v);
      if (out.length >= n) break;
    }
  }
  return out;
}

export function runAdvancedAnalysis(
  candles: Candle[],
  settings: Settings,
  lang: "ar" | "en" = "ar",
): AdvancedAnalysis {
  const base = runAIAnalysis(candles, settings, lang);
  const closes = candles.map((c) => c.c);
  const last = candles[candles.length - 1]!;
  const lastIdx = candles.length - 1;
  const entry = base.entryPrice || last.c;

  // ---------- TP3 + reversal probabilities ----------
  const dir = base.signal === "BUY" ? 1 : base.signal === "SELL" ? -1 : 0;
  const risk = Math.abs(entry - base.stopLoss) || base.atr || 1;
  const tp1 = base.takeProfit1;
  const tp2 = base.takeProfit2;
  let tp3 = entry + dir * risk * 5;
  if (settings.tpMethod === "fib" && base.fib) {
    tp3 = base.fib.levels["2.618"] ?? entry + dir * risk * 5;
  } else if (settings.tpMethod === "atr") {
    tp3 = entry + dir * base.atr * settings.atrTpMult * 2.4;
  }
  const reversalP1 = Math.min(85, 25 + Math.round((100 - base.confidence) * 0.3));
  const reversalP2 = Math.min(90, 40 + Math.round((100 - base.confidence) * 0.4));
  const reversalP3 = Math.min(95, 55 + Math.round((100 - base.confidence) * 0.45));
  const riskReward =
    base.signal === "NEUTRAL"
      ? 0
      : Math.abs(tp1 - entry) / (Math.abs(entry - base.stopLoss) || 1);

  // ---------- Confirmation / cancellation ----------
  const confirmConditions: string[] = [];
  const cancelConditions: string[] = [];
  const isBuy = base.signal === "BUY" || base.signal === "PENDING_BUY";
  const isSell = base.signal === "SELL" || base.signal === "PENDING_SELL";
  if (isBuy) {
    confirmConditions.push(
      lang === "ar"
        ? `إغلاق شمعة فوق ${entry.toFixed(2)} مع زخم RSI > 50`
        : `Candle close above ${entry.toFixed(2)} with RSI momentum > 50`,
    );
    confirmConditions.push(
      lang === "ar"
        ? "تأكيد كسر هيكلي صاعد على الفريم الأقل"
        : "Bullish BOS confirmation on lower timeframe",
    );
    cancelConditions.push(
      lang === "ar"
        ? `إغلاق تحت وقف الخسارة ${base.stopLoss.toFixed(2)}`
        : `Close below stop-loss ${base.stopLoss.toFixed(2)}`,
    );
    cancelConditions.push(
      lang === "ar"
        ? "ظهور شمعة ابتلاع بيعي قوي تحت السعر"
        : "Strong bearish engulfing forms below price",
    );
  } else if (isSell) {
    confirmConditions.push(
      lang === "ar"
        ? `إغلاق شمعة تحت ${entry.toFixed(2)} مع زخم RSI < 50`
        : `Candle close below ${entry.toFixed(2)} with RSI momentum < 50`,
    );
    confirmConditions.push(
      lang === "ar"
        ? "تأكيد كسر هيكلي هابط على الفريم الأقل"
        : "Bearish BOS confirmation on lower timeframe",
    );
    cancelConditions.push(
      lang === "ar"
        ? `إغلاق فوق وقف الخسارة ${base.stopLoss.toFixed(2)}`
        : `Close above stop-loss ${base.stopLoss.toFixed(2)}`,
    );
    cancelConditions.push(
      lang === "ar"
        ? "ظهور شمعة ابتلاع شرائي قوي فوق السعر"
        : "Strong bullish engulfing forms above price",
    );
  }
  if (base.warZoneActive) {
    cancelConditions.push(
      lang === "ar" ? "بقاء السعر داخل منطقة الحرب" : "Price stays inside War Zone",
    );
  }

  // ---------- Detailed reasons ----------
  const reasons: string[] = [...base.explainability];
  if (base.activeTriggers.includes("MTF_OK"))
    reasons.push(
      lang === "ar"
        ? "توافق مع الفريم الأعلى يدعم الإشارة"
        : "Higher timeframe alignment supports the signal",
    );
  if (base.activeTriggers.some((t) => t.startsWith("FVG_")))
    reasons.push(
      lang === "ar" ? "وجود فجوة سعرية داعمة" : "Supporting fair-value gap present",
    );
  if (base.activeTriggers.includes("GOLDEN_ZONE"))
    reasons.push(
      lang === "ar"
        ? "السعر داخل المنطقة الذهبية لفيبوناتشي 0.5–0.618"
        : "Price within Fibonacci 0.5–0.618 golden zone",
    );

  const importantNotes: string[] = [...base.warningFlags];
  if (base.earlyWarning)
    importantNotes.push(
      lang === "ar"
        ? "إنذار مبكر — تحريك وقف الخسارة لحماية الأرباح"
        : "Early warning — trail stop to protect profits",
    );

  // ---------- Support / resistance ----------
  const lowsArr = base.swingLows.slice(-12).map((s) => s.price);
  const highsArr = base.swingHighs.slice(-12).map((s) => s.price);
  const supportPrices = topNUnique(
    lowsArr.filter((p) => p < last.c),
    3,
    false, // closest first (highest price below)
  );
  const resistancePrices = topNUnique(
    highsArr.filter((p) => p > last.c),
    3,
    true, // closest first (lowest price above)
  );
  const supports: PriceLevel[] = supportPrices.map((p, i) => ({
    price: p,
    labelAr: i === 0 ? "أقرب دعم" : i === 1 ? "دعم ثانوي" : "دعم رئيسي",
    labelEn: i === 0 ? "Nearest support" : i === 1 ? "Secondary support" : "Major support",
    strength: 90 - i * 18,
  }));
  const resistances: PriceLevel[] = resistancePrices.map((p, i) => ({
    price: p,
    labelAr: i === 0 ? "أقرب مقاومة" : i === 1 ? "مقاومة ثانوية" : "مقاومة رئيسية",
    labelEn:
      i === 0 ? "Nearest resistance" : i === 1 ? "Secondary resistance" : "Major resistance",
    strength: 90 - i * 18,
  }));

  // ---------- Zones (FVG split into demand/supply, plus liquidity) ----------
  const recentFvg = base.fvgZones.slice(-6).filter((z) => !z.filled);
  const demandZones: Zone[] = recentFvg
    .filter((z) => z.side === "BULL")
    .map((z) => ({
      high: z.high,
      low: z.low,
      side: "DEMAND",
      labelAr: "منطقة طلب (FVG شرائي)",
      labelEn: "Demand zone (Bullish FVG)",
      strength: 75,
    }));
  const supplyZones: Zone[] = recentFvg
    .filter((z) => z.side === "BEAR")
    .map((z) => ({
      high: z.high,
      low: z.low,
      side: "SUPPLY",
      labelAr: "منطقة عرض (FVG بيعي)",
      labelEn: "Supply zone (Bearish FVG)",
      strength: 75,
    }));

  // Liquidity = clusters of equal highs/lows
  const liquidityZones: Zone[] = [];
  const cluster = (arr: number[], side: "BULL" | "BEAR") => {
    arr.sort((a, b) => a - b);
    for (let i = 0; i < arr.length - 1; i++) {
      const a = arr[i]!;
      const b = arr[i + 1]!;
      if (Math.abs(b - a) / Math.max(a, 1) < 0.0012) {
        liquidityZones.push({
          high: Math.max(a, b),
          low: Math.min(a, b),
          side: "LIQUIDITY",
          labelAr: side === "BEAR" ? "سيولة فوق (قمم متساوية)" : "سيولة تحت (قيعان متساوية)",
          labelEn: side === "BEAR" ? "Liquidity above (equal highs)" : "Liquidity below (equal lows)",
          strength: 80,
        });
      }
    }
  };
  cluster([...highsArr], "BEAR");
  cluster([...lowsArr], "BULL");
  // Cap to 3
  const liqDedup = liquidityZones.slice(0, 3);

  // ---------- Patterns ----------
  const patterns = detectPatterns(candles).slice(0, 4);
  const pBias = patternBias(patterns);
  // Chart patterns
  const chartPatterns = detectChartPatterns(candles, settings.swingLength).slice(0, 3);
  const chartPatternBias = chartPatterns.reduce((sum, p) => sum + (p.side === "BULL" ? p.strength : p.side === "BEAR" ? -p.strength : 0), 0);

  // ---------- Factor scoring board ----------
  const e20 = ema(closes, 20)[lastIdx];
  const e50 = ema(closes, 50)[lastIdx];
  const e200 = ema(closes, 200)[lastIdx];
  const r14 = rsi(closes, settings.rsiPeriod)[lastIdx];
  const m = macd(closes);
  const macdH = m.hist[lastIdx];
  const bb = bollinger(closes, 20, 2);
  const bbU = bb.upper[lastIdx]!;
  const bbL = bb.lower[lastIdx]!;
  const stoch = stochastic(candles, 14, 3);
  const stK = stoch.k[lastIdx]!;
  const aT = atr(candles, settings.atrPeriod)[lastIdx]!;
  const candleRange = last.h - last.l;

  const trendBull = e50 != null && e200 != null ? (e50 as number) > (e200 as number) : true;
  const trendStrength =
    e50 != null && e200 != null
      ? Math.min(100, Math.abs(((e50 as number) - (e200 as number)) / last.c) * 4000)
      : 0;
  const momentumBull = (r14 ?? 50) > 50;
  const momentumStrength = Math.min(100, Math.abs((r14 ?? 50) - 50) * 2);
  const macdBull = (macdH ?? 0) > 0;
  const macdStrength = Math.min(100, Math.abs((macdH ?? 0) / last.c) * 200000);
  const bbPos = (last.c - bbL) / Math.max(bbU - bbL, 1e-6);
  const stochBull = stK > 50 && stK < 80;
  const recentBreakout = base.bos.detected;
  const recentRetest =
    recentBreakout &&
    Math.abs(last.c - base.bos.brokenLevel) / last.c < 0.003;

  const factors: FactorScore[] = [
    {
      key: "trend",
      labelAr: "الاتجاه",
      labelEn: "Trend",
      state: base.trend === "RANGE" ? "NEU" : trendBull ? "POS" : "NEG",
      strength: Math.round(trendStrength),
      impact: "HIGH",
      rawAr: base.trend === "UPTREND" ? "صاعد" : base.trend === "DOWNTREND" ? "هابط" : "عرضي",
      rawEn: base.trend,
    },
    {
      key: "momentum",
      labelAr: "الزخم",
      labelEn: "Momentum",
      state: momentumBull ? "POS" : "NEG",
      strength: Math.round(momentumStrength),
      impact: "HIGH",
      rawAr: `RSI ${(r14 ?? 0).toFixed(1)}`,
      rawEn: `RSI ${(r14 ?? 0).toFixed(1)}`,
    },
    {
      key: "structure",
      labelAr: "الهيكل",
      labelEn: "Structure",
      state: base.bos.detected ? (base.bos.direction === "UP" ? "POS" : "NEG") : "NEU",
      strength: base.bos.detected ? 80 : 30,
      impact: "HIGH",
      rawAr: base.bos.detected
        ? `BOS ${base.bos.direction === "UP" ? "صاعد" : "هابط"}`
        : "لا كسر",
      rawEn: base.bos.detected ? `BOS ${base.bos.direction}` : "No BOS",
    },
    {
      key: "liquidity",
      labelAr: "السيولة",
      labelEn: "Liquidity",
      state: liqDedup.length > 0 ? "NEU" : "NEU",
      strength: liqDedup.length > 0 ? 65 : 30,
      impact: "MED",
      rawAr: `${liqDedup.length} منطقة`,
      rawEn: `${liqDedup.length} zones`,
    },
    {
      key: "volume",
      labelAr: "الحجم/الزخم السعري",
      labelEn: "Volume / Price-thrust",
      state: candleRange > aT ? "POS" : "NEG",
      strength: Math.round(Math.min(100, (candleRange / Math.max(aT, 1e-9)) * 50)),
      impact: "MED",
      rawAr: candleRange > aT ? "نشط" : "هادئ",
      rawEn: candleRange > aT ? "Active" : "Quiet",
    },
    {
      key: "volatility",
      labelAr: "التذبذب",
      labelEn: "Volatility",
      state: aT > last.c * 0.002 ? "POS" : "NEG",
      strength: Math.round(Math.min(100, (aT / Math.max(last.c, 1)) * 20000)),
      impact: "MED",
      rawAr: `ATR ${aT.toFixed(2)}`,
      rawEn: `ATR ${aT.toFixed(2)}`,
    },
    {
      key: "htf",
      labelAr: "الفريم الأعلى",
      labelEn: "Higher timeframe",
      state: base.activeTriggers.includes("MTF_OK") ? "POS" : "NEU",
      strength: base.activeTriggers.includes("MTF_OK") ? 75 : 40,
      impact: "HIGH",
      rawAr: base.activeTriggers.includes("MTF_OK") ? "متوافق" : "محايد",
      rawEn: base.activeTriggers.includes("MTF_OK") ? "Aligned" : "Neutral",
    },
    {
      key: "sr",
      labelAr: "الدعم/المقاومة",
      labelEn: "Support / Resistance",
      state: supports.length > 0 && resistances.length > 0 ? "POS" : "NEU",
      strength: 60,
      impact: "MED",
      rawAr: `${supports.length} دعم · ${resistances.length} مقاومة`,
      rawEn: `${supports.length}S · ${resistances.length}R`,
    },
    {
      key: "patterns",
      labelAr: "النماذج",
      labelEn: "Patterns",
      state: pBias > 10 ? "POS" : pBias < -10 ? "NEG" : "NEU",
      strength: Math.round(Math.abs(pBias)),
      impact: patterns.length > 0 ? "HIGH" : "LOW",
      rawAr: patterns[0] ? patterns[0].nameAr : "—",
      rawEn: patterns[0] ? patterns[0].nameEn : "—",
    },
    {
      key: "divergence",
      labelAr: "الانحرافات",
      labelEn: "Divergence",
      state: base.activeTriggers.includes("MACD_BULL_DIV")
        ? "POS"
        : base.activeTriggers.includes("MACD_BEAR_DIV")
          ? "NEG"
          : "NEU",
      strength: 70,
      impact: "MED",
      rawAr: base.activeTriggers.includes("MACD_BULL_DIV")
        ? "صاعد"
        : base.activeTriggers.includes("MACD_BEAR_DIV")
          ? "هابط"
          : "لا يوجد",
      rawEn: base.activeTriggers.includes("MACD_BULL_DIV")
        ? "Bullish"
        : base.activeTriggers.includes("MACD_BEAR_DIV")
          ? "Bearish"
          : "None",
    },
    {
      key: "fvg",
      labelAr: "الفجوات",
      labelEn: "Gaps (FVG)",
      state: demandZones.length > supplyZones.length ? "POS" : supplyZones.length > demandZones.length ? "NEG" : "NEU",
      strength: 60,
      impact: "MED",
      rawAr: `${demandZones.length} طلب · ${supplyZones.length} عرض`,
      rawEn: `${demandZones.length}D · ${supplyZones.length}S`,
    },
    {
      key: "breakout",
      labelAr: "الاختراق",
      labelEn: "Breakout",
      state: recentBreakout ? "POS" : "NEU",
      strength: recentBreakout ? 80 : 30,
      impact: "HIGH",
      rawAr: recentBreakout ? "محقق" : "غير موجود",
      rawEn: recentBreakout ? "Confirmed" : "None",
    },
    {
      key: "retest",
      labelAr: "إعادة الاختبار",
      labelEn: "Retest",
      state: recentRetest ? "POS" : "NEU",
      strength: recentRetest ? 85 : 30,
      impact: "MED",
      rawAr: recentRetest ? "نشط" : "—",
      rawEn: recentRetest ? "Active" : "—",
    },
  ];

  // Aggregate factor score: sign of state * strength * impact weight
  const impactWeight: Record<FactorImpact, number> = { HIGH: 3, MED: 2, LOW: 1 };
  let weighted = 0;
  let totalW = 0;
  for (const f of factors) {
    const w = impactWeight[f.impact];
    const sign = f.state === "POS" ? 1 : f.state === "NEG" ? -1 : 0;
    weighted += sign * (f.strength / 100) * w;
    totalW += w;
  }
  const factorScore = Math.round((weighted / Math.max(totalW, 1)) * 100);

  // ---------- Pending order suggestion ----------
  let pendingOrder: PendingOrder | null = null;
  if (base.signal !== "NEUTRAL" && base.fib) {
    const golden = (base.fib.goldenZone.high + base.fib.goldenZone.low) / 2;
    const dist = Math.abs(last.c - golden) / last.c;
    if (dist > 0.0015 && dist < 0.02) {
      const inGZ =
        last.c >= base.fib.goldenZone.low && last.c <= base.fib.goldenZone.high;
      if (!inGZ) {
        pendingOrder = {
          type:
            base.signal === "BUY"
              ? golden < last.c
                ? "BUY_LIMIT"
                : "BUY_STOP"
              : golden > last.c
                ? "SELL_LIMIT"
                : "SELL_STOP",
          price: golden,
          reasonAr:
            "أمر معلّق عند المنطقة الذهبية لفيبوناتشي للحصول على دخول أفضل.",
          reasonEn:
            "Pending order at Fibonacci golden zone for a better entry.",
        };
      }
    }
  }

  // ---------- Breakeven & trailing suggestions ----------
  const breakevenSuggestion =
    base.signal !== "NEUTRAL" && base.signal !== "WAIT" && base.signal !== "INVALID" && base.signal !== "HIGH_RISK"
      ? (lang === "ar"
        ? `اقتراح: نقل الوقف إلى نقطة التعادل ${entry.toFixed(2)} عندما يتجاوز السعر ${(entry + (entry - base.stopLoss) * 0.5).toFixed(2)}`
        : `Suggestion: Move SL to breakeven ${entry.toFixed(2)} when price crosses ${(entry + (entry - base.stopLoss) * 0.5).toFixed(2)}`)
      : null;
  const trailingSuggestion =
    base.signal !== "NEUTRAL" && base.signal !== "WAIT" && base.signal !== "INVALID" && base.signal !== "HIGH_RISK" && settings.useTrailing
      ? (lang === "ar"
        ? `الوقف المتتبع مفعّل: ملاحقة الوقف بمتواصلي على ATR مع كل انتقال مفادي ${base.atr.toFixed(2)}`
        : `Trailing stop active: trail at ATR ${base.atr.toFixed(2)} behind each major move`)
      : null;

  // ---------- Overall rating ----------
  const ratingScore = Math.round(
    Math.max(0, Math.min(100, base.confidence * 0.55 + Math.abs(factorScore) * 0.35 + Math.abs(pBias) * 0.1)),
  );
  let rating: Rating = "C";
  if (ratingScore >= 85) rating = "A+";
  else if (ratingScore >= 72) rating = "A";
  else if (ratingScore >= 58) rating = "B";
  else if (ratingScore >= 45) rating = "C";
  else rating = "D";

  const qualityLabelAr =
    rating === "A+"
      ? "ممتازة جداً"
      : rating === "A"
        ? "ممتازة"
        : rating === "B"
          ? "جيدة"
          : rating === "C"
            ? "متوسطة"
            : "ضعيفة";
  const qualityLabelEn =
    rating === "A+"
      ? "Excellent"
      : rating === "A"
        ? "Strong"
        : rating === "B"
          ? "Good"
          : rating === "C"
            ? "Average"
            : "Weak";

  return {
    base,
    tp1,
    tp2,
    tp3,
    reversalP1,
    reversalP2,
    reversalP3,
    riskReward,
    confirmConditions,
    cancelConditions,
    reasons,
    importantNotes,
    supports,
    resistances,
    demandZones,
    supplyZones,
    liquidityZones: liqDedup,
    patterns,
    patternBias: pBias,
    chartPatterns,
    chartPatternBias,
    factors,
    factorScore,
    pendingOrder,
    breakevenSuggestion,
    trailingSuggestion,
    rating,
    ratingScore,
    qualityLabelAr,
    qualityLabelEn,
  };
}
