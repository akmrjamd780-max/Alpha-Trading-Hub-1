import React, { useMemo } from "react";
import { View, StyleSheet, Platform, Text } from "react-native";
import { WebView } from "react-native-webview";
import type { Candle } from "@/lib/marketData";
import { useColors } from "@/hooks/useColors";

export interface TVOverlay {
  values: (number | null)[];
  color: string;
  width?: number;
  label?: string;
}

export interface TVMarker {
  index: number;
  side: "LONG" | "SHORT" | "BUY" | "SELL";
  label?: string;
  price?: number;
}

export interface TVFVG {
  startIdx: number;
  endIdx: number;
  high: number;
  low: number;
  side: "BULL" | "BEAR";
  filled: boolean;
}

export interface TVZone {
  high: number;
  low: number;
  color: string;
  label?: string;
}

export interface TVHLine {
  price: number;
  color: string;
  label?: string;
  dashed?: boolean;
}

interface Props {
  candles: Candle[];
  width: number;
  height: number;
  overlays?: TVOverlay[];
  markers?: TVMarker[];
  fvgZones?: TVFVG[];
  warZone?: { high: number; low: number; active: boolean } | null;
  fibLevels?: { price: number; label: string; color: string }[];
  hLines?: TVHLine[];
  isDark?: boolean;
}

