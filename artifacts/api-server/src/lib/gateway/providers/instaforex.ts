/**
 * InstaForex Data Provider — PRIMARY SOURCE
 *
 * Endpoints:
 *   Tick data:  https://quotes.instaforex.com/api/quotesTick
 *   Quote list: https://quotes.instaforex.com/api/quotesList
 *
 * NOTE: The InstaForex partner quotesTick API requires valid partner
 * account authentication for full price data. When the API returns
 * an empty data set (only symbol field, no bid/ask/price), this
 * provider returns null so the gateway can try the next provider.
 * This is logged explicitly — there is NO silent fallback.
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

/**
 * InstaForex native symbol mapping.
 * Platform symbol → InstaForex symbol
 * Any symbol not in this map is attempted as-is.
 * Unknown/unmapped symbols are logged explicitly.
 */
const IFX_SYMBOL_MAP: Record<string, string> = {
  // Metals
  XAUUSD: "XAUUSD",
  GOLD: "XAUUSD",
  XAGUSD: "XAGUSD",
  SILVER: "XAGUSD",
  XPTUSD: "XPTUSD",
  XPDUSD: "XPDUSD",

  // Major FX
  EURUSD: "EURUSD",
  GBPUSD: "GBPUSD",
  USDJPY: "USDJPY",
  AUDUSD: "AUDUSD",
  USDCAD: "USDCAD",
  USDCHF: "USDCHF",
  NZDUSD: "NZDUSD",

  // Cross pairs
  GBPJPY: "GBPJPY",
  EURJPY: "EURJPY",
  EURGBP: "EURGBP",
  AUDJPY: "AUDJPY",
  CADJPY: "CADJPY",
  CHFJPY: "CHFJPY",

  // Commodities
  WTI: "USOIL",
  BRENT: "UKOIL",
  USOIL: "USOIL",
  UKOIL: "UKOIL",

  // Crypto (InstaForex style)
  BTC: "BTCUSD",
  BTCUSD: "BTCUSD",
  ETH: "ETHUSD",
  ETHUSD: "ETHUSD",

  // Indices (InstaForex naming)
  SPX: "SP500",
  SP500: "SP500",
  DJI: "DJ30",
  NASDAQ: "NASDAQ",
  DXY: "USDX",
  USDX: "USDX",
  DAX: "DAX30",
  FTSE: "FTSE100",
  NIKKEI: "NI225",
};

// Known unmapped symbols — log once, don't retry repeatedly
const UNMAPPED_WARNED = new Set<string>();

function resolveSymbol(s: string): { ifxSym: string; mapped: boolean } {
  const upper = s.toUpperCase();
  const mapped = IFX_SYMBOL_MAP[upper];
  if (mapped) return { ifxSym: mapped, mapped: true };
  // Try as-is
  if (!UNMAPPED_WARNED.has(upper)) {
    UNMAPPED_WARNED.add(upper);
    logger.warn(
      { symbol: upper, provider: "instaforex" },
      "instaforex: no explicit symbol mapping — trying as-is",
    );
  }
  return { ifxSym: upper, mapped: false };
}

// In-memory cache
const quoteCache = new Map<string, { ts: number; data: Quote }>();
const QUOTE_TTL = 8_000; // 8s — aggressive for real-time

const status: ProviderStatus = {
  name: "instaforex",
  healthy: false, // starts false; becomes true on first success
  lastSuccess: 0,
  lastError: 0,
  errorCount: 0,
  latencyMs: 0,
};

/**
 * Fetch a single tick quote from InstaForex quotesTick API.
 * Returns null if:
 *   - HTTP error
 *   - Response contains only {symbol} with no price fields
 *   - Network timeout
 */
