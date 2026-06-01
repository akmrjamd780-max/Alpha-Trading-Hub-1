import { Router, type IRouter, type Request, type Response } from "express";
import { gateway } from "../lib/gateway";

const router: IRouter = Router();

router.get("/market/quote", async (req: Request, res: Response) => {
  try {
    const symbolParam = String(req.query["symbol"] ?? "XAUUSD");
    const result = await gateway.getQuote(symbolParam);
    if (!result) {
      res.status(502).json({ error: "Upstream fetch failed" });
      return;
    }
    res.json({ ...result.quote, source: result.source });
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
    const result = await gateway.getCandles(
      symbolParam,
      interval as "1m" | "2m" | "5m" | "15m" | "30m" | "60m" | "90m" | "1d" | "1wk" | "1mo",
      range as "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y" | "max",
    );
    if (!result) {
      res.status(502).json({ error: "Upstream fetch failed" });
      return;
    }
    res.json({
      symbol: symbolParam.toUpperCase(),
      interval: result.interval,
      range: result.range,
      candles: result.candles,
      source: result.source,
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
    const result = await gateway.getMultiQuote(list);
    if (!result) {
      res.status(502).json({ error: "Upstream fetch failed" });
      return;
    }
    res.json({ items: result.items, source: result.source });
  } catch (err) {
    req.log.error({ err }, "multi failed");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/market/status", async (_req: Request, res: Response) => {
  const statuses = gateway.getStatus();
  res.json({ providers: statuses });
});

export default router;