export function TradingViewChart({
  candles,
  width,
  height,
  overlays = [],
  markers = [],
  fvgZones = [],
  warZone = null,
  fibLevels = [],
  hLines = [],
  isDark = true,
}: Props) {
  const colors = useColors();

  const html = useMemo(() => {
    const chartData = candles.map((c) => ({
      time: Math.floor(c.t / 1000),
      open: c.o,
      high: c.h,
      low: c.l,
      close: c.c,
      volume: c.v,
    }));

    const bg = isDark ? "#0a0a0a" : "#ffffff";
    const grid = isDark ? "#1a1a1a" : "#f0f0f0";
    const text = isDark ? "#e5e5e5" : "#333333";
    const wickUp = "#22c55e";
    const wickDown = "#ef4444";
    const border = isDark ? "#2a2a2a" : "#e0e0e0";

    const overlaySeries = overlays.map((o, i) => ({
      id: i,
      values: o.values.map((v, idx) =>
        v != null ? { time: chartData[idx]?.time, value: v } : null,
      ).filter(Boolean),
      color: o.color,
      lineWidth: o.width ?? 1,
      label: o.label || `Line ${i + 1}`,
    }));

    const hLineData = hLines.map((h) => ({
      price: h.price,
      color: h.color,
      label: h.label || "",
      lineStyle: h.dashed ? 2 : 0,
    }));

    const fvgData = fvgZones.map((z) => ({
      top: z.high,
      bottom: z.low,
      color: z.side === "BULL" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)",
      borderColor: z.side === "BULL" ? "rgba(34,197,94,0.6)" : "rgba(239,68,68,0.6)",
    }));

    const warZoneData = warZone?.active ? {
      top: warZone.high,
      bottom: warZone.low,
      color: "rgba(217,119,6,0.15)",
      borderColor: "rgba(217,119,6,0.5)",
    } : null;

    const fibData = fibLevels.map((f) => ({
      price: f.price,
      color: f.color,
      label: f.label,
    }));

    const markerData = markers.map((m) => ({
      time: chartData[m.index]?.time,
      position: m.side === "BUY" || m.side === "LONG" ? "belowBar" : "aboveBar",
      color: m.side === "BUY" || m.side === "LONG" ? "#22c55e" : "#ef4444",
      shape: m.side === "BUY" || m.side === "LONG" ? "arrowUp" : "arrowDown",
      text: m.label || m.side,
      price: m.price,
    })).filter(m => m.time);

    return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <style>
    body { margin: 0; padding: 0; background: ${bg}; overflow: hidden; }
    #chart { width: 100%; height: 100%; }
  </style>
  <script src="https://unpkg.com/lightweight-charts@5.0.5/dist/lightweight-charts.standalone.production.js"></script>
</head>
<body>
  <div id="chart"></div>
  <script>
    (function() {
      const chartData = ${JSON.stringify(chartData)};
      const overlaySeries = ${JSON.stringify(overlaySeries)};
      const hLines = ${JSON.stringify(hLineData)};
      const fvgZones = ${JSON.stringify(fvgData)};
      const warZone = ${JSON.stringify(warZoneData)};
      const fibLevels = ${JSON.stringify(fibData)};
      const markers = ${JSON.stringify(markerData)};
      const bg = "${bg}";
      const grid = "${grid}";
      const text = "${text}";
      const wickUp = "${wickUp}";
      const wickDown = "${wickDown}";
      const border = "${border}";

      const chart = LightweightCharts.createChart(document.getElementById('chart'), {
        width: ${width},
        height: ${height},
        layout: {
          background: { type: 'solid', color: bg },
          textColor: text,
          fontFamily: 'Inter, -apple-system, sans-serif',
        },
        grid: {
          vertLines: { color: grid, style: 1 },
          horzLines: { color: grid, style: 1 },
        },
        crosshair: {
          mode: LightweightCharts.CrosshairMode.Normal,
          vertLine: { color: 'rgba(255,255,255,0.3)', width: 1, style: 2 },
          horzLine: { color: 'rgba(255,255,255,0.3)', width: 1, style: 2 },
        },
        rightPriceScale: {
          borderColor: border,
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
        timeScale: {
          borderColor: border,
          timeVisible: true,
          secondsVisible: false,
          tickMarkFormatter: (time, tickMarkType, locale) => {
            const d = new Date(time * 1000);
            return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
          },
        },
        handleScroll: true,
        handleScale: true,
      });

      const candleSeries = chart.addCandlestickSeries({
        upColor: wickUp,
        downColor: wickDown,
        borderUpColor: wickUp,
        borderDownColor: wickDown,
        wickUpColor: wickUp,
        wickDownColor: wickDown,
        priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      });
      candleSeries.setData(chartData);

      // Overlays
      overlaySeries.forEach(o => {
        const line = chart.addLineSeries({
          color: o.color,
          lineWidth: o.lineWidth,
          title: o.label,
          lastValueVisible: false,
          priceLineVisible: false,
        });
        line.setData(o.values);
      });

      // Horizontal lines
      hLines.forEach(h => {
        candleSeries.createPriceLine({
          price: h.price,
          color: h.color,
          lineWidth: h.dashed ? 1 : 2,
          lineStyle: h.dashed ? LightweightCharts.LineStyle.Dashed : LightweightCharts.LineStyle.Solid,
          axisLabelVisible: true,
          title: h.label,
        });
      });

      // FVG zones
      fvgZones.forEach(z => {
        const band = chart.addCustomSeries(LightweightCharts.BaselineSeries, {
          baseValue: { type: 'price', price: (z.top + z.bottom) / 2 },
          topLineColor: z.borderColor,
          bottomLineColor: z.borderColor,
          topFillColor1: z.color,
          topFillColor2: z.color,
          bottomFillColor1: z.color,
          bottomFillColor2: z.color,
        });
      });

      // War zone
      if (warZone) {
        candleSeries.createPriceLine({
          price: warZone.top,
          color: warZone.borderColor,
          lineWidth: 1,
          lineStyle: LightweightCharts.LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'War Zone Top',
        });
        candleSeries.createPriceLine({
          price: warZone.bottom,
          color: warZone.borderColor,
          lineWidth: 1,
          lineStyle: LightweightCharts.LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'War Zone Bottom',
        });
      }

      // Fibonacci levels
      fibLevels.forEach(f => {
        candleSeries.createPriceLine({
          price: f.price,
          color: f.color,
          lineWidth: 1,
          lineStyle: LightweightCharts.LineStyle.Dashed,
          axisLabelVisible: true,
          title: f.label,
        });
      });

      // Markers
      if (markers.length > 0) {
        candleSeries.setMarkers(markers);
      }

      // Fit content
      chart.timeScale().fitContent();

      // Handle resize
      window.addEventListener('resize', () => {
        chart.applyOptions({ width: window.innerWidth, height: window.innerHeight });
      });
    })();
  </script>
</body>
</html>`;
  }, [candles, width, height, overlays, markers, fvgZones, warZone, fibLevels, hLines, isDark]);

  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, { width, height, backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "center", marginTop: 20 }}>
          TradingView chart loading...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width, height }]}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={{ width, height, backgroundColor: "transparent" }}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        bounces={false}
        overScrollMode="never"
        androidHardwareAccelerationDisabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    borderRadius: 8,
  },
});
