import React, { useMemo } from "react";
import { StyleSheet, View, Text } from "react-native";
import Svg, { G, Line, Rect, Path, Text as SvgText } from "react-native-svg";

import type { Candle } from "@/lib/marketData";
import { useColors } from "@/hooks/useColors";

interface Props {
  candles: Candle[];
  width: number;
  height: number;
  overlay?: { values: (number | null)[]; color: string; width?: number }[];
  markers?: { index: number; side: "LONG" | "SHORT" }[];
  showAxis?: boolean;
}

export function PriceChart({
  candles,
  width,
  height,
  overlay = [],
  markers = [],
  showAxis = true,
}: Props) {
  const colors = useColors();
  const padL = showAxis ? 48 : 6;
  const padR = 6;
  const padT = 8;
  const padB = showAxis ? 22 : 6;

  const innerW = Math.max(0, width - padL - padR);
  const innerH = Math.max(0, height - padT - padB);

  const { min, max } = useMemo(() => {
    let mn = Infinity;
    let mx = -Infinity;
    for (const c of candles) {
      if (c.l < mn) mn = c.l;
      if (c.h > mx) mx = c.h;
    }
    for (const o of overlay) {
      for (const v of o.values) {
        if (v == null) continue;
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
    }
    if (!isFinite(mn) || !isFinite(mx)) return { min: 0, max: 1 };
    if (mn === mx) {
      mn -= 1;
      mx += 1;
    }
    const pad = (mx - mn) * 0.05;
    return { min: mn - pad, max: mx + pad };
  }, [candles, overlay]);

  if (candles.length === 0) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={{ color: colors.mutedForeground }}>No data</Text>
      </View>
    );
  }

  const xStep = innerW / Math.max(1, candles.length);
  const cw = Math.max(1, xStep * 0.7);

  const yOf = (v: number) =>
    padT + innerH - ((v - min) / (max - min)) * innerH;
  const xOf = (i: number) => padL + i * xStep + xStep / 2;

  const yAxisVals = [0, 0.25, 0.5, 0.75, 1].map(
    (p) => min + (max - min) * (1 - p),
  );

  return (
    <Svg width={width} height={height}>
      {/* Grid */}
      {showAxis &&
        yAxisVals.map((v, i) => (
          <G key={`g-${i}`}>
            <Line
              x1={padL}
              x2={padL + innerW}
              y1={padT + (innerH * i) / 4}
              y2={padT + (innerH * i) / 4}
              stroke={colors.border}
              strokeWidth={0.5}
            />
            <SvgText
              x={padL - 6}
              y={padT + (innerH * i) / 4 + 3}
              fill={colors.mutedForeground}
              fontSize={9}
              textAnchor="end"
            >
              {v.toFixed(2)}
            </SvgText>
          </G>
        ))}
      {/* Overlay lines */}
      {overlay.map((o, oi) => {
        let d = "";
        let started = false;
        o.values.forEach((v, i) => {
          if (v == null) {
            started = false;
            return;
          }
          const x = xOf(i);
          const y = yOf(v);
          if (!started) {
            d += `M ${x} ${y}`;
            started = true;
          } else {
            d += ` L ${x} ${y}`;
          }
        });
        return (
          <Path
            key={`o-${oi}`}
            d={d}
            stroke={o.color}
            strokeWidth={o.width ?? 1.2}
            fill="none"
          />
        );
      })}
      {/* Candles */}
      {candles.map((c, i) => {
        const isUp = c.c >= c.o;
        const color = isUp ? colors.bullish : colors.bearish;
        const x = xOf(i);
        const yH = yOf(c.h);
        const yL = yOf(c.l);
        const yO = yOf(c.o);
        const yC = yOf(c.c);
        const top = Math.min(yO, yC);
        const h = Math.max(1, Math.abs(yO - yC));
        return (
          <G key={i}>
            <Line
              x1={x}
              x2={x}
              y1={yH}
              y2={yL}
              stroke={color}
              strokeWidth={1}
            />
            <Rect
              x={x - cw / 2}
              y={top}
              width={cw}
              height={h}
              fill={color}
              rx={1}
            />
          </G>
        );
      })}
      {/* Markers */}
      {markers.map((m, i) => {
        const c = candles[m.index];
        if (!c) return null;
        const x = xOf(m.index);
        const isLong = m.side === "LONG";
        const y = isLong ? yOf(c.l) + 12 : yOf(c.h) - 12;
        const color = isLong ? colors.bullish : colors.bearish;
        const tri = isLong
          ? `M ${x - 5} ${y + 5} L ${x + 5} ${y + 5} L ${x} ${y - 3} Z`
          : `M ${x - 5} ${y - 5} L ${x + 5} ${y - 5} L ${x} ${y + 3} Z`;
        return <Path key={`m-${i}`} d={tri} fill={color} />;
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    justifyContent: "center",
  },
});
