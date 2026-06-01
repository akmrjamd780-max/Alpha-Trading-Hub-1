/**
 * Data Gateway — InstaForex Primary + Stooq Secondary
 *
 * PRIMARY:   InstaForex (quotes.instaforex.com)
 * SECONDARY: Stooq (stooq.com) — labeled explicitly in all responses
 *
 * Yahoo Finance has been completely removed from the execution path.
 * There is NO silent fallback. Every response includes a `source` field
 * identifying which provider actually served the data.
 *
 * If InstaForex returns no data AND Stooq fails, the gateway returns null
 * and the route layer returns a 502 with a clear error message.
 */

import { logger } from "../logger";
import { instaForexProvider } from "./providers/instaforex";
import { stooqProvider } from "./providers/stooq";
import type {
  DataProvider,
  ChartResponse,
  QuoteResponse,
  MultiQuoteResponse,
  ProviderStatus,
  Interval,
  Range,
} from "./types";

// Ordered list: InstaForex first, Stooq second. Yahoo Finance is NOT here.
const PROVIDERS: DataProvider[] = [instaForexProvider, stooqProvider];

export function getProviderStatuses(): ProviderStatus[] {
  return PROVIDERS.map((p) => p.getStatus());
}

async function withProviderFallback<T>(
  fn: (p: DataProvider) => Promise<T | null>,
  label: string,
  symbol?: string,
): Promise<T | null> {
  for (const p of PROVIDERS) {
    const t0 = Date.now();
    try {
      const result = await fn(p);
      if (result !== null && result !== undefined) {
        logger.info(
          {
            provider: p.name,
            label,
            symbol,
            latencyMs: Date.now() - t0,
            success: true,
          },
          `gateway[${p.name}] served ${label}`,
        );
        return result;
      }
      logger.warn(
        { provider: p.name, label, symbol },
        `gateway[${p.name}] returned no data for ${label} — trying next provider`,
      );
    } catch (err) {
      logger.warn(
        { err, provider: p.name, label, symbol },
        `gateway[${p.name}] threw error for ${label} — trying next provider`,
      );
    }
  }
  logger.error(
    { label, symbol, providers: PROVIDERS.map((p) => p.name) },
    "gateway: ALL providers failed — returning null",
  );
  return null;
}

export const gateway = {
  getCandles(
    symbol: string,
    interval: Interval,
    range: Range,
  ): Promise<ChartResponse | null> {
    return withProviderFallback(
      (p) => p.getCandles(symbol, interval, range),
      "candles",
      symbol,
    );
  },

  getQuote(symbol: string): Promise<QuoteResponse | null> {
    return withProviderFallback(
      (p) => p.getQuote(symbol),
      "quote",
      symbol,
    );
  },

  getMultiQuote(symbols: string[]): Promise<MultiQuoteResponse | null> {
    return withProviderFallback(
      (p) => p.getMultiQuote(symbols),
      "multi-quote",
    );
  },

  getStatus(): ProviderStatus[] {
    return getProviderStatuses();
  },

  /**
   * Returns the name of the provider that is currently healthy and primary.
   * Used by the health endpoint.
   */
  getPrimaryProvider(): string {
    for (const p of PROVIDERS) {
      if (p.getStatus().healthy) return p.name;
    }
    return "none";
  },
};

export { instaForexProvider, stooqProvider };
