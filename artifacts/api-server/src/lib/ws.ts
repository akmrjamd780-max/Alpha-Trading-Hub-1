/**
 * WebSocket Streaming Server
 * Real-time price streaming with auto-reconnect, heartbeat, and connection monitoring.
 */

import type { WebSocket as WebSocketType } from "ws";
import { WebSocketServer } from "ws";
import { logger } from "../lib/logger";
import { gateway } from "../lib/gateway";

const HEARTBEAT_INTERVAL = 30_000; // 30s
const STREAM_INTERVAL = 5_000; // 5s price updates

interface ClientState {
  ws: WebSocketType;
  lastPing: number;
  subscribedSymbols: Set<string>;
  isAlive: boolean;
}

const clients = new Map<string, ClientState>();
let clientIdCounter = 0;

// Start WebSocket server on a port (typically adjacent to HTTP port)
export function startWebSocketServer(port: number): void {
  const wss = new WebSocketServer({ port });
  logger.info({ wsPort: port }, "WebSocket server started");

  wss.on("connection", (ws) => {
    const id = `ws-${++clientIdCounter}`;
    const state: ClientState = {
      ws,
      lastPing: Date.now(),
      subscribedSymbols: new Set(["XAUUSD"]),
      isAlive: true,
    };
    clients.set(id, state);
    logger.info({ wsId: id, totalClients: clients.size }, "ws connected");

    ws.send(
      JSON.stringify({
        type: "connected",
        id,
        message: "Gold Trader Pro streaming connected",
        timestamp: Date.now(),
      }),
    );

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type: string;
          symbols?: string[];
          action?: string;
        };
        if (msg.type === "subscribe" && msg.symbols) {
          state.subscribedSymbols = new Set(msg.symbols);
          ws.send(
            JSON.stringify({
              type: "subscribed",
              symbols: Array.from(state.subscribedSymbols),
            }),
          );
        } else if (msg.type === "ping") {
          state.lastPing = Date.now();
          state.isAlive = true;
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        } else if (msg.type === "unsubscribe") {
          if (msg.symbols) {
            for (const s of msg.symbols) state.subscribedSymbols.delete(s);
          } else {
            state.subscribedSymbols.clear();
          }
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on("close", () => {
      clients.delete(id);
      logger.info({ wsId: id, totalClients: clients.size }, "ws disconnected");
    });

    ws.on("error", (err) => {
      logger.warn({ err, wsId: id }, "ws error");
    });
  });

  // Heartbeat checker
  setInterval(() => {
    for (const [id, state] of clients) {
      if (!state.isAlive) {
        state.ws.terminate();
        clients.delete(id);
        logger.info({ wsId: id }, "ws terminated (no heartbeat)");
        continue;
      }
      state.isAlive = false;
      if (state.ws.readyState === state.ws.OPEN) {
        state.ws.send(JSON.stringify({ type: "heartbeat", timestamp: Date.now() }));
      }
    }
  }, HEARTBEAT_INTERVAL);

  // Price broadcaster
  let lastQuotes: Record<string, number> = {};

  setInterval(async () => {
    const allSymbols = new Set<string>();
    for (const state of clients.values()) {
      for (const sym of state.subscribedSymbols) allSymbols.add(sym);
    }
    if (allSymbols.size === 0) return;

    const quotes: Record<string, Record<string, unknown>> = {};
    for (const sym of allSymbols) {
      try {
        const result = await gateway.getQuote(sym);
        if (result) {
          quotes[sym] = {
            symbol: result.quote.symbol,
            price: result.quote.price,
            bid: result.quote.bid,
            ask: result.quote.ask,
            change: result.quote.change,
            changePct: result.quote.changePct,
            high: result.quote.high,
            low: result.quote.low,
            open: result.quote.open,
            spread: result.quote.spread,
            ts: result.quote.ts,
            source: result.source,
            trend: result.quote.price > (lastQuotes[sym] ?? result.quote.price) ? "up" : "down",
          };
          lastQuotes[sym] = result.quote.price;
        }
      } catch (err) {
        logger.debug({ err, sym }, "ws quote fetch failed");
      }
    }

    const payload = JSON.stringify({
      type: "quotes",
      data: quotes,
      timestamp: Date.now(),
    });

    for (const state of clients.values()) {
      if (state.ws.readyState === state.ws.OPEN) {
        state.ws.send(payload);
      }
    }
  }, STREAM_INTERVAL);
}

export function getWsStats() {
  return {
    connectedClients: clients.size,
    subscribedSymbols: Array.from(
      new Set(
        Array.from(clients.values()).flatMap((s) => Array.from(s.subscribedSymbols)),
      ),
    ),
  };
}
