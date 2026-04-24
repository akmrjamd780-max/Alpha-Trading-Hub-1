import React, { useMemo, useRef, useState, useCallback } from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import {
  GestureDetector,
  Gesture,
  type PanGesture,
} from "react-native-gesture-handler";
import Svg, { G, Line, Rect, Path, Text as SvgText } from "react-native-svg";

import type { Candle } from "@/lib/marketData";
import { useColors } from "@/hooks/useColors";

export interface FVGOverlay {
  startIdx: number;
  endIdx: number;
  high: number;
  low: number;
  side: "BULL" | "BEAR";
  filled: boolean;
}

export interface SignalMarker {
  index: number;
  side: "LONG" | "SHORT" | "BUY" | "SELL";
  label?: string;
}

interface Props {
  candles: Candle[];
  width: number;
  height: number;
  overlay?: { values: (number | null)[]; color: string; width?: number; label?: string }[];
  markers?: SignalMarker[];
  showAxis?: boolean;
  enableInteraction?: boolean;
  fvgZones?: FVGOverlay[];
  warZone?: { high: number; low: number; active: boolean } | null;
  fibLevels?: { price: number; label: string; color: string }[];
  swingHighs?: number[];
  swingLows?: number[];
  hLines?: { price: number; color: string; dashed?: boolean; label?: string }[];
  initialVisibleBars?: number;
}

