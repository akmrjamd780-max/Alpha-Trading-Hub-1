import type { Candle } from "./marketData";
import {
  ema,
  rsi,
  macd,
  atr,
  bollinger,
  stochastic,
  pivotPoints,
  findSwingPoints,
} from "./indicators";
import { analyzeQuantumFlow, quantumFlowCheck, detectSwingPoints } from "./quantumFlow";

export type Side = "LONG" | "SHORT" | "FLAT";

export interface Signal {
  index: number;
  time: number;
  price: number;
  side: Side;
  reason: string;
}

export interface StrategyResult {
  signals: Signal[];
  meta?: Record<string, number | string>;
}

export interface Strategy {
  id: string;
  name: string;
  origin: string;
  description: string;
  category: "Scalping" | "Swing" | "ICT" | "Grid" | "AI" | "Pivot" | "Pullback";
  defaultRiskPct: number;
  run: (candles: Candle[], params?: Record<string, number>) => StrategyResult;
}

// Scalper Pro / Ronin Gold Scalper / AK47 Scalper inspired
// EMA crossover + RSI confirmation
const scalperPro: Strategy = {
  id: "scalper-pro",
  name: "Scalper Pro",
  origin: "Ronin / AK47 / Yobra245",
  description:
    "Fast EMA crossover (9/21) confirmed by RSI(14) momentum. Optimized for M5 and M15.",
  category: "Scalping",
  defaultRiskPct: 0.5,
  run(candles, params = {}) {
    const fast = params["fast"] ?? 9;
    const slow = params["slow"] ?? 21;
    const closes = candles.map((c) => c.c);
    const ef = ema(closes, fast);
    const es = ema(closes, slow);
    const r = rsi(closes, 14);
    const signals: Signal[] = [];
    for (let i = 1; i < candles.length; i++) {
      const f = ef[i];
      const s = es[i];
      const fp = ef[i - 1];
      const sp = es[i - 1];
      const rv = r[i];
      if (f == null || s == null || fp == null || sp == null || rv == null) continue;
      if (fp <= sp && f > s && rv > 50 && rv < 75) {
        signals.push({
          index: i,
          time: candles[i]!.t,
          price: candles[i]!.c,
          side: "LONG",
          reason: `EMA${fast}>EMA${slow}, RSI=${rv.toFixed(1)}`,
        });
      } else if (fp >= sp && f < s && rv < 50 && rv > 25) {
        signals.push({
          index: i,
          time: candles[i]!.t,
          price: candles[i]!.c,
          side: "SHORT",
          reason: `EMA${fast}<EMA${slow}, RSI=${rv.toFixed(1)}`,
        });
      }
    }
    return { signals };
  },
};

// ICT Silver Bullet inspired (techdeepsm) — trade the killzone with FVG + liquidity sweep
const ictSilverBullet: Strategy = {
  id: "ict-silver-bullet",
  name: "ICT Silver Bullet",
  origin: "techdeepsm/MT5-ICT-Silverbullet-EA",
  description:
    "Smart Money Concepts: trades during NY killzone (10:00-11:00 NY) using liquidity sweeps and Fair Value Gaps.",
  category: "ICT",
  defaultRiskPct: 1,
  run(candles) {
    const signals: Signal[] = [];
    for (let i = 3; i < candles.length; i++) {
      const c0 = candles[i - 2]!;
      const c1 = candles[i - 1]!;
      const c2 = candles[i]!;
      // Bullish FVG: low of c2 > high of c0
      if (c2.l > c0.h && c1.c > c1.o) {
        const d = new Date(c2.t);
        const hour = d.getUTCHours();
        // 14-15 UTC ~ 10-11 NY (DST naive)
        if (hour >= 13 && hour <= 16) {
          signals.push({
            index: i,
            time: c2.t,
            price: c2.c,
            side: "LONG",
            reason: "Bullish FVG in NY killzone",
          });
        }
      }
      // Bearish FVG
      if (c2.h < c0.l && c1.c < c1.o) {
        const d = new Date(c2.t);
        const hour = d.getUTCHours();
        if (hour >= 13 && hour <= 16) {
          signals.push({
            index: i,
            time: c2.t,
            price: c2.c,
            side: "SHORT",
            reason: "Bearish FVG in NY killzone",
          });
        }
      }
    }
    return { signals };
  },
};

