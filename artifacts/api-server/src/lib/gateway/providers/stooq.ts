/**
 * Stooq Data Provider
 * Free real-time market data — no API key required.
 * Endpoint: https://stooq.com/q/l/?s={symbol}&f=sd2t2ohlcv&h&e=csv
 *
 * Used as transparent secondary source when InstaForex returns no data.
 * Clearly labeled "stooq" in all API responses.
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

// Stooq symbol mapping
const STOOQ_SYMBOLS: Record<string, string> = {
  XAUUSD: "xauusd",
  GOLD: "xauusd",
  XAGUSD: "xagusd",
  SILVER: "xagusd",
  EURUSD: "eurusd",
  GBPUSD: "gbpusd",
  USDJPY: "usdjpy",
  AUDUSD: "audusd",
  USDCAD: "usdcad",
  USDCHF: "usdchf",
  NZDUSD: "nzdusd",
  GBPJPY: "gbpjpy",
  EURJPY: "eurjpy",
  EURGBP: "eurgbp",
  BTC: "btcusd",
  ETH: "ethusd",
  DXY: "dxy",
  WTI: "cl.f",
  SPX: "^spx",
};

// OHLC interval mapping for stooq historical
const STOOQ_INTERVAL: Record<string, string> = {
  "1d": "d",
  "1wk": "w",
  "1mo": "m",
  "60m": "h",
};

const UNSUPPORTED_SYMBOLS = new Set<string>();

function resolveSymbol(s: string): string | null {
  const upper = s.toUpperCase();
  const mapped = STOOQ_SYMBOLS[upper] ?? upper.toLowerCase();
  return mapped;
}

// In-memory cache
const quoteCache = new Map<string, { ts: number; data: Quote }>();
const chartCache = new Map<string, { ts: number; data: ChartResponse }>();
const QUOTE_TTL = 10_000; // 10s — stooq is near-realtime
const CHART_TTL = 60_000; // 60s for historical

const status: ProviderStatus = {
  name: "stooq",
  healthy: true,
  lastSuccess: 0,
  lastError: 0,
  errorCount: 0,
  latencyMs: 0,
};

function parseStooqCsv(csv: string): {
  symbol: string;
  date: string;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
} | null {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return null;
  const header = lines[0]!.split(",");
  const data = lines[1]!.split(",");
  const idx = (name: string) => header.indexOf(name);
  const n = (i: number) => parseFloat(data[i] ?? "0") || 0;

  const close = n(idx("Close"));
  if (!close || close <= 0) return null;

  return {
    symbol: data[idx("Symbol")] ?? "",
    date: data[idx("Date")] ?? "",
    time: data[idx("Time")] ?? "",
    open: n(idx("Open")),
    high: n(idx("High")),
    low: n(idx("Low")),
    close,
    volume: n(idx("Volume")),
  };
}

async function fetchStooqQuote(symbol: string): Promise<Quote | null> {
  const start = Date.now();
  const stooqSym = resolveSymbol(symbol);
  if (!stooqSym) return null;

  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSym)}&f=sd2t2ohlcv&h&e=csv`;
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GoldTraderPro/2.0)",
        Accept: "text/csv,text/plain,*/*",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) {
      status.errorCount++;
      status.lastError = Date.now();
      logger.warn(
        { symbol, stooqSym, status: r.status, provider: "stooq" },
        "stooq HTTP error",
      );
      return null;
    }
    const csv = await r.text();

    // Stooq returns "Symbol,..." header — if no data, returns "N/D" line
    if (csv.includes("N/D") || !csv.includes(",")) {
      UNSUPPORTED_SYMBOLS.add(symbol.toUpperCase());
      logger.warn(
        { symbol, stooqSym, provider: "stooq" },
        "stooq: symbol not supported or no data",
      );
      return null;
    }

    const parsed = parseStooqCsv(csv);
    if (!parsed) return null;

    const price = parsed.close;
    const open = parsed.open;
    const quote: Quote = {
      symbol: symbol.toUpperCase(),
      display: stooqSym.toUpperCase(),
      price,
      prevClose: open || price,
      change: price - (open || price),
      changePct: open ? ((price - open) / open) * 100 : 0,
      high: parsed.high || price,
      low: parsed.low || price,
      open: parsed.open || price,
      ts: Date.now(),
      currency: "USD",
      marketState: "OPEN",
    };

    status.lastSuccess = Date.now();
    status.latencyMs = Date.now() - start;
    status.errorCount = Math.max(0, status.errorCount - 1);
    logger.info(
      {
        provider: "stooq",
        symbol,
        stooqSym,
        price,
        ts: quote.ts,
        latencyMs: status.latencyMs,
      },
      "stooq quote fetched",
    );
    return quote;
  } catch (err) {
    status.errorCount++;
    status.lastError = Date.now();
    logger.warn({ err, symbol, stooqSym, provider: "stooq" }, "stooq fetch error");
    return null;
  }
}