export function PriceChart({
  candles,
  width,
  height,
  overlay = [],
  markers = [],
  showAxis = true,
  enableInteraction = true,
  fvgZones = [],
  warZone = null,
  fibLevels = [],
  swingHighs = [],
  swingLows = [],
  hLines = [],
  initialVisibleBars = 90,
}: Props) {
  const colors = useColors();
  const padL = showAxis ? 48 : 6;
  const padR = 48;
  const padT = 8;
  const padB = showAxis ? 22 : 6;

  const innerW = Math.max(0, width - padL - padR);
  const innerH = Math.max(0, height - padT - padB);

  // View window state (start, end indexes inclusive of candles array)
  const initialEnd = candles.length;
  const initialStart = Math.max(0, initialEnd - initialVisibleBars);
  const [view, setView] = useState({ start: initialStart, end: initialEnd });
  const baseView = useRef({ start: initialStart, end: initialEnd });
  const baseScale = useRef(1);

  // If candles change (new data) and we're at the rightmost, follow live edge
  const lastLenRef = useRef(candles.length);
  if (candles.length !== lastLenRef.current) {
    const wasAtEnd = view.end >= lastLenRef.current - 1;
    if (wasAtEnd) {
      const newEnd = candles.length;
      const span = view.end - view.start;
      setView({ start: Math.max(0, newEnd - span), end: newEnd });
    }
    lastLenRef.current = candles.length;
  }

  const visible = candles.slice(view.start, view.end);

  const { min, max } = useMemo(() => {
    let mn = Infinity;
    let mx = -Infinity;
    for (const c of visible) {
      if (c.l < mn) mn = c.l;
      if (c.h > mx) mx = c.h;
    }
    for (const o of overlay) {
      for (let i = view.start; i < view.end; i++) {
        const v = o.values[i];
        if (v == null) continue;
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
    }
    for (const f of fibLevels) {
      if (f.price < mn) mn = f.price;
      if (f.price > mx) mx = f.price;
    }
    if (!isFinite(mn) || !isFinite(mx)) return { min: 0, max: 1 };
    if (mn === mx) {
      mn -= 1;
      mx += 1;
    }
    const pad = (mx - mn) * 0.05;
    return { min: mn - pad, max: mx + pad };
  }, [visible, overlay, view.start, view.end, fibLevels]);

  const xStep = innerW / Math.max(1, visible.length);
  const cw = Math.max(1, xStep * 0.7);

  const yOf = useCallback(
    (v: number) => padT + innerH - ((v - min) / (max - min)) * innerH,
    [padT, innerH, min, max],
  );
  const xOf = useCallback(
    (vi: number) => padL + vi * xStep + xStep / 2,
    [padL, xStep],
  );
  // Map global candle index (in the full array) → x
  const xOfGlobal = useCallback(
    (gi: number) => xOf(gi - view.start),
    [xOf, view.start],
  );

  // Reset to last N bars
  const resetView = useCallback(() => {
    const newEnd = candles.length;
    const newStart = Math.max(0, newEnd - initialVisibleBars);
    setView({ start: newStart, end: newEnd });
  }, [candles.length, initialVisibleBars]);

  // Gestures
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          baseView.current = { ...view };
        })
        .onUpdate((e) => {
          const span = baseView.current.end - baseView.current.start;
          if (span <= 0 || innerW <= 0) return;
          const candlesPerPx = span / innerW;
          const dxBars = Math.round(-e.translationX * candlesPerPx);
          let newStart = baseView.current.start + dxBars;
          let newEnd = baseView.current.end + dxBars;
          if (newStart < 0) {
            newEnd -= newStart;
            newStart = 0;
          }
          if (newEnd > candles.length) {
            const over = newEnd - candles.length;
            newEnd = candles.length;
            newStart = Math.max(0, newStart - over);
          }
          setView({ start: newStart, end: newEnd });
        })
        .runOnJS(true),
    [view, innerW, candles.length],
  ) as PanGesture;

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onStart(() => {
          baseView.current = { ...view };
          baseScale.current = 1;
        })
        .onUpdate((e) => {
          const scale = e.scale;
          const span = baseView.current.end - baseView.current.start;
          let newSpan = Math.round(span / scale);
          newSpan = Math.max(15, Math.min(candles.length, newSpan));
          // anchor on right edge
          const newEnd = baseView.current.end;
          const newStart = Math.max(0, newEnd - newSpan);
          setView({ start: newStart, end: newEnd });
        })
        .runOnJS(true),
    [view, candles.length],
  );

  const doubleTap = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => resetView())
        .runOnJS(true),
    [resetView],
  );

  const composed = Gesture.Simultaneous(panGesture, pinchGesture, doubleTap);

  if (candles.length === 0) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={{ color: colors.mutedForeground }}>—</Text>
      </View>
    );
  }

  const yAxisVals = [0, 0.25, 0.5, 0.75, 1].map((p) => min + (max - min) * (1 - p));

  const lastVisibleIdx = view.end - 1;
  const lastClose = candles[lastVisibleIdx]?.c;
  const lastY = lastClose != null ? yOf(lastClose) : null;
  const isUpClose =
    candles[lastVisibleIdx] != null && candles[lastVisibleIdx]!.c >= candles[lastVisibleIdx]!.o;

  const ChartSvg = (
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

      {/* War zone */}
      {warZone && warZone.active && (
        <Rect
          x={padL}
          y={Math.min(yOf(warZone.high), yOf(warZone.low))}
          width={innerW}
          height={Math.abs(yOf(warZone.high) - yOf(warZone.low))}
          fill="#ef4444"
          opacity={0.06}
        />
      )}

      {/* Fib levels */}
      {fibLevels.map((f, i) => {
        const y = yOf(f.price);
        if (y < padT || y > padT + innerH) return null;
        return (
          <G key={`fib-${i}`}>
            <Line
              x1={padL}
              x2={padL + innerW}
              y1={y}
              y2={y}
              stroke={f.color}
              strokeWidth={0.8}
              strokeDasharray="3,3"
              opacity={0.6}
            />
            <SvgText x={padL + innerW + 2} y={y + 3} fill={f.color} fontSize={8}>
              {f.label}
            </SvgText>
          </G>
        );
      })}

      {/* FVG zones */}
      {fvgZones.map((z, i) => {
        if (z.endIdx < view.start || z.startIdx > view.end) return null;
        const x1 = xOfGlobal(Math.max(z.startIdx, view.start));
        const x2 = padL + innerW;
        const y1 = yOf(z.high);
        const y2 = yOf(z.low);
        const color = z.side === "BULL" ? colors.bullish : colors.bearish;
        return (
          <Rect
            key={`fvg-${i}`}
            x={x1}
            y={Math.min(y1, y2)}
            width={Math.max(2, x2 - x1)}
            height={Math.abs(y2 - y1)}
            fill={color}
            opacity={z.filled ? 0.04 : 0.12}
          />
        );
      })}

      {/* Horizontal lines (SL/TP/entry) */}
      {hLines.map((h, i) => {
        const y = yOf(h.price);
        if (y < padT || y > padT + innerH) return null;
        return (
          <G key={`h-${i}`}>
            <Line
              x1={padL}
              x2={padL + innerW}
              y1={y}
              y2={y}
              stroke={h.color}
              strokeWidth={1}
              strokeDasharray={h.dashed ? "5,4" : undefined}
            />
            {h.label ? (
              <SvgText
                x={padL + 4}
                y={y - 3}
                fill={h.color}
                fontSize={9}
                fontWeight="bold"
              >
                {h.label}
              </SvgText>
            ) : null}
          </G>
        );
      })}

      {/* Overlay lines */}
      {overlay.map((o, oi) => {
        let d = "";
        let started = false;
        for (let i = view.start; i < view.end; i++) {
          const v = o.values[i];
          if (v == null) {
            started = false;
            continue;
          }
          const x = xOfGlobal(i);
          const y = yOf(v);
          if (!started) {
            d += `M ${x} ${y}`;
            started = true;
          } else {
            d += ` L ${x} ${y}`;
          }
        }
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
      {visible.map((c, i) => {
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
            <Line x1={x} x2={x} y1={yH} y2={yL} stroke={color} strokeWidth={1} />
            <Rect x={x - cw / 2} y={top} width={cw} height={h} fill={color} rx={1} />
          </G>
        );
      })}

      {/* Swing highs */}
      {swingHighs.map((gi, i) => {
        if (gi < view.start || gi >= view.end) return null;
        const c = candles[gi];
        if (!c) return null;
        const x = xOfGlobal(gi);
        const y = yOf(c.h) - 6;
        return (
          <SvgText key={`sh-${i}`} x={x} y={y} fill={colors.bearish} fontSize={9} textAnchor="middle">
            ▼
          </SvgText>
        );
      })}
      {swingLows.map((gi, i) => {
        if (gi < view.start || gi >= view.end) return null;
        const c = candles[gi];
        if (!c) return null;
        const x = xOfGlobal(gi);
        const y = yOf(c.l) + 12;
        return (
          <SvgText key={`sl-${i}`} x={x} y={y} fill={colors.bullish} fontSize={9} textAnchor="middle">
            ▲
          </SvgText>
        );
      })}

      {/* Markers (signals) */}
      {markers.map((m, i) => {
        if (m.index < view.start || m.index >= view.end) return null;
        const c = candles[m.index];
        if (!c) return null;
        const x = xOfGlobal(m.index);
        const isLong = m.side === "LONG" || m.side === "BUY";
        const y = isLong ? yOf(c.l) + 14 : yOf(c.h) - 14;
        const color = isLong ? colors.bullish : colors.bearish;
        const tri = isLong
          ? `M ${x - 6} ${y + 6} L ${x + 6} ${y + 6} L ${x} ${y - 4} Z`
          : `M ${x - 6} ${y - 6} L ${x + 6} ${y - 6} L ${x} ${y + 4} Z`;
        return (
          <G key={`m-${i}`}>
            <Path d={tri} fill={color} />
            {m.label ? (
              <SvgText
                x={x}
                y={isLong ? y + 18 : y - 8}
                fill={color}
                fontSize={8}
                textAnchor="middle"
                fontWeight="bold"
              >
                {m.label}
              </SvgText>
            ) : null}
          </G>
        );
      })}

      {/* Last price label on right axis */}
      {lastY != null && lastClose != null && (
        <G>
          <Rect
            x={padL + innerW}
            y={lastY - 8}
            width={padR}
            height={16}
            fill={isUpClose ? colors.bullish : colors.bearish}
            rx={2}
          />
          <SvgText
            x={padL + innerW + padR / 2}
            y={lastY + 4}
            fill="#fff"
            fontSize={10}
            textAnchor="middle"
            fontWeight="bold"
          >
            {lastClose.toFixed(2)}
          </SvgText>
        </G>
      )}
    </Svg>
  );

  return (
    <View style={{ width, height }}>
      {enableInteraction ? (
        <GestureDetector gesture={composed}>
          <View style={{ width, height }}>{ChartSvg}</View>
        </GestureDetector>
      ) : (
        ChartSvg
      )}
      {enableInteraction && (
        <View style={[styles.controls, { borderColor: colors.border }]}>
          <Pressable
            onPress={resetView}
            style={[styles.ctlBtn, { backgroundColor: colors.cardElevated }]}
          >
            <Text style={{ color: colors.gold, fontSize: 9, fontFamily: "Inter_700Bold" }}>
              ⟲
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", justifyContent: "center" },
  controls: {
    position: "absolute",
    top: 6,
    right: 54,
    flexDirection: "row",
    gap: 4,
  },
  ctlBtn: {
    width: 22,
    height: 22,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
});