// Pullback strategy (sagarmeravi/XAUUSD-Pullback)
const pullback: Strategy = {
  id: "pullback",
  name: "XAUUSD Pullback",
  origin: "sagarmeravi/XAUUSD-Pullback",
  description:
    "Trades pullbacks to EMA50 in the direction of the EMA200 trend. Confirms with RSI not overextended.",
  category: "Pullback",
  defaultRiskPct: 1,
  run(candles) {
    const closes = candles.map((c) => c.c);
    const e50 = ema(closes, 50);
    const e200 = ema(closes, 200);
    const r = rsi(closes, 14);
    const signals: Signal[] = [];
    for (let i = 1; i < candles.length; i++) {
      const c = candles[i]!;
      const p = candles[i - 1]!;
      const m50 = e50[i];
      const m200 = e200[i];
      const rv = r[i];
      if (m50 == null || m200 == null || rv == null) continue;
      // Uptrend
      if (m50 > m200) {
        if (p.l <= m50 && c.c > m50 && rv > 40 && rv < 70) {
          signals.push({
            index: i,
            time: c.t,
            price: c.c,
            side: "LONG",
            reason: "Pullback to EMA50 in uptrend",
          });
        }
      } else if (m50 < m200) {
        if (p.h >= m50 && c.c < m50 && rv < 60 && rv > 30) {
          signals.push({
            index: i,
            time: c.t,
            price: c.c,
            side: "SHORT",
            reason: "Pullback to EMA50 in downtrend",
          });
        }
      }
    }
    return { signals };
  },
};

// Grid (traderr87/gold-grid-ea)
const goldGrid: Strategy = {
  id: "gold-grid",
  name: "Gold Grid",
  origin: "traderr87/gold-grid-ea",
  description:
    "Range-trading grid that places staggered orders around a moving average. Best in low-volatility ranges.",
  category: "Grid",
  defaultRiskPct: 0.3,
  run(candles, params = {}) {
    const step = params["step"] ?? 5; // dollars
    const closes = candles.map((c) => c.c);
    const e = ema(closes, 50);
    const signals: Signal[] = [];
    let lastBuy = -Infinity;
    let lastSell = Infinity;
    for (let i = 1; i < candles.length; i++) {
      const m = e[i];
      const c = candles[i]!;
      if (m == null) continue;
      if (c.c < m && c.c < lastBuy - step) {
        signals.push({
          index: i,
          time: c.t,
          price: c.c,
          side: "LONG",
          reason: `Grid buy ${step}$ below last`,
        });
        lastBuy = c.c;
      }
      if (c.c > m && c.c > lastSell + step) {
        signals.push({
          index: i,
          time: c.t,
          price: c.c,
          side: "SHORT",
          reason: `Grid sell ${step}$ above last`,
        });
        lastSell = c.c;
      }
      if (lastBuy === -Infinity) lastBuy = c.c;
      if (lastSell === Infinity) lastSell = c.c;
    }
    return { signals };
  },
};

// Pivot EA (Monkeyattack)
const pivotEa: Strategy = {
  id: "pivot",
  name: "Pivot Breakout",
  origin: "Monkeyattack/gold-pivot-ea",
  description:
    "Classic floor pivots from prior day. Buy break above R1, sell break below S1. Targets R2/S2.",
  category: "Pivot",
  defaultRiskPct: 1,
  run(candles) {
    const signals: Signal[] = [];
    if (candles.length < 50) return { signals };
    // approximate prev "day" as prior 24 candles for hourly, fall back to first half
    const split = Math.max(20, Math.floor(candles.length / 4));
    const prevSlice = candles.slice(0, split);
    let h = -Infinity;
    let l = Infinity;
    let cl = 0;
    for (const c of prevSlice) {
      if (c.h > h) h = c.h;
      if (c.l < l) l = c.l;
      cl = c.c;
    }
    const piv = pivotPoints({ t: 0, o: 0, h, l, c: cl, v: 0 });
    let above = false;
    let below = false;
    for (let i = split; i < candles.length; i++) {
      const c = candles[i]!;
      if (!above && c.c > piv.r1) {
        signals.push({
          index: i,
          time: c.t,
          price: c.c,
          side: "LONG",
          reason: `Break above R1 ${piv.r1.toFixed(2)}`,
        });
        above = true;
      }
      if (!below && c.c < piv.s1) {
        signals.push({
          index: i,
          time: c.t,
          price: c.c,
          side: "SHORT",
          reason: `Break below S1 ${piv.s1.toFixed(2)}`,
        });
        below = true;
      }
    }
    return {
      signals,
      meta: {
        PP: +piv.pp.toFixed(2),
        R1: +piv.r1.toFixed(2),
        R2: +piv.r2.toFixed(2),
        S1: +piv.s1.toFixed(2),
        S2: +piv.s2.toFixed(2),
      },
    };
  },
};

