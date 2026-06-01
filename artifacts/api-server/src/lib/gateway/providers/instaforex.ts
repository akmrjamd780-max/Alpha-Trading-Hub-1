/**
 * InstaForex Data Provider
 * Real-time forex quotes and chart data.
 * Primary: quotes.instaforex.com REST endpoints
 * API key: supports both ?key= and ?api_key= params
 */

import { logger } from "../../logger";
import type {
  DataProvider,
  Candle,
  ChartResponse,
  Quote,
  QuoteResponse,
  MultiQuote,
  MultiQuoteResponse,
  ProviderStatus,
  Interval,
  Range,
} from "../types";

const API_KEY = process.env["INSTAFOREX_API_KEY"] ?? "5Gl2M6#E";

// InstaForex symbol mapping (they use XAUUSD, EURUSD natively)
const IFX_SYMBOLS: Record<string, string> = {
  XAUUSD: "XAUUSD",
  GOLD: "XAUUSD",
  XAGUSD: "XAGUSD",
  SILVER: "XAGUSD",
  EURUSD: "EURUSD",
  GBPUSD: "GBPUSD",
  USDJPY: "USDJPY",
  AUDUSD: "AUDUSD",
  USDCAD: "USDCAD",
  USDCHF: "USDCHF",
  NZDUSD: "NZDUSD",
  GBPJPY: "GBPJPY",
  EURJPY: "EURJPY",
  WTI: "CL",
  BTC: "BTCUSD",
  ETH: "ETHUSD",
  DXY: "DXY",
};

function resolveSymbol(s: string): string {
  const upper = s.toUpperCase();
  return IFX_SYMBOLS[upper] ?? upper;
}

// Cache
const quoteCache = new Map<string, { ts: number; data: Quote }>();
const chartCache = new Map<string, { ts: number; data: ChartResponse }>();
const QUOTE_TTL = 15_000; // 15s
const CHART_TTL = 30_000; // 30s

// Status
const status: ProviderStatus = {
  name: "instaforex",
  healthy: true,
  lastSuccess: 0,
  lastError: 0,
  errorCount: 0,
  latencyMs: 0,
};

async function fetchQuoteTick(symbol: string): Promise<Partial<Quote> | null> {
  const start = Date.now();
  const ifxSym = resolveSymbol(symbol);
  const url = `https://quotes.instaforex.com/api/quotesTick?f=JSON&q=${encodeURIComponent(ifxSym)}&n=1&key=${encodeURIComponent(API_KEY)}`;
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GoldTrader/1.0)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      status.errorCount++;
      status.lastError = Date.now();
      return null;
    }
    const data = (await r.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(data) || data.length === 0) return null;
    const tick = data[0] as Record<string, unknown>;
    status.lastSuccess = Date.now();
    status.latencyMs = Date.now() - start;
    return {
      price: Number(tick["ask"] ?? tick["last"] ?? tick["price"] ?? 0),
      bid: Number(tick["bid"] ?? tick["last"] ?? 0),
      ask: Number(tick["ask"] ?? tick["last"] ?? tick["price"] ?? 0),
      spread: Number(tick["spread"] ?? 0),
      high: Number(tick["high"] ?? 0),
      low: Number(tick["low"] ?? 0),
      open: Number(tick["open"] ?? 0),
      ts: Date.now(),
      currency: "USD",
      marketState: "OPEN",
    };
  } catch (err) {
    status.errorCount++;
    status.lastError = Date.now();
    logger.warn({ err, symbol, provider: "instaforex" }, "quote tick failed");
    return null;
  }
}

