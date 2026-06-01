/**
 * Yahoo Finance Data Provider
 * Fallback provider using Yahoo Finance v8 chart API.
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

const YF_HOSTS = [
  "https://query2.finance.yahoo.com/v8/finance/chart",
  "https://query1.finance.yahoo.com/v8/finance/chart",
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

const SYMBOL_ALIASES: Record<string, string> = {
  XAUUSD: "GC=F",
  XAGUSD: "SI=F",
  GOLD: "GC=F",
  SILVER: "SI=F",
  WTI: "CL=F",
  BTC: "BTC-USD",
  ETH: "ETH-USD",
  SPX: "^GSPC",
  DXY: "DX-Y.NYB",
  EURUSD: "EURUSD=X",
  GBPUSD: "GBPUSD=X",
  USDJPY: "JPY=X",
  AUDUSD: "AUDUSD=X",
  USDCAD: "CAD=X",
  USDCHF: "CHF=X",
  NZDUSD: "NZDUSD=X",
};

function resolveSymbol(s: string): string {
  const upper = s.toUpperCase();
  return SYMBOL_ALIASES[upper] ?? upper;
}

// Cookie jar
let cookieJar = "";
let cookieFetchedAt = 0;

async function ensureCookies(): Promise<void> {
  const now = Date.now();
  if (cookieJar && now - cookieFetchedAt < 30 * 60 * 1000) return;
  try {
    const r = await fetch("https://fc.yahoo.com/", {
      headers: { "User-Agent": UA, Accept: "*/*" },
      redirect: "manual",
    });
    const setCookie =
      (r.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ??
      r.headers.get("set-cookie")?.split(/, (?=[A-Za-z])/) ??
      [];
    const parts = setCookie
      .map((c) => c.split(";")[0])
      .filter(Boolean) as string[];
    if (parts.length) {
      cookieJar = parts.join("; ");
      cookieFetchedAt = now;
    }
  } catch {
    // ignore
  }
}

// Cache
const cache = new Map<string, { ts: number; data: { candles: Candle[]; meta: Record<string, unknown> } }>();
const CACHE_TTL = 25_000;

const status: ProviderStatus = {
  name: "yahoo",
  healthy: true,
  lastSuccess: 0,
  lastError: 0,
  errorCount: 0,
  latencyMs: 0,
};

async function fetchYahooChart(
  symbol: string,
  interval: string,
  range: string,
): Promise<{ candles: Candle[]; meta: Record<string, unknown> } | null> {
  const start = Date.now();
  const key = `${symbol}|${interval}|${range}`;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && now - cached.ts < CACHE_TTL) return cached.data;

  await ensureCookies();
  const path = `/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=true`;
  for (const host of YF_HOSTS) {
    try {
      const r = await fetch(`${host}${path}`, {
        headers: {
          "User-Agent": UA,
          Accept: "application/json,text/plain,*/*",
          "Accept-Language": "en-US,en;q=0.9",
          ...(cookieJar ? { Cookie: cookieJar } : {}),
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) continue;
      const data = (await r.json()) as {
        chart?: {
          result?: Array<{
            meta: Record<string, unknown>;
            timestamp?: number[];
            indicators?: {
              quote?: Array<{
                open?: (number | null)[];
                high?: (number | null)[];
                low?: (number | null)[];
                close?: (number | null)[];
                volume?: (number | null)[];
              }>;
            };
          }>;
        };
      };
      const result = data.chart?.result?.[0];
      if (!result) continue;
      const ts = result.timestamp ?? [];
      const q = result.indicators?.quote?.[0];
      const candles: Candle[] = [];
      if (q) {
        for (let i = 0; i < ts.length; i++) {
          const o = q.open?.[i];
          const h = q.high?.[i];
          const l = q.low?.[i];
          const c = q.close?.[i];
          const v = q.volume?.[i];
          if (o == null || h == null || l == null || c == null) continue;
          candles.push({
            t: (ts[i] ?? 0) * 1000,
            o,
            h,
            l,
            c,
            v: v ?? 0,
          });
        }
      }
      const out = { candles, meta: result.meta };
      cache.set(key, { ts: now, data: out });
      status.lastSuccess = Date.now();
      status.latencyMs = Date.now() - start;
      return out;
    } catch (err) {
      logger.debug({ err, host, symbol, provider: "yahoo" }, "yahoo fetch error");
      continue;
    }
  }
  status.errorCount++;
  status.lastError = Date.now();
  return null;
}

export const yahooProvider: DataProvider = {
  name: "yahoo",

  async getCandles(symbol, interval, range) {
    const sym = resolveSymbol(symbol);
    const data = await fetchYahooChart(sym, interval, range);
    if (!data) return null;
    return {
      symbol,
      interval,
      range,
      candles: data.candles,
      meta: data.meta,
      source: "yahoo",
    };
  },

  async getQuote(symbol) {
    const sym = resolveSymbol(symbol);
    const data = await fetchYahooChart(sym, "5m", "1d");
    if (!data) return null;
    const meta = data.meta;
    const lastCandle = data.candles[data.candles.length - 1];
    const price =
      (meta["regularMarketPrice"] as number | undefined) ?? lastCandle?.c ?? 0;
    const prevClose =
      (meta["chartPreviousClose"] as number | undefined) ??
      (meta["previousClose"] as number | undefined) ??
      price;
    const quote: Quote = {
      symbol: symbol.toUpperCase(),
      display: (meta["symbol"] as string | undefined) ?? sym,
      price,
      prevClose,
      change: price - prevClose,
      changePct: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
      high:
        (meta["regularMarketDayHigh"] as number | undefined) ??
        lastCandle?.h ??
        price,
      low:
        (meta["regularMarketDayLow"] as number | undefined) ??
        lastCandle?.l ??
        price,
      open:
        (meta["regularMarketOpen"] as number | undefined) ??
        data.candles[0]?.o ??
        price,
      ts:
        ((meta["regularMarketTime"] as number | undefined) ??
          Date.now() / 1000) * 1000,
      currency: (meta["currency"] as string | undefined) ?? "USD",
      marketState: (meta["marketState"] as string | undefined) ?? "REGULAR",
    };
    return { quote, source: "yahoo" };
  },

  async getMultiQuote(symbols) {
    const items: MultiQuote[] = [];
    await Promise.all(
      symbols.map(async (sym) => {
        try {
          const s = resolveSymbol(sym);
          const data = await fetchYahooChart(s, "15m", "5d");
          if (!data) return null;
          const meta = data.meta;
          const last = data.candles[data.candles.length - 1];
          const price =
            (meta["regularMarketPrice"] as number | undefined) ?? last?.c ?? 0;
          const prevClose =
            (meta["chartPreviousClose"] as number | undefined) ??
            (meta["previousClose"] as number | undefined) ??
            price;
          const change = price - prevClose;
          const sparkline = data.candles.slice(-30).map((c) => c.c);
          items.push({
            symbol: sym.toUpperCase(),
            price,
            change,
            changePct: prevClose ? (change / prevClose) * 100 : 0,
            sparkline,
          });
        } catch {
          return null;
        }
      }),
    );
    if (items.length === 0) return null;
    return { items, source: "yahoo" };
  },

  getStatus() {
    const healthy =
      status.lastSuccess > 0 &&
      status.errorCount < 20 &&
      Date.now() - status.lastSuccess < 120_000;
    return { ...status, healthy };
  },
};