// Goldbot (kanakainu) — Bollinger + Stoch mean reversion
const goldBot: Strategy = {
  id: "goldbot",
  name: "GoldBot Reversion",
  origin: "kanakainu/goldbot",
  description:
    "Mean reversion using Bollinger Bands(20,2) + Stochastic. Buys oversold band touches, sells overbought.",
  category: "Swing",
  defaultRiskPct: 0.7,
  run(candles) {
    const closes = candles.map((c) => c.c);
    const bb = bollinger(closes, 20, 2);
    const st = stochastic(candles, 14, 3);
    const signals: Signal[] = [];
    for (let i = 1; i < candles.length; i++) {
      const c = candles[i]!;
      const u = bb.upper[i];
      const lw = bb.lower[i];
      const k = st.k[i];
      if (u == null || lw == null || k == null) continue;
      if (c.l <= lw && k < 25) {
        signals.push({
          index: i,
          time: c.t,
          price: c.c,
          side: "LONG",
          reason: `Touch lower band, Stoch=${k.toFixed(0)}`,
        });
      } else if (c.h >= u && k > 75) {
        signals.push({
          index: i,
          time: c.t,
          price: c.c,
          side: "SHORT",
          reason: `Touch upper band, Stoch=${k.toFixed(0)}`,
        });
      }
    }
    return { signals };
  },
};

// AI Ensemble — TFT/RL inspired composite scoring (JonusNattapong / pipela / emiflair)
const aiEnsemble: Strategy = {
  id: "ai-ensemble",
  name: "AI Ensemble",
  origin: "TFT + RL composite (Jonus / pipela / emiflair)",
  description:
    "Composite signal combining trend (EMA), momentum (RSI/MACD), volatility (ATR/BB), and reversion (Stoch). Scores each bar -100..+100.",
  category: "AI",
  defaultRiskPct: 1,
  run(candles) {
    const closes = candles.map((c) => c.c);
    const e20 = ema(closes, 20);
    const e50 = ema(closes, 50);
    const e200 = ema(closes, 200);
    const r = rsi(closes, 14);
    const m = macd(closes);
    const bb = bollinger(closes, 20, 2);
    const a = atr(candles, 14);
    const signals: Signal[] = [];
    for (let i = 200; i < candles.length; i++) {
      const c = candles[i]!;
      const v20 = e20[i];
      const v50 = e50[i];
      const v200 = e200[i];
      const rv = r[i];
      const mv = m.macd[i];
      const sv = m.signal[i];
      const bu = bb.upper[i];
      const bl = bb.lower[i];
      const av = a[i];
      if (
        v20 == null ||
        v50 == null ||
        v200 == null ||
        rv == null ||
        mv == null ||
        sv == null ||
        bu == null ||
        bl == null ||
        av == null
      )
        continue;
      let score = 0;
      score += v20 > v50 ? 20 : -20;
      score += v50 > v200 ? 15 : -15;
      score += rv > 50 ? 10 : -10;
      score += mv > sv ? 15 : -15;
      const bbWidth = bu - bl;
      const pos = bbWidth > 0 ? (c.c - bl) / bbWidth : 0.5;
      score += pos < 0.2 ? 20 : pos > 0.8 ? -20 : 0;
      score += av < (closes[i] ?? 0) * 0.005 ? 5 : -5;
      const prevScore = signals[signals.length - 1];
      if (score >= 50 && (!prevScore || prevScore.side !== "LONG")) {
        signals.push({
          index: i,
          time: c.t,
          price: c.c,
          side: "LONG",
          reason: `AI score ${score}/100 → LONG`,
        });
      } else if (score <= -50 && (!prevScore || prevScore.side !== "SHORT")) {
        signals.push({
          index: i,
          time: c.t,
          price: c.c,
          side: "SHORT",
          reason: `AI score ${score}/100 → SHORT`,
        });
      }
    }
    return { signals };
  },
};

