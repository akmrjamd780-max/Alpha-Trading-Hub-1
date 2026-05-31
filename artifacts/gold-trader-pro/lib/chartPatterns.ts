import type { Candle } from "./marketData";

// =============================================================
// Chart Pattern Detection — classic geometric chart patterns
// (Head & Shoulders, Double Top/Bottom, Triple Top/Bottom, Flags,
// Triangles, Channels, Wedges). Works on swing points derived
// from the candle series.
// =============================================================

export type ChartPatternName =
  | "HEAD_SHOULDERS"
  | "INV_HEAD_SHOULDERS"
  | "DOUBLE_TOP"
  | "DOUBLE_BOTTOM"
  | "TRIPLE_TOP"
  | "TRIPLE_BOTTOM"
  | "BULL_FLAG"
  | "BEAR_FLAG"
  | "ASCENDING_TRIANGLE"
  | "DESCENDING_TRIANGLE"
  | "SYMMETRICAL_TRIANGLE"
  | "RISING_WEDGE"
  | "FALLING_WEDGE"
  | "BULL_CHANNEL"
  | "BEAR_CHANNEL";

export interface ChartPattern {
  name: ChartPatternName;
  labelAr: string;
  labelEn: string;
  side: "BULL" | "BEAR";
  strength: number; // 0..100
  startIdx: number;
  endIdx: number;
  // projected target zone
  targetHigh: number;
  targetLow: number;
  // neckline / key level
  keyLevel: number;
  descAr: string;
  descEn: string;
}

interface Swing {
  idx: number;
  price: number;
  type: "high" | "low";
}

function swingPoints(candles: Candle[], length: number = 5): Swing[] {
  const out: Swing[] = [];
  for (let i = length; i < candles.length - length; i++) {
    const isHigh = candles.slice(i - length, i).every((c) => c.h <= candles[i].h) &&
      candles.slice(i + 1, i + length + 1).every((c) => c.h <= candles[i].h);
    const isLow = candles.slice(i - length, i).every((c) => c.l >= candles[i].l) &&
      candles.slice(i + 1, i + length + 1).every((c) => c.l >= candles[i].l);
    if (isHigh) out.push({ idx: i, price: candles[i].h, type: "high" });
    if (isLow) out.push({ idx: i, price: candles[i].l, type: "low" });
  }
  return out;
}

function nearEqual(a: number, b: number, tolerance: number) {
  return Math.abs(a - b) <= tolerance;
}

