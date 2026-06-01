import { apiFetch } from "./api";

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
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
  ts: number;
  currency: string;
  marketState: string;
  source?: string;        // "instaforex" | "stooq"
  fetchedAt?: string;     // ISO timestamp
  spread?: number;
  bid?: number;
  ask?: number;
}

export interface MultiQuote {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  sparkline: number[];
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

export async function getQuote(symbol = "XAUUSD"): Promise<Quote> {
  return apiFetch<Quote>(`/api/market/quote?symbol=${encodeURIComponent(symbol)}`);
}

export async function getCandles(
  symbol = "XAUUSD",
  interval: Interval = "5m",
  range: Range = "5d",
): Promise<{ symbol: string; interval: string; range: string; candles: Candle[] }> {
  return apiFetch(
    `/api/market/candles?symbol=${encodeURIComponent(symbol)}&interval=${interval}&range=${range}`,
  );
}

export async function getMulti(
  symbols: string[] = ["XAUUSD", "XAGUSD", "DXY", "BTC", "SPX", "EURUSD"],
): Promise<{ items: MultiQuote[] }> {
  return apiFetch(`/api/market/multi?symbols=${symbols.join(",")}`);
}

export const TIMEFRAMES: { label: string; interval: Interval; range: Range }[] = [
  { label: "1m", interval: "1m", range: "1d" },
  { label: "5m", interval: "5m", range: "5d" },
  { label: "15m", interval: "15m", range: "5d" },
  { label: "1H", interval: "60m", range: "1mo" },
  { label: "4H", interval: "60m", range: "3mo" },
  { label: "1D", interval: "1d", range: "1y" },
  { label: "1W", interval: "1wk", range: "5y" },
];

export const WATCHLIST = [
  "XAUUSD",
  "XAGUSD",
  "DXY",
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "BTC",
  "ETH",
  "SPX",
  "WTI",
];