async function fetchStooqHistorical(
  symbol: string,
  interval: Interval,
  range: Range,
): Promise<Candle[] | null> {
  const start = Date.now();
  const stooqSym = resolveSymbol(symbol);
  if (!stooqSym) return null;

  // Determine stooq interval type
  const stooqInt = STOOQ_INTERVAL[interval] ?? "d";

  // Calculate date range
  const now = new Date();
  const endDate = now.toISOString().split("T")[0]!.replace(/-/g, "");
  const daysMap: Record<string, number> = {
    "1d": 1,
    "5d": 5,
    "1mo": 30,
    "3mo": 90,
    "6mo": 180,
    "1y": 365,
    "2y": 730,
    "5y": 1825,
    max: 3650,
  };
  const days = daysMap[range] ?? 90;
  const startMs = now.getTime() - days * 24 * 60 * 60 * 1000;
  const startDate = new Date(startMs).toISOString().split("T")[0]!.replace(/-/g, "");

  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSym)}&d1=${startDate}&d2=${endDate}&i=${stooqInt}`;

  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GoldTraderPro/2.0)",
        Accept: "text/csv,text/plain,*/*",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) {
      status.errorCount++;
      status.lastError = Date.now();
      return null;
    }
    const csv = await r.text();
    if (csv.includes("N/D") || !csv.includes(",")) return null;

    const lines = csv.trim().split("\n");
    if (lines.length < 2) return null;

    const header = lines[0]!.split(",");
    const dateIdx = header.indexOf("Date");
    const openIdx = header.indexOf("Open");
    const highIdx = header.indexOf("High");
    const lowIdx = header.indexOf("Low");
    const closeIdx = header.indexOf("Close");
    const volIdx = header.indexOf("Volume");

    const candles: Candle[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i]!.split(",");
      const dateStr = cols[dateIdx] ?? "";
      const c = parseFloat(cols[closeIdx] ?? "0");
      if (!dateStr || !c) continue;
      const t = new Date(dateStr).getTime();
      if (isNaN(t)) continue;
      candles.push({
        t,
        o: parseFloat(cols[openIdx] ?? "0") || c,
        h: parseFloat(cols[highIdx] ?? "0") || c,
        l: parseFloat(cols[lowIdx] ?? "0") || c,
        c,
        v: parseFloat(cols[volIdx] ?? "0") || 0,
      });
    }

    status.lastSuccess = Date.now();
    status.latencyMs = Date.now() - start;
    logger.info(
      { provider: "stooq", symbol, stooqSym, bars: candles.length, latencyMs: status.latencyMs },
      "stooq historical fetched",
    );
    return candles;
  } catch (err) {
    status.errorCount++;
    status.lastError = Date.now();
    logger.warn({ err, symbol, provider: "stooq" }, "stooq historical error");
    return null;
  }
}

export const stooqProvider: DataProvider = {
  name: "stooq",

  async getQuote(symbol) {
    const now = Date.now();
    const cached = quoteCache.get(symbol);
    if (cached && now - cached.ts < QUOTE_TTL) {
      logger.debug({ provider: "stooq", symbol }, "stooq quote from cache");
      return { quote: cached.data, source: "stooq" };
    }
    const quote = await fetchStooqQuote(symbol);
    if (!quote) return null;
    quoteCache.set(symbol, { ts: now, data: quote });
    return { quote, source: "stooq" };
  },

  async getCandles(symbol, interval, range) {
    const key = `${symbol}|${interval}|${range}`;
    const now = Date.now();
    const cached = chartCache.get(key);
    if (cached && now - cached.ts < CHART_TTL) {
      return cached.data;
    }
    const candles = await fetchStooqHistorical(symbol, interval, range);
    if (!candles || candles.length === 0) return null;
    const out: ChartResponse = {
      symbol,
      interval,
      range,
      candles,
      meta: { provider: "stooq", symbol: resolveSymbol(symbol) },
      source: "stooq",
    };
    chartCache.set(key, { ts: now, data: out });
    return out;
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
          });
        }
      }),
    );
    if (items.length === 0) return null;
    return { items, source: "stooq" };
  },

  getStatus() {
    const healthy =
      status.lastSuccess > 0 &&
      status.errorCount < 10 &&
      Date.now() - status.lastSuccess < 120_000;
    return { ...status, healthy };
  },
};

export { UNSUPPORTED_SYMBOLS as stooqUnsupportedSymbols };