async function fetchInstaForexTick(
  symbol: string,
): Promise<Partial<Quote> | null> {
  const t0 = Date.now();
  const { ifxSym } = resolveSymbol(symbol);

  const url =
    `https://quotes.instaforex.com/api/quotesTick` +
    `?f=JSON&q=${encodeURIComponent(ifxSym)}&n=1&key=${encodeURIComponent(API_KEY)}`;

  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GoldTraderPro/2.0)",
        Accept: "application/json",
        Referer: "https://www.instaforex.com/",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!r.ok) {
      status.errorCount++;
      status.lastError = Date.now();
      logger.warn(
        { symbol, ifxSym, httpStatus: r.status, provider: "instaforex" },
        "instaforex quotesTick HTTP error",
      );
      return null;
    }

    const data = (await r.json()) as Array<Record<string, unknown>>;

    if (!Array.isArray(data) || data.length === 0) {
      status.errorCount++;
      status.lastError = Date.now();
      logger.warn(
        { symbol, ifxSym, provider: "instaforex" },
        "instaforex quotesTick: empty array response",
      );
      return null;
    }

    const tick = data[0] as Record<string, unknown>;

    // Detect "symbol-only" response — API accessible but no data access
    const hasPrice =
      tick["bid"] != null ||
      tick["ask"] != null ||
      tick["last"] != null ||
      tick["price"] != null ||
      tick["close"] != null;

    if (!hasPrice) {
      status.lastError = Date.now();
      logger.warn(
        {
          symbol,
          ifxSym,
          provider: "instaforex",
          tick,
          reason:
            "API accessible but returned no price fields — partner data access may require additional authentication",
        },
        "instaforex quotesTick: no price data in response",
      );
      return null;
    }

    const price = Number(
      tick["ask"] ?? tick["last"] ?? tick["price"] ?? tick["close"] ?? 0,
    );
    if (!price || price <= 0) {
      status.errorCount++;
      status.lastError = Date.now();
      return null;
    }

    status.lastSuccess = Date.now();
    status.latencyMs = Date.now() - t0;
    status.errorCount = Math.max(0, status.errorCount - 1);

    logger.info(
      {
        provider: "instaforex",
        symbol,
        ifxSym,
        price,
        latencyMs: status.latencyMs,
      },
      "instaforex quotesTick: data received",
    );

    return {
      price,
      bid: Number(tick["bid"] ?? price),
      ask: Number(tick["ask"] ?? price),
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
    logger.warn(
      { err, symbol, ifxSym, provider: "instaforex" },
      "instaforex quotesTick: network/timeout error",
    );
    return null;
  }
}

export const instaForexProvider: DataProvider = {
  name: "instaforex",

  async getQuote(symbol): Promise<QuoteResponse | null> {
    const now = Date.now();
    const cached = quoteCache.get(symbol);
    if (cached && now - cached.ts < QUOTE_TTL) {
      return { quote: cached.data, source: "instaforex" };
    }

    const tick = await fetchInstaForexTick(symbol);
    if (!tick || !tick.price) return null;

    const { ifxSym } = resolveSymbol(symbol);
    const price = tick.price;
    const open = tick.open ?? price;
    const quote: Quote = {
      symbol: symbol.toUpperCase(),
      display: ifxSym,
      price,
      prevClose: open,
      change: price - open,
      changePct: open ? ((price - open) / open) * 100 : 0,
      high: tick.high && tick.high > 0 ? tick.high : price,
      low: tick.low && tick.low > 0 ? tick.low : price,
      open,
      ts: tick.ts ?? Date.now(),
      currency: tick.currency ?? "USD",
      marketState: tick.marketState ?? "OPEN",
      spread: tick.spread,
      bid: tick.bid,
      ask: tick.ask,
      pip: price > 100 ? 0.01 : 0.0001,
    };

    quoteCache.set(symbol, { ts: now, data: quote });
    return { quote, source: "instaforex" };
  },

  async getCandles(
    symbol: string,
    _interval: Interval,
    _range: Range,
  ): Promise<ChartResponse | null> {
    // InstaForex chart API endpoint returned 404 in testing.
    // Return null so gateway falls through to Stooq for OHLC data.
    logger.debug(
      { symbol, provider: "instaforex" },
      "instaforex: chart API unavailable — gateway will use secondary provider",
    );
    return null;
  },

  async getMultiQuote(symbols: string[]): Promise<MultiQuoteResponse | null> {
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

  getStatus(): ProviderStatus {
    const healthy =
      status.lastSuccess > 0 &&
      status.errorCount < 10 &&
      Date.now() - status.lastSuccess < 60_000;
    return { ...status, healthy };
  },
};
