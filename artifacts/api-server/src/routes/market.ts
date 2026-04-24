import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

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
};

function resolveSymbol(s: string): string {
  const upper = s.toUpperCase();
  return SYMBOL_ALIASES[upper] ?? s;
}

interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface QuoteSummary {
  symbol: string;
  display: string;
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  open: number;
  ts: number;
  currency: string;
  marketState: string;
}

// In-memory cookie jar for Yahoo session
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

interface CacheEntry {
  ts: number;
  data: { candles: Candle[]; meta: Record<string, unknown> };
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 25_000;

async function fetchYahoo(
  symbol: string,
  interval: string,
  range: string,
): Promise<{ candles: Candle[]; meta: Record<string, unknown> } | null> {
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
      return out;
    } catch {
      continue;
    }
  }
  return null;
}

router.get("/market/quote", async (req: Request, res: Response) => {
  try {
    const symbolParam = String(req.query["symbol"] ?? "XAUUSD");
    const symbol = resolveSymbol(symbolParam);
    const data = await fetchYahoo(symbol, "5m", "1d");
    if (!data) {
      res.status(502).json({ error: "Upstream fetch failed" });
      return;
    }
    const meta = data.meta as Record<string, unknown>;
    const lastCandle = data.candles[data.candles.length - 1];
    const price =
      (meta["regularMarketPrice"] as number | undefined) ?? lastCandle?.c ?? 0;
    const prevClose =
      (meta["chartPreviousClose"] as number | undefined) ??
      (meta["previousClose"] as number | undefined) ??
      price;
    const high =
      (meta["regularMarketDayHigh"] as number | undefined) ??
      lastCandle?.h ??
      price;
    const low =
      (meta["regularMarketDayLow"] as number | undefined) ??
      lastCandle?.l ??
      price;
    const open =
      (meta["regularMarketOpen"] as number | undefined) ??
      data.candles[0]?.o ??
      price;
    const change = price - prevClose;
    const summary: QuoteSummary = {
      symbol: symbolParam.toUpperCase(),
      display: (meta["symbol"] as string | undefined) ?? symbol,
      price,
      prevClose,
      change,
      changePct: prevClose ? (change / prevClose) * 100 : 0,
      high,
      low,
      open,
      ts:
        ((meta["regularMarketTime"] as number | undefined) ??
          Date.now() / 1000) * 1000,
      currency: (meta["currency"] as string | undefined) ?? "USD",
      marketState: (meta["marketState"] as string | undefined) ?? "REGULAR",
    };
    res.json(summary);
  } catch (err) {
    req.log.error({ err }, "quote failed");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/market/candles", async (req: Request, res: Response) => {
  try {
    const symbolParam = String(req.query["symbol"] ?? "XAUUSD");
    const interval = String(req.query["interval"] ?? "5m");
    const range = String(req.query["range"] ?? "5d");
    const symbol = resolveSymbol(symbolParam);
    const data = await fetchYahoo(symbol, interval, range);
    if (!data) {
      res.status(502).json({ error: "Upstream fetch failed" });
      return;
    }
    res.json({
      symbol: symbolParam.toUpperCase(),
      interval,
      range,
      candles: data.candles,
    });
  } catch (err) {
    req.log.error({ err }, "candles failed");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/market/multi", async (req: Request, res: Response) => {
  try {
    const symbolsParam = String(
      req.query["symbols"] ?? "XAUUSD,XAGUSD,DXY,BTC,SPX,EURUSD",
    );
    const list = symbolsParam.split(",").map((s) => s.trim()).filter(Boolean);
    const results = await Promise.all(
      list.map(async (s) => {
        try {
          const sym = resolveSymbol(s);
          const data = await fetchYahoo(sym, "15m", "5d");
          if (!data) return null;
          const meta = data.meta as Record<string, unknown>;
          const last = data.candles[data.candles.length - 1];
          const price =
            (meta["regularMarketPrice"] as number | undefined) ?? last?.c ?? 0;
          const prevClose =
            (meta["chartPreviousClose"] as number | undefined) ??
            (meta["previousClose"] as number | undefined) ??
            price;
          const change = price - prevClose;
          const sparkline = data.candles.slice(-30).map((c) => c.c);
          return {
            symbol: s.toUpperCase(),
            price,
            change,
            changePct: prevClose ? (change / prevClose) * 100 : 0,
            sparkline,
          };
        } catch {
          return null;
        }
      }),
    );
    res.json({ items: results.filter(Boolean) });
  } catch (err) {
    req.log.error({ err }, "multi failed");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
