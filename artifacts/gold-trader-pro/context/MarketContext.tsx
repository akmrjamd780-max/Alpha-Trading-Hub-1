import React, { createContext, useContext, useState } from "react";

interface MarketCtx {
  symbol: string;
  setSymbol: (s: string) => void;
  timeframe: string;
  setTimeframe: (s: string) => void;
}

const Ctx = createContext<MarketCtx | null>(null);

export function MarketProvider({ children }: { children: React.ReactNode }) {
  const [symbol, setSymbol] = useState("XAUUSD");
  const [timeframe, setTimeframe] = useState("15m");
  return (
    <Ctx.Provider value={{ symbol, setSymbol, timeframe, setTimeframe }}>
      {children}
    </Ctx.Provider>
  );
}

export function useMarket() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMarket must be used within MarketProvider");
  return v;
}
