/**
 * Data Gateway Orchestrator
 * Routes requests to primary provider (InstaForex) with fallback to Yahoo Finance.
 * Exposes unified API for all data consumers.
 */

import { logger } from "../logger";
import { instaForexProvider } from "./providers/instaforex";
import { yahooProvider } from "./providers/yahoo";
import type {
  DataProvider,
  ChartResponse,
  QuoteResponse,
  MultiQuoteResponse,
  ProviderStatus,
  Interval,
  Range,
} from "./types";

const providers: DataProvider[] = [instaForexProvider, yahooProvider];

function getProviderStatuses(): ProviderStatus[] {
  return providers.map((p) => p.getStatus());
}

function isHealthy(p: DataProvider): boolean {
  return p.getStatus().healthy;
}

async function withFallback<T>(
  fn: (p: DataProvider) => Promise<T | null>,
  label: string,
  symbol?: string,
): Promise<T | null> {
  for (const p of providers) {
    try {
      const result = await fn(p);
      if (result) {
        logger.debug(
          { provider: p.name, label, symbol },
          "gateway provider success",
        );
        return result;
      }
    } catch (err) {
      logger.warn(
        { err, provider: p.name, label, symbol },
        "gateway provider failed",
      );
    }
  }
  logger.error({ label, symbol }, "all gateway providers failed");
  return null;
}

export const gateway = {
  getCandles(
    symbol: string,
    interval: Interval,
    range: Range,
  ): Promise<ChartResponse | null> {
    return withFallback(
      (p) => p.getCandles(symbol, interval, range),
      "candles",
      symbol,
    );
  },

  getQuote(symbol: string): Promise<QuoteResponse | null> {
    return withFallback(
      (p) => p.getQuote(symbol),
      "quote",
      symbol,
    );
  },

  getMultiQuote(symbols: string[]): Promise<MultiQuoteResponse | null> {
    return withFallback(
      (p) => p.getMultiQuote(symbols),
      "multi-quote",
    );
  },

  getStatus(): ProviderStatus[] {
    return getProviderStatuses();
  },
};

export { instaForexProvider, yahooProvider };