async function fetchChart(
  symbol: string,
  interval: Interval,
  range: Range,
): Promise<{ candles: Candle[]; meta: Record<string, unknown> } | null> {
  const start = Date.now();
  const ifxSym = resolveSymbol(symbol);
  // InstaForex chart interval mapping (seconds)
  const intervalMap: Record<string, number> = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "30m": 1800,
    "60m": 3600,
    "1d": 86400,
    "1wk": 604800,
    "1mo": 2592000,
  };
  const period = intervalMap[interval] ?? 300;
  // Determine bar count from range
  const rangeBars: Record<string, number> = {
    "1d": 48,
    "5d": 120,
    "1mo": 180,
    "3mo": 360,
    "6mo": 720,
    "1y": 1440,
    "2y": 2880,
    "5y": 7200,
    max: 7200,
  };
  const bars = rangeBars[range] ?? 120;
  const url = `https://quotes.instaforex.com/api/chart?f=JSON&q=${encodeURIComponent(ifxSym)}&n=${bars}&i=${period}&key=${encodeURIComponent(API_KEY)}`;
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GoldTrader/1.0)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) {
      status.errorCount++;
      status.lastError = Date.now();
      return null;
    }
    const data = (await r.json()) as {
      bars?: Array<{
        time?: number;
        open?: number;
        high?: number;
        low?: number;
        close?: number;
        volume?: number;
      }>;
    };
    if (!data.bars || data.bars.length === 0) return null;
    const candles: Candle[] = data.bars.map((b) => ({
      t: (b.time ?? 0) * 1000,
      o: b.open ?? 0,
      h: b.high ?? 0,
      l: b.low ?? 0,
      c: b.close ?? 0,
      v: b.volume ?? 0,
    }));
    status.lastSuccess = Date.now();
    status.latencyMs = Date.now() - start;
    return {
      candles,
      meta: { symbol: ifxSym, period, bars, provider: "instaforex" },
    };
  } catch (err) {
    status.errorCount++;
    status.lastError = Date.now();
    logger.warn({ err, symbol, provider: "instaforex" }, "chart fetch failed");
    return null;
  }
}

export const instaForexProvider: DataProvider = {
  name: "instaforex",

  async getCandles(symbol, interval, range) {
    const key = `${symbol}|${interval}|${range}`;
    const now = Date.now();
    const cached = chartCache.get(key);
    if (cached && now - cached.ts < CHART_TTL) {
      return cached.data;
    }
    const data = await fetchChart(symbol, interval, range);
    if (!data) return null;
    const out: ChartResponse = {
      symbol,
      interval,
      range,
      candles: data.candles,
      meta: data.meta,
      source: "instaforex",
    };
    chartCache.set(key, { ts: now, data: out });
    return out;
  },

  async getQuote(symbol) {
    const now = Date.now();
    const cached = quoteCache.get(symbol);
    if (cached && now - cached.ts < QUOTE_TTL) {
      return { quote: cached.data, source: "instaforex" };
    }
    const tick = await fetchQuoteTick(symbol);
    if (!tick || !tick.price) return null;
    const quote: Quote = {
      symbol: symbol.toUpperCase(),
      display: resolveSymbol(symbol),
      price: tick.price,
      prevClose: tick.open ?? tick.price,
      change: tick.price - (tick.open ?? tick.price),
      changePct: tick.open
        ? ((tick.price - tick.open) / tick.open) * 100
        : 0,
      high: tick.high ?? tick.price,
      low: tick.low ?? tick.price,
      open: tick.open ?? tick.price,
      ts: tick.ts,
      currency: tick.currency ?? "USD",
      marketState: tick.marketState ?? "OPEN",
      spread: tick.spread,
      bid: tick.bid,
      ask: tick.ask,
      pip: tick.price > 100 ? 0.01 : 0.0001,
    };
    quoteCache.set(symbol, { ts: now, data: quote });
    return { quote, source: "instaforex" };
  },

  async getMultiQuote(symbols) {
    const items: MultiQuote[] = [];
    await Promise.all(
      symbols.map(async (sym) => {
        const res = await this.getQuote(sym);
        if (res) {
          items.push({
            symbol: res.quote.symbol,
            price: res.quote.price,
            change: res.quote.change,
            changePct: res.quote.changePct,
            sparkline: [],
            spread: res.quote.spread,
          });
        }
      }),
    );
    if (items.length === 0) return null;
    return { items, source: "instaforex" };
  },

  getStatus() {
    const healthy =
      status.lastSuccess > 0 &&
      status.errorCount < 10 &&
      Date.now() - status.lastSuccess < 60_000;
    return { ...status, healthy };
  },
};
