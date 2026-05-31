/**
 * Data Gateway Layer — Common Types
 * All data providers normalize to these interfaces.
 */

export interface Candle {
  t: number; // timestamp (ms)
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
}

export interface Quote {
  symbol: string;
  display: string;
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  open: number;
  ts: number; // ms
  currency: string;
  marketState: string;
  spread?: number; // bid-ask spread (from InstaForex)
  bid?: number;
  ask?: number;
  pip?: number;
}

export interface MultiQuote {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  sparkline: number[];
  spread?: number;
}

export type Interval =
  | "1m"
  | "2m"
  | "5m"
  | "15m"
  | "30m"
  | "60m"
  | "90m"
  | "1d"
  | "1wk"
  | "1mo";

export type Range =
  | "1d"
  | "5d"
  | "1mo"
  | "3mo"
  | "6mo"
  | "1y"
  | "2y"
  | "5y"
  | "max";

export interface ChartResponse {
  symbol: string;
  interval: Interval;
  range: Range;
  candles: Candle[];
  meta?: Record<string, unknown>;
  source: string;
}

export interface QuoteResponse {
  quote: Quote;
  source: string;
}

export interface MultiQuoteResponse {
  items: MultiQuote[];
  source: string;
}

export interface ProviderStatus {
  name: string;
  healthy: boolean;
  lastSuccess: number;
  lastError: number;
  errorCount: number;
  latencyMs: number;
}

export interface DataProvider {
  name: string;
  getCandles(
    symbol: string,
    interval: Interval,
    range: Range,
  ): Promise<ChartResponse | null>;
  getQuote(symbol: string): Promise<QuoteResponse | null>;
  getMultiQuote(symbols: string[]): Promise<MultiQuoteResponse | null>;
  getStatus(): ProviderStatus;
}
