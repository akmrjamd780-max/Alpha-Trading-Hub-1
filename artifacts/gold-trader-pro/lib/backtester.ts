import type { Candle } from "./marketData";
import type { Signal, Strategy } from "./strategies";
import { atr } from "./indicators";

export interface Trade {
  entryIdx: number;
  exitIdx: number;
  entryTime: number;
  exitTime: number;
  side: "LONG" | "SHORT";
  entry: number;
  exit: number;
  pnl: number;
  pnlPct: number;
  reason: string;
  outcome: "WIN" | "LOSS" | "FLAT";
}

export interface BacktestResult {
  trades: Trade[];
  totalReturnPct: number;
  winRate: number;
  avgWinPct: number;
  avgLossPct: number;
  profitFactor: number;
  maxDrawdownPct: number;
  expectancyPct: number;
  equityCurve: { t: number; equity: number }[];
  totalSignals: number;
}

export interface BacktestOpts {
  rrRatio?: number; // risk:reward
  atrSlMult?: number;
  initialEquity?: number;
}

export function backtest(
  strategy: Strategy,
  candles: Candle[],
  opts: BacktestOpts = {},
): BacktestResult {
  const rr = opts.rrRatio ?? 2;
  const slMult = opts.atrSlMult ?? 1.5;
  const initial = opts.initialEquity ?? 10000;
  const { signals } = strategy.run(candles);
  const a = atr(candles, 14);
  const trades: Trade[] = [];
  let openSignal: Signal | null = null;
  let openSL = 0;
  let openTP = 0;

  function closeAt(i: number, price: number) {
    if (!openSignal) return;
    const dir = openSignal.side === "LONG" ? 1 : -1;
    const pnl = (price - openSignal.price) * dir;
    const pnlPct = (pnl / openSignal.price) * 100;
    trades.push({
      entryIdx: openSignal.index,
      exitIdx: i,
      entryTime: openSignal.time,
      exitTime: candles[i]!.t,
      side: openSignal.side as "LONG" | "SHORT",
      entry: openSignal.price,
      exit: price,
      pnl,
      pnlPct,
      reason: openSignal.reason,
      outcome: pnl > 0 ? "WIN" : pnl < 0 ? "LOSS" : "FLAT",
    });
    openSignal = null;
  }

  let sigPtr = 0;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]!;
    if (openSignal) {
      if (openSignal.side === "LONG") {
        if (c.l <= openSL) {
          closeAt(i, openSL);
        } else if (c.h >= openTP) {
          closeAt(i, openTP);
        }
      } else {
        if (c.h >= openSL) {
          closeAt(i, openSL);
        } else if (c.l <= openTP) {
          closeAt(i, openTP);
        }
      }
    }
    while (sigPtr < signals.length && signals[sigPtr]!.index <= i) {
      const s = signals[sigPtr]!;
      sigPtr++;
      if (openSignal) continue;
      const av = a[s.index] ?? c.c * 0.005;
      const slDist = av * slMult;
      openSignal = s;
      if (s.side === "LONG") {
        openSL = s.price - slDist;
        openTP = s.price + slDist * rr;
      } else {
        openSL = s.price + slDist;
        openTP = s.price - slDist * rr;
      }
    }
  }
  if (openSignal && candles.length > 0) {
    closeAt(candles.length - 1, candles[candles.length - 1]!.c);
  }

  let equity = initial;
  const equityCurve: { t: number; equity: number }[] = [];
  let peak = initial;
  let maxDd = 0;
  let wins = 0;
  let losses = 0;
  let sumWin = 0;
  let sumLoss = 0;
  for (const t of trades) {
    equity *= 1 + t.pnlPct / 100;
    equityCurve.push({ t: t.exitTime, equity });
    if (equity > peak) peak = equity;
    const dd = ((peak - equity) / peak) * 100;
    if (dd > maxDd) maxDd = dd;
    if (t.pnlPct > 0) {
      wins++;
      sumWin += t.pnlPct;
    } else if (t.pnlPct < 0) {
      losses++;
      sumLoss += Math.abs(t.pnlPct);
    }
  }
  const total = trades.length;
  const winRate = total > 0 ? (wins / total) * 100 : 0;
  const avgWin = wins > 0 ? sumWin / wins : 0;
  const avgLoss = losses > 0 ? sumLoss / losses : 0;
  const profitFactor = sumLoss > 0 ? sumWin / sumLoss : sumWin > 0 ? Infinity : 0;
  const totalReturnPct = ((equity - initial) / initial) * 100;
  const expectancy = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;

  return {
    trades,
    totalReturnPct,
    winRate,
    avgWinPct: avgWin,
    avgLossPct: avgLoss,
    profitFactor,
    maxDrawdownPct: maxDd,
    expectancyPct: expectancy,
    equityCurve,
    totalSignals: signals.length,
  };
}
