/**
 * Market data routes — backed by InstaForex (primary) + Stooq (secondary).
 * Yahoo Finance has been removed from the entire execution path.
 *
 * All responses include a `source` field identifying the actual data provider.
 * When ALL providers fail, returns 502 with explicit error (no silent fallback).
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { gateway } from "../lib/gateway";
import type { Interval, Range } from "../lib/gateway/types";

const router: IRouter = Router();

const VALID_INTERVALS = new Set<Interval>([
  "1m", "2m", "5m", "15m", "30m", "60m", "90m", "1d", "1wk", "1mo",
]);
const VALID_RANGES = new Set<Range>([
  "1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "max",
]);

// GET /api/market/quote?symbol=XAUUSD
router.get("/market/quote", async (req: Request, res: Response) => {
  const symbol = String(req.query["symbol"] ?? "XAUUSD").toUpperCase().trim();
  const t0 = Date.now();
  try {
    const result = await gateway.getQuote(symbol);
    if (!result) {
      req.log.error(
        { symbol, latencyMs: Date.now() - t0 },
        "All data providers failed for quote",
      );
      res.status(502).json({
        error: "All data providers failed",
        symbol,
        providers: gateway.getStatus().map((s) => ({ name: s.name, healthy: s.healthy })),
      });
      return;
    }
    req.log.info(
      { symbol, source: result.source, price: result.quote.price, latencyMs: Date.now() - t0 },
      "quote served",
    );
    res.json({
      ...result.quote,
      source: result.source,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err, symbol }, "quote route error");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /api/market/candles?symbol=XAUUSD&interval=5m&range=5d
router.get("/market/candles", async (req: Request, res: Response) => {
  const symbol = String(req.query["symbol"] ?? "XAUUSD").toUpperCase().trim();
  const intervalParam = String(req.query["interval"] ?? "5m");
  const rangeParam = String(req.query["range"] ?? "5d");
  const t0 = Date.now();

  const interval = VALID_INTERVALS.has(intervalParam as Interval)
    ? (intervalParam as Interval)
    : "5m";
  const range = VALID_RANGES.has(rangeParam as Range)
    ? (rangeParam as Range)
    : "5d";

  try {
    const result = await gateway.getCandles(symbol, interval, range);
    if (!result) {
      req.log.error(
        { symbol, interval, range, latencyMs: Date.now() - t0 },
        "All data providers failed for candles",
      );
      res.status(502).json({
        error: "All data providers failed",
        symbol,
        interval,
        range,
        providers: gateway.getStatus().map((s) => ({ name: s.name, healthy: s.healthy })),
      });
      return;
    }
    req.log.info(
      {
        symbol,
        source: result.source,
        candles: result.candles.length,
        interval,
        range,
        latencyMs: Date.now() - t0,
      },
      "candles served",
    );
    res.json({
      symbol,
      interval: result.interval,
      range: result.range,
      candles: result.candles,
      source: result.source,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err, symbol }, "candles route error");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /api/market/multi?symbols=XAUUSD,XAGUSD,DXY,BTC,EURUSD
router.get("/market/multi", async (req: Request, res: Response) => {
  const symbolsParam = String(
    req.query["symbols"] ?? "XAUUSD,XAGUSD,DXY,BTC,EURUSD",
  );
  const list = symbolsParam
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const t0 = Date.now();

  try {
    const result = await gateway.getMultiQuote(list);
    if (!result) {
      req.log.error(
        { symbols: list, latencyMs: Date.now() - t0 },
        "All data providers failed for multi-quote",
      );
      res.status(502).json({
        error: "All data providers failed",
        symbols: list,
        providers: gateway.getStatus().map((s) => ({ name: s.name, healthy: s.healthy })),
      });
      return;
    }
    req.log.info(
      { symbols: list, source: result.source, count: result.items.length, latencyMs: Date.now() - t0 },
      "multi-quote served",
    );
    res.json({
      items: result.items,
      source: result.source,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "multi route error");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /api/market/status — provider health + active source
router.get("/market/status", (_req: Request, res: Response) => {
  const statuses = gateway.getStatus();
  const primary = gateway.getPrimaryProvider();
  res.json({
    providers: statuses,
    activePrimary: primary,
    yahooFinance: "REMOVED — not in execution path",
    dataStack: ["instaforex", "stooq"],
    checkedAt: new Date().toISOString(),
  });
});

// GET /api/market/health — simple health check for monitoring
router.get("/market/health", (_req: Request, res: Response) => {
  const statuses = gateway.getStatus();
  const anyHealthy = statuses.some((s) => s.healthy);
  const code = anyHealthy ? 200 : 503;
  res.status(code).json({
    healthy: anyHealthy,
    providers: statuses.map((s) => ({
      name: s.name,
      healthy: s.healthy,
      errorCount: s.errorCount,
      lastSuccessAgoMs: s.lastSuccess ? Date.now() - s.lastSuccess : null,
      latencyMs: s.latencyMs,
    })),
  });
});

export default router;