function avg(...xs: number[]) {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

// ====== HEAD & SHOULDERS ======
function detectHeadShoulders(candles: Candle[], swings: Swing[], tolerance: number): ChartPattern[] {
  const res: ChartPattern[] = [];
  for (let i = 0; i < swings.length - 4; i++) {
    const s1 = swings[i], s2 = swings[i + 1], s3 = swings[i + 2], s4 = swings[i + 3], s5 = swings[i + 4];
    if (s1.type === "high" && s2.type === "low" && s3.type === "high" && s4.type === "low" && s5.type === "high") {
      const leftShoulder = s1.price, head = s3.price, rightShoulder = s5.price;
      const neckline = avg(s2.price, s4.price);
      if (head > leftShoulder && head > rightShoulder && nearEqual(leftShoulder, rightShoulder, tolerance)) {
        const strength = Math.min(100, Math.round((head - neckline) / (head * 0.01)));
        res.push({
          name: "HEAD_SHOULDERS",
          labelAr: "الرأس والكتفين",
          labelEn: "Head & Shoulders",
          side: "BEAR",
          strength,
          startIdx: s1.idx,
          endIdx: s5.idx,
          targetHigh: neckline,
          targetLow: neckline - (head - neckline),
          keyLevel: neckline,
          descAr: `شكل هبوط في الرأس والكتفين. الانهياري في ${neckline.toFixed(2)}. هدف منتظر ${(neckline - (head - neckline)).toFixed(2)}.`,
          descEn: `Bearish H&S. Neckline at ${neckline.toFixed(2)}. Target ${(neckline - (head - neckline)).toFixed(2)}.`,
        });
      }
    }
    if (s1.type === "low" && s2.type === "high" && s3.type === "low" && s4.type === "high" && s5.type === "low") {
      const leftShoulder = s1.price, head = s3.price, rightShoulder = s5.price;
      const neckline = avg(s2.price, s4.price);
      if (head < leftShoulder && head < rightShoulder && nearEqual(leftShoulder, rightShoulder, tolerance)) {
        const strength = Math.min(100, Math.round((neckline - head) / (neckline * 0.01)));
        res.push({
          name: "INV_HEAD_SHOULDERS",
          labelAr: "الرأس والكتفين المعكسان",
          labelEn: "Inverse Head & Shoulders",
          side: "BULL",
          strength,
          startIdx: s1.idx,
          endIdx: s5.idx,
          targetHigh: neckline + (neckline - head),
          targetLow: neckline,
          keyLevel: neckline,
          descAr: `شكل صعد في الرأس والكتفين المعكسان. الانهياري في ${neckline.toFixed(2)}. هدف منتظر ${(neckline + (neckline - head)).toFixed(2)}.`,
          descEn: `Bullish inverse H&S. Neckline at ${neckline.toFixed(2)}. Target ${(neckline + (neckline - head)).toFixed(2)}.`,
        });
      }
    }
  }
  return res;
}

// ====== DOUBLE / TRIPLE TOP / BOTTOM ======
function detectDoubleTriple(candles: Candle[], swings: Swing[], tolerance: number): ChartPattern[] {
  const res: ChartPattern[] = [];
  for (let i = 0; i < swings.length - 2; i++) {
    const s1 = swings[i], s2 = swings[i + 1], s3 = swings[i + 2];
    if (s1.type === "high" && s2.type === "low" && s3.type === "high") {
      if (nearEqual(s1.price, s3.price, tolerance)) {
        const drop = Math.abs(s3.price - s2.price);
        const target = s3.price - drop;
        res.push({
          name: "DOUBLE_TOP",
          labelAr: "القمة المزدوجة",
          labelEn: "Double Top",
          side: "BEAR",
          strength: Math.min(100, Math.round(drop / (s3.price * 0.01))),
          startIdx: s1.idx,
          endIdx: s3.idx,
          targetHigh: s2.price,
          targetLow: target,
          keyLevel: s2.price,
          descAr: `قمة مزدوجة. هدف منتظر ${target.toFixed(2)}.`,
          descEn: `Double top. Target ${target.toFixed(2)}.`,
        });
      }
    }
    if (s1.type === "low" && s2.type === "high" && s3.type === "low") {
      if (nearEqual(s1.price, s3.price, tolerance)) {
        const rise = Math.abs(s2.price - s3.price);
        const target = s3.price + rise;
        res.push({
          name: "DOUBLE_BOTTOM",
          labelAr: "القاعدة المزدوجة",
          labelEn: "Double Bottom",
          side: "BULL",
          strength: Math.min(100, Math.round(rise / (s3.price * 0.01))),
          startIdx: s1.idx,
          endIdx: s3.idx,
          targetHigh: target,
          targetLow: s2.price,
          keyLevel: s2.price,
          descAr: `قاعدة مزدوجة. هدف منتظر ${target.toFixed(2)}.`,
          descEn: `Double bottom. Target ${target.toFixed(2)}.`,
        });
      }
    }
  }
  // Triple top
  for (let i = 0; i < swings.length - 4; i++) {
    const th1 = swings[i], tl1 = swings[i + 1], th2 = swings[i + 2], tl2 = swings[i + 3], th3 = swings[i + 4];
    if (th1.type === "high" && tl1.type === "low" && th2.type === "high" && tl2.type === "low" && th3.type === "high") {
      const avgTop = avg(th1.price, th2.price, th3.price);
      if (nearEqual(avgTop, th1.price, tolerance) && nearEqual(avgTop, th2.price, tolerance) && nearEqual(avgTop, th3.price, tolerance)) {
        const drop = Math.abs(avgTop - avg(tl1.price, tl2.price));
        const target = avgTop - drop;
        res.push({
          name: "TRIPLE_TOP",
          labelAr: "القمة المثلثة",
          labelEn: "Triple Top",
          side: "BEAR",
          strength: Math.min(100, Math.round(drop / (avgTop * 0.01))),
          startIdx: th1.idx,
          endIdx: th3.idx,
          targetHigh: avg(tl1.price, tl2.price),
          targetLow: target,
          keyLevel: avg(tl1.price, tl2.price),
          descAr: `قمة مثلثة. هدف منتظر ${target.toFixed(2)}.`,
          descEn: `Triple top. Target ${target.toFixed(2)}.`,
        });
      }
    }
  }
  // Triple bottom
  for (let i = 0; i < swings.length - 4; i++) {
    const bl1 = swings[i], bh1 = swings[i + 1], bl2 = swings[i + 2], bh2 = swings[i + 3], bl3 = swings[i + 4];
    if (bl1.type === "low" && bh1.type === "high" && bl2.type === "low" && bh2.type === "high" && bl3.type === "low") {
      const avgBot = avg(bl1.price, bl2.price, bl3.price);
      if (nearEqual(avgBot, bl1.price, tolerance) && nearEqual(avgBot, bl2.price, tolerance) && nearEqual(avgBot, bl3.price, tolerance)) {
        const rise = Math.abs(avg(bh1.price, bh2.price) - avgBot);
        const target = avgBot + rise;
        res.push({
          name: "TRIPLE_BOTTOM",
          labelAr: "القاعدة المثلثة",
          labelEn: "Triple Bottom",
          side: "BULL",
          strength: Math.min(100, Math.round(rise / (avgBot * 0.01))),
          startIdx: bl1.idx,
          endIdx: bl3.idx,
          targetHigh: target,
          targetLow: avg(bh1.price, bh2.price),
          keyLevel: avg(bh1.price, bh2.price),
          descAr: `قاعدة مثلثة. هدف منتظر ${target.toFixed(2)}.`,
          descEn: `Triple bottom. Target ${target.toFixed(2)}.`,
        });
      }
    }
  }
  return res;
}

// ====== FLAGS / PENDANTS (continuation) ======
function detectFlags(candles: Candle[], tolerance: number): ChartPattern[] {
  const res: ChartPattern[] = [];
  if (candles.length < 30) return res;
  // Flag after strong move
  const lookback = 25;
  const start = Math.max(0, candles.length - lookback);
  const first = candles[start];
  const last = candles[candles.length - 1];
  const move = last.c - first.c;
  const atr = averageTrueRange(candles);
  const threshold = atr * 3;
  if (Math.abs(move) < threshold) return res;
  const poleUp = move > 0;
  // Check if last 5-12 candles form a small counter-trend channel
  const flagLen = Math.min(12, candles.length - start);
  const flagStart = candles.length - flagLen;
  const flagCandles = candles.slice(flagStart);
  const highs = flagCandles.map((c) => c.h);
  const lows = flagCandles.map((c) => c.l);
  // Fit regression lines
  const n = highs.length;
  const idxs = Array.from({ length: n }, (_, i) => i);
  const slopeHigh = linearSlope(idxs, highs);
  const slopeLow = linearSlope(idxs, lows);
  const isChannel = Math.abs(slopeHigh) < tolerance && Math.abs(slopeLow) < tolerance;
  if (isChannel) {
    const side = poleUp ? "BULL" : "BEAR";
    const name = poleUp ? "BULL_FLAG" : "BEAR_FLAG";
    const labelAr = poleUp ? "علم صعد مستمر" : "علم هبوط مستمر";
    const labelEn = poleUp ? "Bull Flag" : "Bear Flag";
    const target = poleUp ? last.c + Math.abs(move) : last.c - Math.abs(move);
    res.push({
      name,
      labelAr,
      labelEn,
      side: side as "BULL" | "BEAR",
      strength: Math.min(100, Math.round(Math.abs(move) / (last.c * 0.01))),
      startIdx: start,
      endIdx: candles.length - 1,
      targetHigh: poleUp ? target : last.c,
      targetLow: poleUp ? last.c : target,
      keyLevel: last.c,
      descAr: poleUp ? `علم صعد مستمر بعد حركة صعدية. هدف منتظر ${target.toFixed(2)}.` : `علم هبوط مستمر بعد حركة هبوطية. هدف منتظر ${target.toFixed(2)}.`,
      descEn: poleUp ? `Bull flag after a strong move. Target ${target.toFixed(2)}.` : `Bear flag after a strong move. Target ${target.toFixed(2)}.`,
    });
  }
  return res;
}

// ====== TRIANGLES ======
function detectTriangles(candles: Candle[], tolerance: number): ChartPattern[] {
  const res: ChartPattern[] = [];
  if (candles.length < 20) return res;
  const n = 15;
  const slice = candles.slice(-n);
  const highs = slice.map((c) => c.h);
  const lows = slice.map((c) => c.l);
  const idxs = Array.from({ length: n }, (_, i) => i);
  const slopeHigh = linearSlope(idxs, highs);
  const slopeLow = linearSlope(idxs, lows);
  const lastH = highs[highs.length - 1];
  const lastL = lows[lows.length - 1];
  const isApex = Math.abs(lastH - lastL) < tolerance * 3;
  if (slopeHigh < 0 && slopeLow > 0 && isApex) {
    const side = Math.abs(slopeHigh) > Math.abs(slopeLow) ? "BEAR" : "BULL";
    res.push({
      name: "SYMMETRICAL_TRIANGLE",
      labelAr: "مثلث متساوي",
      labelEn: "Symmetrical Triangle",
      side,
      strength: Math.min(100, Math.round(Math.abs(slopeHigh - slopeLow) / (lastH * 0.001))),
      startIdx: candles.length - n,
      endIdx: candles.length - 1,
      targetHigh: lastH + (lastH - lastL),
      targetLow: lastL - (lastH - lastL),
      keyLevel: (lastH + lastL) / 2,
      descAr: "مثلث متساوي قائم للانفجار.",
      descEn: "Symmetrical triangle converging toward breakout.",
    });
  }
  if (slopeHigh < 0 && slopeLow > 0.02 && Math.abs(slopeHigh) < tolerance) {
    res.push({
      name: "ASCENDING_TRIANGLE",
      labelAr: "مثلث صعدي",
      labelEn: "Ascending Triangle",
      side: "BULL",
      strength: Math.min(100, Math.round(Math.abs(slopeLow) / (lastH * 0.001))),
      startIdx: candles.length - n,
      endIdx: candles.length - 1,
      targetHigh: lastH + (lastH - lastL),
      targetLow: lastL,
      keyLevel: lastH,
      descAr: "مثلث صعدي مقاوم. انفجار صعدي محتمل.",
      descEn: "Ascending triangle with flat resistance. Bullish breakout likely.",
    });
  }
  if (slopeHigh < -0.02 && slopeLow > 0 && Math.abs(slopeLow) < tolerance) {
    res.push({
      name: "DESCENDING_TRIANGLE",
      labelAr: "مثلث هبوطي",
      labelEn: "Descending Triangle",
      side: "BEAR",
      strength: Math.min(100, Math.round(Math.abs(slopeHigh) / (lastH * 0.001))),
      startIdx: candles.length - n,
      endIdx: candles.length - 1,
      targetHigh: lastH,
      targetLow: lastL - (lastH - lastL),
      keyLevel: lastL,
      descAr: "مثلث هبوطي مقاوم. انفجار هبوطي محتمل.",
      descEn: "Descending triangle with flat support. Bearish breakdown likely.",
    });
  }
  return res;
}

// ====== WEDGES ======
function detectWedges(candles: Candle[], tolerance: number): ChartPattern[] {
  const res: ChartPattern[] = [];
  if (candles.length < 20) return res;
  const n = 15;
  const slice = candles.slice(-n);
  const highs = slice.map((c) => c.h);
  const lows = slice.map((c) => c.l);
  const idxs = Array.from({ length: n }, (_, i) => i);
  const slopeHigh = linearSlope(idxs, highs);
  const slopeLow = linearSlope(idxs, lows);
  const lastH = highs[highs.length - 1];
  const lastL = lows[lows.length - 1];
  const isConverging = slopeHigh < 0 && slopeLow > 0;
  const isDiverging = slopeHigh > 0 && slopeLow < 0;
  if (isConverging && slopeHigh < -0.01 && slopeLow > 0.01) {
    const isRising = slopeLow > Math.abs(slopeHigh);
    const side: "BULL" | "BEAR" = isRising ? "BULL" : "BEAR";
    const name: ChartPatternName = isRising ? "RISING_WEDGE" : "FALLING_WEDGE";
    res.push({
      name,
      labelAr: isRising ? "ودج صعدي" : "ودج هبوطي",
      labelEn: isRising ? "Rising Wedge" : "Falling Wedge",
      side,
      strength: Math.min(100, Math.round(Math.abs(slopeHigh - slopeLow) / (lastH * 0.001))),
      startIdx: candles.length - n,
      endIdx: candles.length - 1,
      targetHigh: isRising ? lastH + (lastH - lastL) : lastH,
      targetLow: isRising ? lastL : lastL - (lastH - lastL),
      keyLevel: (lastH + lastL) / 2,
      descAr: isRising ? "ودج صعدي متقارب. انفجار هبوطي محتمل." : "ودج هبوطي متقارب. انفجار صعدي محتمل.",
      descEn: isRising ? "Rising wedge converging. Bearish breakout expected." : "Falling wedge converging. Bullish breakout expected.",
    });
  }
  if (isDiverging && Math.abs(slopeHigh) > 0.01 && Math.abs(slopeLow) > 0.01) {
    const isBullChannel = slopeHigh > 0 && slopeLow > 0;
    const side: "BULL" | "BEAR" = isBullChannel ? "BULL" : "BEAR";
    const name: ChartPatternName = isBullChannel ? "BULL_CHANNEL" : "BEAR_CHANNEL";
    res.push({
      name,
      labelAr: isBullChannel ? "قناة صعدية" : "قناة هبوطية",
      labelEn: isBullChannel ? "Bull Channel" : "Bear Channel",
      side,
      strength: Math.min(100, Math.round(Math.abs(slopeHigh) / (lastH * 0.001))),
      startIdx: candles.length - n,
      endIdx: candles.length - 1,
      targetHigh: isBullChannel ? lastH + (lastH - lastL) : lastH,
      targetLow: isBullChannel ? lastL : lastL - (lastH - lastL),
      keyLevel: (lastH + lastL) / 2,
      descAr: isBullChannel ? "قناة صعدية متمايزة." : "قناة هبوطية متمايزة.",
      descEn: isBullChannel ? "Bull channel maintaining upward slope." : "Bear channel maintaining downward slope.",
    });
  }
  return res;
}

// ====== HELPERS ======
function averageTrueRange(candles: Candle[]): number {
  if (candles.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const c = candles[i];
    const tr = Math.max(c.h - c.l, Math.abs(c.h - prev.c), Math.abs(c.l - prev.c));
    sum += tr;
  }
  return sum / (candles.length - 1);
}

function linearSlope(xs: number[], ys: number[]): number {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) * (x - mx), 0);
  return den === 0 ? 0 : num / den;
}

// ====== MAIN ENTRY ======
export function detectChartPatterns(candles: Candle[], swingLength: number = 5): ChartPattern[] {
  const swings = swingPoints(candles, swingLength);
  const atr = averageTrueRange(candles);
  const tolerance = Math.max(atr * 0.5, candles[candles.length - 1]?.c * 0.001 || 0.5);

  const res: ChartPattern[] = [
    ...detectHeadShoulders(candles, swings, tolerance),
    ...detectDoubleTriple(candles, swings, tolerance),
    ...detectFlags(candles, tolerance),
    ...detectTriangles(candles, tolerance),
    ...detectWedges(candles, tolerance),
  ];

  // Sort by recency (endIdx) and strength
  res.sort((a, b) => b.endIdx - a.endIdx || b.strength - a.strength);
  return res.slice(0, 3); // Keep top 3 most recent
}
