import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/Header";
import { PriceChart } from "@/components/PriceChart";
import { Card } from "@/components/Card";
import { useColors, useRadius } from "@/hooks/useColors";
import { useMarket } from "@/context/MarketContext";
import {
  getCandles,
  TIMEFRAMES,
  WATCHLIST,
  type Interval,
  type Range,
} from "@/lib/marketData";
import { ema, rsi, bollinger, pivotPoints } from "@/lib/indicators";

const OVERLAYS = [
  { id: "ema20", label: "EMA 20" },
  { id: "ema50", label: "EMA 50" },
  { id: "ema200", label: "EMA 200" },
  { id: "bb", label: "Bollinger" },
];

export default function ChartsScreen() {
  const colors = useColors();
  const radius = useRadius();
  const { symbol, setSymbol } = useMarket();
  const [tfIdx, setTfIdx] = useState(2);
  const [overlays, setOverlays] = useState<string[]>(["ema20", "ema50"]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const bottomPad = Platform.OS === "web" ? 100 : insets.bottom + 80;

  const tf = TIMEFRAMES[tfIdx]!;
  const candlesQ = useQuery({
    queryKey: ["candles", symbol, tf.interval, tf.range],
    queryFn: () => getCandles(symbol, tf.interval as Interval, tf.range as Range),
    refetchInterval: 30_000,
  });

  const candles = candlesQ.data?.candles ?? [];
  const closes = candles.map((c) => c.c);

  const overlayLines = useMemo(() => {
    const o: { values: (number | null)[]; color: string; width?: number }[] = [];
    if (overlays.includes("ema20")) o.push({ values: ema(closes, 20), color: "#60a5fa", width: 1.2 });
    if (overlays.includes("ema50")) o.push({ values: ema(closes, 50), color: "#d4af37", width: 1.4 });
    if (overlays.includes("ema200")) o.push({ values: ema(closes, 200), color: "#a78bfa", width: 1.4 });
    if (overlays.includes("bb")) {
      const bb = bollinger(closes, 20, 2);
      o.push({ values: bb.upper, color: "#7a8499", width: 1 });
      o.push({ values: bb.middle, color: "#7a8499", width: 0.8 });
      o.push({ values: bb.lower, color: "#7a8499", width: 1 });
    }
    return o;
  }, [closes, overlays]);

  const rsiVals = useMemo(() => rsi(closes, 14), [closes]);
  const lastRsi = rsiVals[rsiVals.length - 1];

  const piv = useMemo(() => {
    if (candles.length < 24) return null;
    const slice = candles.slice(-Math.max(24, Math.floor(candles.length / 4)), candles.length);
    let h = -Infinity, l = Infinity, c = 0;
    for (const k of slice) {
      if (k.h > h) h = k.h;
      if (k.l < l) l = k.l;
      c = k.c;
    }
    return pivotPoints({ t: 0, o: 0, h, l, c, v: 0 });
  }, [candles]);

  const chartW = Math.min(width - 32, 720);
  const chartH = 280;

  function toggleOverlay(id: string) {
    setOverlays((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Charts" subtitle={`${symbol} · ${tf.label}`} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 12 }}
      >
        {/* Symbol picker */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
          <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 4 }}>
            {WATCHLIST.map((s) => {
              const active = s === symbol;
              return (
                <Pressable
                  key={s}
                  onPress={() => setSymbol(s)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? colors.gold : colors.card,
                      borderColor: active ? colors.gold : colors.border,
                      borderRadius: radius - 4,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? colors.primaryForeground : colors.foreground,
                      fontFamily: active ? "Inter_700Bold" : "Inter_500Medium",
                      fontSize: 12,
                    }}
                  >
                    {s}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* Timeframes */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
          <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 4 }}>
            {TIMEFRAMES.map((t, i) => {
              const active = i === tfIdx;
              return (
                <Pressable
                  key={t.label}
                  onPress={() => setTfIdx(i)}
                  style={[
                    styles.tfChip,
                    {
                      backgroundColor: active ? colors.cardElevated : "transparent",
                      borderColor: active ? colors.gold : colors.border,
                      borderRadius: radius - 6,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? colors.gold : colors.mutedForeground,
                      fontFamily: active ? "Inter_700Bold" : "Inter_500Medium",
                      fontSize: 11,
                    }}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* Overlays */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {OVERLAYS.map((o) => {
            const active = overlays.includes(o.id);
            return (
              <Pressable
                key={o.id}
                onPress={() => toggleOverlay(o.id)}
                style={[
                  styles.overlayChip,
                  {
                    backgroundColor: active ? colors.cardElevated : "transparent",
                    borderColor: active ? colors.gold : colors.border,
                    borderRadius: radius - 6,
                  },
                ]}
              >
                <Feather
                  name={active ? "check" : "plus"}
                  size={11}
                  color={active ? colors.gold : colors.mutedForeground}
                />
                <Text
                  style={{
                    color: active ? colors.gold : colors.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 11,
                  }}
                >
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Chart */}
        <Card style={{ paddingHorizontal: 4, paddingVertical: 10 }}>
          {candlesQ.isLoading ? (
            <View style={{ height: chartH, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={colors.gold} />
            </View>
          ) : candlesQ.isError ? (
            <View style={{ height: chartH, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: colors.bearish }}>Failed to load chart</Text>
            </View>
          ) : (
            <PriceChart
              candles={candles.slice(-120)}
              width={chartW}
              height={chartH}
              overlay={overlayLines.map((o) => ({
                ...o,
                values: o.values.slice(-120),
              }))}
            />
          )}
        </Card>

        {/* RSI subchart */}
        <Card style={{ paddingHorizontal: 4, paddingVertical: 10 }}>
          <View style={{ paddingHorizontal: 12, marginBottom: 4 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.6 }}>
              RSI(14) · {lastRsi != null ? lastRsi.toFixed(1) : "—"}
            </Text>
          </View>
          <RsiSparkline values={rsiVals.slice(-120)} width={chartW} height={70} />
        </Card>

        {/* Pivots */}
        {piv && (
          <Card>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Floor Pivots (last 24 bars)
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10, gap: 8 }}>
              {([
                ["R3", piv.r3, colors.bullish],
                ["R2", piv.r2, colors.bullish],
                ["R1", piv.r1, colors.bullish],
                ["PP", piv.pp, colors.gold],
                ["S1", piv.s1, colors.bearish],
                ["S2", piv.s2, colors.bearish],
                ["S3", piv.s3, colors.bearish],
              ] as const).map(([label, val, c]) => (
                <View
                  key={label}
                  style={[
                    styles.pivotItem,
                    { borderColor: colors.border, borderRadius: radius - 6 },
                  ]}
                >
                  <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_600SemiBold" }}>
                    {label}
                  </Text>
                  <Text style={{ color: c, fontSize: 13, fontFamily: "Inter_700Bold", marginTop: 2 }}>
                    {val.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function RsiSparkline({ values, width, height }: { values: (number | null)[]; width: number; height: number }) {
  const colors = useColors();
  const padL = 6;
  const padR = 6;
  const innerW = width - padL - padR;
  const innerH = height - 12;
  const yOf = (v: number) => 6 + innerH - (v / 100) * innerH;
  const xStep = innerW / Math.max(1, values.length);
  let d = "";
  let started = false;
  values.forEach((v, i) => {
    if (v == null) {
      started = false;
      return;
    }
    const x = padL + i * xStep;
    const y = yOf(v);
    if (!started) {
      d += `M ${x} ${y}`;
      started = true;
    } else {
      d += ` L ${x} ${y}`;
    }
  });
  return (
    <View>
      <View style={{ position: "absolute", top: 6, left: 0, right: 0, height: innerH }}>
        <View style={{ position: "absolute", top: (innerH * 30) / 100, left: padL, right: padR, height: 1, backgroundColor: colors.border }} />
        <View style={{ position: "absolute", top: (innerH * 70) / 100, left: padL, right: padR, height: 1, backgroundColor: colors.border }} />
      </View>
      <RsiSvg d={d} width={width} height={height} color={colors.gold} />
    </View>
  );
}

import Svg, { Path as SvgPath } from "react-native-svg";

function RsiSvg({ d, width, height, color }: { d: string; width: number; height: number; color: string }) {
  return (
    <Svg width={width} height={height}>
      <SvgPath d={d} stroke={color} strokeWidth={1.4} fill="none" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tfChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 42,
    alignItems: "center",
  },
  overlayChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardTitle: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  pivotItem: {
    minWidth: 70,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
});
