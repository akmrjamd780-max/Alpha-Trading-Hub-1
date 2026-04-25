import type { Candle } from "./marketData";

// =============================================================
// Candlestick pattern detection — high-precision detector for the
// most reliable Japanese candle patterns. Each pattern returns a
// { name, side, strength (0..100), description } when matched on
// the most recent candle(s).
// =============================================================

export type PatternSide = "BULL" | "BEAR" | "NEUTRAL";

export interface DetectedPattern {
  key: string;
  nameAr: string;
  nameEn: string;
  side: PatternSide;
  strength: number;
  index: number;
  descAr: string;
  descEn: string;
}

function body(c: Candle) {
  return Math.abs(c.c - c.o);
}
function range(c: Candle) {
  return Math.max(c.h - c.l, 1e-9);
}
function upperShadow(c: Candle) {
  return c.h - Math.max(c.o, c.c);
}
function lowerShadow(c: Candle) {
  return Math.min(c.o, c.c) - c.l;
}
function isBull(c: Candle) {
  return c.c > c.o;
}
function isBear(c: Candle) {
  return c.c < c.o;
}

/** Detect the most relevant patterns on the latest candles. */
export function detectPatterns(candles: Candle[]): DetectedPattern[] {
  if (candles.length < 5) return [];
  const out: DetectedPattern[] = [];
  const n = candles.length;
  const c0 = candles[n - 1]!; // current
  const c1 = candles[n - 2]!; // prev
  const c2 = candles[n - 3]!; // prev-prev
  const i = n - 1;

  const b0 = body(c0);
  const r0 = range(c0);
  const us0 = upperShadow(c0);
  const ls0 = lowerShadow(c0);
  const b1 = body(c1);
  const r1 = range(c1);

  // --- Doji
  if (b0 / r0 < 0.1 && r0 > 0) {
    out.push({
      key: "doji",
      nameAr: "دوجي",
      nameEn: "Doji",
      side: "NEUTRAL",
      strength: 60,
      index: i,
      descAr: "تردد قوي وعدم حسم بين المشترين والبائعين.",
      descEn: "Strong indecision between buyers and sellers.",
    });
  }

  // --- Hammer (bullish reversal)
  if (
    ls0 > 2 * b0 &&
    us0 < b0 * 0.6 &&
    b0 / r0 > 0.05 &&
    isBull(c0) &&
    c1.c < c2.c
  ) {
    out.push({
      key: "hammer",
      nameAr: "المطرقة",
      nameEn: "Hammer",
      side: "BULL",
      strength: 78,
      index: i,
      descAr: "رفض قوي للأسعار المنخفضة — احتمال انعكاس صاعد.",
      descEn: "Strong rejection of lower prices — potential bullish reversal.",
    });
  }

  // --- Shooting Star (bearish reversal)
  if (
    us0 > 2 * b0 &&
    ls0 < b0 * 0.6 &&
    b0 / r0 > 0.05 &&
    isBear(c0) &&
    c1.c > c2.c
  ) {
    out.push({
      key: "shooting_star",
      nameAr: "النجم الساقط",
      nameEn: "Shooting Star",
      side: "BEAR",
      strength: 78,
      index: i,
      descAr: "رفض قوي للأسعار المرتفعة — احتمال انعكاس هابط.",
      descEn: "Strong rejection of higher prices — potential bearish reversal.",
    });
  }

  // --- Bullish Engulfing
  if (
    isBear(c1) &&
    isBull(c0) &&
    c0.o <= c1.c &&
    c0.c >= c1.o &&
    b0 > b1 * 1.1
  ) {
    out.push({
      key: "bull_engulf",
      nameAr: "ابتلاع شرائي",
      nameEn: "Bullish Engulfing",
      side: "BULL",
      strength: 85,
      index: i,
      descAr: "شمعة شرائية قوية تبتلع البيع السابق.",
      descEn: "Strong bullish candle engulfs the prior selling.",
    });
  }

  // --- Bearish Engulfing
  if (
    isBull(c1) &&
    isBear(c0) &&
    c0.o >= c1.c &&
    c0.c <= c1.o &&
    b0 > b1 * 1.1
  ) {
    out.push({
      key: "bear_engulf",
      nameAr: "ابتلاع بيعي",
      nameEn: "Bearish Engulfing",
      side: "BEAR",
      strength: 85,
      index: i,
      descAr: "شمعة بيعية قوية تبتلع الشراء السابق.",
      descEn: "Strong bearish candle engulfs the prior buying.",
    });
  }

  // --- Marubozu (bullish/bearish full body)
  if (b0 / r0 > 0.92 && r0 > 0) {
    if (isBull(c0)) {
      out.push({
        key: "bull_marubozu",
        nameAr: "ماروبوزو شرائي",
        nameEn: "Bullish Marubozu",
        side: "BULL",
        strength: 80,
        index: i,
        descAr: "شمعة جسم كامل بدون ذيول — قوة شرائية مطلقة.",
        descEn: "Full-body candle without shadows — pure buying strength.",
      });
    } else if (isBear(c0)) {
      out.push({
        key: "bear_marubozu",
        nameAr: "ماروبوزو بيعي",
        nameEn: "Bearish Marubozu",
        side: "BEAR",
        strength: 80,
        index: i,
        descAr: "شمعة جسم كامل بدون ذيول — قوة بيعية مطلقة.",
        descEn: "Full-body candle without shadows — pure selling strength.",
      });
    }
  }

  // --- Bullish Harami (small bull inside prior bear)
  if (
    isBear(c1) &&
    isBull(c0) &&
    c0.o > c1.c &&
    c0.c < c1.o &&
    b0 < b1 * 0.7
  ) {
    out.push({
      key: "bull_harami",
      nameAr: "حامل شرائي",
      nameEn: "Bullish Harami",
      side: "BULL",
      strength: 65,
      index: i,
      descAr: "احتمال انعكاس صاعد عقب موجة هبوط قصيرة.",
      descEn: "Potential bullish reversal after a short decline.",
    });
  }

  // --- Bearish Harami
  if (
    isBull(c1) &&
    isBear(c0) &&
    c0.o < c1.c &&
    c0.c > c1.o &&
    b0 < b1 * 0.7
  ) {
    out.push({
      key: "bear_harami",
      nameAr: "حامل بيعي",
      nameEn: "Bearish Harami",
      side: "BEAR",
      strength: 65,
      index: i,
      descAr: "احتمال انعكاس هابط عقب موجة صعود قصيرة.",
      descEn: "Potential bearish reversal after a short rally.",
    });
  }

  // --- Piercing Line (bull)
  if (
    isBear(c1) &&
    isBull(c0) &&
    c0.o < c1.l &&
    c0.c > (c1.o + c1.c) / 2 &&
    c0.c < c1.o
  ) {
    out.push({
      key: "piercing",
      nameAr: "خط الاختراق",
      nameEn: "Piercing Line",
      side: "BULL",
      strength: 72,
      index: i,
      descAr: "اختراق نصف شمعة الهبوط — إشارة شرائية.",
      descEn: "Penetrates over half of prior bearish candle — bullish signal.",
    });
  }

  // --- Dark Cloud Cover (bear)
  if (
    isBull(c1) &&
    isBear(c0) &&
    c0.o > c1.h &&
    c0.c < (c1.o + c1.c) / 2 &&
    c0.c > c1.o
  ) {
    out.push({
      key: "dark_cloud",
      nameAr: "السحابة السوداء",
      nameEn: "Dark Cloud Cover",
      side: "BEAR",
      strength: 72,
      index: i,
      descAr: "تغطية أكثر من نصف شمعة الصعود — إشارة بيعية.",
      descEn: "Covers over half of prior bullish candle — bearish signal.",
    });
  }

  // --- Morning Star (3-candle bull reversal)
  if (n >= 3 && isBear(c2) && b1 / range(c1) < 0.4 && isBull(c0) && c0.c > (c2.o + c2.c) / 2) {
    out.push({
      key: "morning_star",
      nameAr: "نجمة الصباح",
      nameEn: "Morning Star",
      side: "BULL",
      strength: 88,
      index: i,
      descAr: "نموذج انعكاسي قوي ثلاثي الشموع نحو الصعود.",
      descEn: "Strong three-candle bullish reversal pattern.",
    });
  }

  // --- Evening Star (3-candle bear reversal)
  if (n >= 3 && isBull(c2) && b1 / range(c1) < 0.4 && isBear(c0) && c0.c < (c2.o + c2.c) / 2) {
    out.push({
      key: "evening_star",
      nameAr: "نجمة المساء",
      nameEn: "Evening Star",
      side: "BEAR",
      strength: 88,
      index: i,
      descAr: "نموذج انعكاسي قوي ثلاثي الشموع نحو الهبوط.",
      descEn: "Strong three-candle bearish reversal pattern.",
    });
  }

  // --- Three White Soldiers
  if (n >= 3 && isBull(c2) && isBull(c1) && isBull(c0)) {
    if (c1.c > c2.c && c0.c > c1.c && c1.o > c2.o && c0.o > c1.o) {
      out.push({
        key: "three_soldiers",
        nameAr: "الجنود الثلاثة",
        nameEn: "Three White Soldiers",
        side: "BULL",
        strength: 90,
        index: i,
        descAr: "ثلاث شموع شرائية متتالية — استمرار صعودي قوي.",
        descEn: "Three consecutive bullish candles — strong uptrend continuation.",
      });
    }
  }

  // --- Three Black Crows
  if (n >= 3 && isBear(c2) && isBear(c1) && isBear(c0)) {
    if (c1.c < c2.c && c0.c < c1.c && c1.o < c2.o && c0.o < c1.o) {
      out.push({
        key: "three_crows",
        nameAr: "الغربان الثلاثة",
        nameEn: "Three Black Crows",
        side: "BEAR",
        strength: 90,
        index: i,
        descAr: "ثلاث شموع بيعية متتالية — استمرار هبوطي قوي.",
        descEn: "Three consecutive bearish candles — strong downtrend continuation.",
      });
    }
  }

  // --- Tweezer Top
  if (Math.abs(c0.h - c1.h) / Math.max(c0.h, 1e-9) < 0.0008 && isBear(c0) && isBull(c1)) {
    out.push({
      key: "tweezer_top",
      nameAr: "قمة الملقاط",
      nameEn: "Tweezer Top",
      side: "BEAR",
      strength: 70,
      index: i,
      descAr: "قمتان متطابقتان — منطقة مقاومة قوية.",
      descEn: "Two equal highs — strong resistance area.",
    });
  }

  // --- Tweezer Bottom
  if (Math.abs(c0.l - c1.l) / Math.max(c0.l, 1e-9) < 0.0008 && isBull(c0) && isBear(c1)) {
    out.push({
      key: "tweezer_bottom",
      nameAr: "قاع الملقاط",
      nameEn: "Tweezer Bottom",
      side: "BULL",
      strength: 70,
      index: i,
      descAr: "قاعان متطابقان — منطقة دعم قوية.",
      descEn: "Two equal lows — strong support area.",
    });
  }

  // sort by strength desc
  return out.sort((a, b) => b.strength - a.strength);
}

/** Aggregate pattern bias on the latest candles: -100..+100 */
export function patternBias(patterns: DetectedPattern[]): number {
  if (patterns.length === 0) return 0;
  let s = 0;
  let w = 0;
  for (const p of patterns) {
    const sign = p.side === "BULL" ? 1 : p.side === "BEAR" ? -1 : 0;
    s += sign * p.strength;
    w += p.strength;
  }
  return w > 0 ? Math.round((s / w) * 100) / 100 : 0;
}