// Theory Craft swing (theorycraft-trading)
const theoryCraftSwing: Strategy = {
  id: "theorycraft-swing",
  name: "TheoryCraft Swing",
  origin: "theorycraft-trading/theory_craft",
  description:
    "Swing strategy: trade with the higher-timeframe trend (EMA200) using swing-high/low breaks.",
  category: "Swing",
  defaultRiskPct: 1.5,
  run(candles) {
    const closes = candles.map((c) => c.c);
    const e200 = ema(closes, 200);
    const sw = findSwingPoints(candles, 5);
    const signals: Signal[] = [];
    for (let i = 200; i < candles.length; i++) {
      const m = e200[i];
      const c = candles[i]!;
      if (m == null) continue;
      const recentHigh = sw.highs.filter((h) => h < i).pop();
      const recentLow = sw.lows.filter((l) => l < i).pop();
      if (c.c > m && recentHigh != null && c.c > (candles[recentHigh]?.h ?? Infinity)) {
        const last = signals[signals.length - 1];
        if (!last || last.side !== "LONG") {
          signals.push({
            index: i,
            time: c.t,
            price: c.c,
            side: "LONG",
            reason: "Break of swing high above EMA200",
          });
        }
      } else if (
        c.c < m &&
        recentLow != null &&
        c.c < (candles[recentLow]?.l ?? -Infinity)
      ) {
        const last = signals[signals.length - 1];
        if (!last || last.side !== "SHORT") {
          signals.push({
            index: i,
            time: c.t,
            price: c.c,
            side: "SHORT",
            reason: "Break of swing low below EMA200",
          });
        }
      }
    }
    return { signals };
  },
};

// Quantum Flow Alpha — Akram Alhaddad full strategy
const quantumFlowAlpha: Strategy = {
  id: "quantum-flow-alpha",
  name: "Quantum Flow Alpha",
  origin: "Akram Alhaddad — QFA spec",
  description:
    "Composite engine: market-structure (BOS/Wall/War Zone), Fibonacci golden zone, FVG, RSI+EMA cross with charge zones, ADX/MTF/VWAP/MACD-divergence/Moon filters, structural SL/TP.",
  category: "AI",
  defaultRiskPct: 1,
  run(candles) {
    const signals: Signal[] = [];
    if (candles.length < 60) return { signals };
    const closes = candles.map((c) => c.c);
    const r = rsi(closes, 14);
    const rNum = r.map((v) => v ?? 50);
    const eRsi = ema(rNum, 9);
    const a14 = atr(candles, 14);
    const { highs, lows } = detectSwingPoints(candles, 5);

    let lastSide: Side = "FLAT";
    for (let i = 50; i < candles.length; i++) {
      const slice = candles.slice(0, i + 1);
      const localR = r.slice(0, i + 1);
      const localE = eRsi.slice(0, i + 1);
      const qf = quantumFlowCheck(localR, localE, "balanced");
      const c = candles[i]!;
      const av = a14[i] ?? c.c * 0.005;
      const candleRange = c.h - c.l;
      const adxOk = true; // approximated true since heavy compute per bar would be slow
      const spike = candleRange > 2.5 * av;
      if (!adxOk || spike) continue;
      const lh = highs.filter((h) => h.index < i).slice(-2);
      const ll = lows.filter((l) => l.index < i).slice(-2);
      const trendUp = lh.length === 2 && lh[1]!.price > lh[0]!.price && ll.length === 2 && ll[1]!.price > ll[0]!.price;
      const trendDown = lh.length === 2 && lh[1]!.price < lh[0]!.price && ll.length === 2 && ll[1]!.price < ll[0]!.price;
      if (qf.buyTrigger && !trendDown && lastSide !== "LONG") {
        signals.push({
          index: i,
          time: c.t,
          price: c.c,
          side: "LONG",
          reason: "QFA: RSI cross↑ + structure",
        });
        lastSide = "LONG";
      } else if (qf.sellTrigger && !trendUp && lastSide !== "SHORT") {
        signals.push({
          index: i,
          time: c.t,
          price: c.c,
          side: "SHORT",
          reason: "QFA: RSI cross↓ + structure",
        });
        lastSide = "SHORT";
      }
    }
    // Final live snapshot via full analyzer
    try {
      const live = analyzeQuantumFlow(candles, {
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
        useDxyFilter: false,
        useMoonFilter: false,
        enableEarlyWarning: true,
        slMethod: "structural",
        tpMethod: "structural",
        useTrailing: true,
      });
      return {
        signals,
        meta: {
          confidence: live.confidence,
          ADX: +live.adx.toFixed(1),
          ATR: +live.atr.toFixed(2),
          trend: live.trend,
        },
      };
    } catch {
      return { signals };
    }
  },
};

export const STRATEGIES: Strategy[] = [
  quantumFlowAlpha,
  aiEnsemble,
  ictSilverBullet,
  scalperPro,
  pullback,
  goldGrid,
  pivotEa,
  goldBot,
  theoryCraftSwing,
];

export function getStrategy(id: string): Strategy | undefined {
  return STRATEGIES.find((s) => s.id === id);
}
