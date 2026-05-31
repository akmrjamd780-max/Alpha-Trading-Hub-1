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
import { LinearGradient } from "expo-linear-gradient";

import { ScreenHeader } from "@/components/Header";
import { TradingViewChart, type TVFVG, type TVMarker, type TVHLine } from "@/components/TradingViewChart";
import { Card } from "@/components/Card";
import { useColors, useRadius } from "@/hooks/useColors";
import { useMarket } from "@/context/MarketContext";
import { useT, useSettings } from "@/context/SettingsContext";
import {
  getCandles,
  TIMEFRAMES,
  WATCHLIST,
  type Interval,
  type Range,
} from "@/lib/marketData";
import { ema, rsi, bollinger, pivotPoints } from "@/lib/indicators";
import { runAIAnalysis } from "@/lib/aiAnalysis";
import type { QFAResult } from "@/lib/quantumFlow";

const OVERLAY_KEYS = ["ema20", "ema50", "ema200", "bb", "fvg", "fib", "warzone", "swings", "signals"] as const;
type OverlayKey = (typeof OVERLAY_KEYS)[number];

export default function ChartsScreen() {
  const colors = useColors();
  const radius = useRadius();
  const { symbol, setSymbol } = useMarket();
  const { t, lang, isRTL } = useT();
  const { settings } = useSettings();
  const [tfIdx, setTfIdx] = useState(2);
  const [overlays, setOverlays] = useState<OverlayKey[]>([
    "ema20",
    "ema50",
    "fvg",
    "signals",
  ]);
  const [analysis, setAnalysis] = useState<QFAResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
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

  const fvgOverlay: TVFVG[] = useMemo(() => {
    if (!analysis || !overlays.includes("fvg")) return [];
    return analysis.fvgZones.map((z) => ({
      startIdx: z.botIdx,
      endIdx: z.topIdx,
      high: z.high,
      low: z.low,
      side: z.side,
      filled: z.filled,
    }));
  }, [analysis, overlays]);

  const fibOverlay = useMemo(() => {
    if (!analysis || !overlays.includes("fib") || !analysis.fib) return [];
    return Object.entries(analysis.fib.levels).map(([k, v]) => ({
      price: v,
      label: k,
      color: ["0.500", "0.618"].includes(k) ? colors.gold : colors.mutedForeground,
    }));
  }, [analysis, overlays, colors]);

  const warOverlay = analysis && overlays.includes("warzone") ? analysis.warZone : null;

  const signalMarkers: TVMarker[] = useMemo(() => {
    if (!overlays.includes("signals") || !analysis) return [];
    if (analysis.signal === "NEUTRAL" || analysis.signal === "WAIT" || analysis.signal === "INVALID" || analysis.signal === "HIGH_RISK") return [];
    const isBuy = analysis.signal === "BUY" || analysis.signal === "PENDING_BUY";
    return [
      {
        index: candles.length - 1,
        side: isBuy ? "BUY" : "SELL",
        label: analysis.signal,
        price: analysis.entryPrice,
      },
    ];
  }, [analysis, candles.length, overlays]);

  const hLines: TVHLine[] = useMemo(() => {
    if (!analysis || analysis.signal === "NEUTRAL" || analysis.signal === "WAIT" || analysis.signal === "INVALID" || analysis.signal === "HIGH_RISK") return [];
    return [
      { price: analysis.entryPrice, color: colors.gold, label: "Entry" },
      { price: analysis.stopLoss, color: colors.bearish, label: "SL", dashed: true },
      { price: analysis.takeProfit1, color: colors.bullish, label: "TP1", dashed: true },
      { price: analysis.takeProfit2, color: colors.bullish, label: "TP2", dashed: true },
    ];
  }, [analysis, colors]);

  const rsiVals = useMemo(() => rsi(closes, 14), [closes]);
  const lastRsi = rsiVals[rsiVals.length - 1];

  const piv = useMemo(() => {
    if (candles.length < 24) return null;
    const slice = candles.slice(-Math.max(24, Math.floor(candles.length / 4)));
    let h = -Infinity, l = Infinity, c = 0;
    for (const k of slice) {
      if (k.h > h) h = k.h;
      if (k.l < l) l = k.l;
      c = k.c;
    }
    return pivotPoints({ t: 0, o: 0, h, l, c, v: 0 });
  }, [candles]);

  const chartW = Math.min(width - 32, 720);
  const chartH = 320;

  function toggleOverlay(id: OverlayKey) {
    setOverlays((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  async function handleAnalyze() {
    if (candles.length < 60) return;
    setAnalyzing(true);
    try {
      // run on next tick to allow spinner render
      await new Promise((r) => setTimeout(r, 30));
      const res = runAIAnalysis(candles, settings, lang);
      setAnalysis(res);
      // auto-enable visualisation overlays on first run
      const next = new Set(overlays);
      next.add("fvg");
      next.add("fib");
      next.add("signals");
      next.add("warzone");
      setOverlays(Array.from(next) as OverlayKey[]);
    } finally {
      setAnalyzing(false);
    }
  }

  const dirAlign = isRTL ? "right" : "left";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t("chart_title")} subtitle={`${symbol} · ${tf.label} · ${t("drag_to_pan")}`} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 12 }}>
        {/* Symbol picker */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
          <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 4 }}>
            {WATCHLIST.map((s) => {
              const active = s === symbol;
              return (
                <Pressable
                  key={s}
                  onPress={() => {
                    setSymbol(s);
                    setAnalysis(null);
                  }}
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
            {TIMEFRAMES.map((tt, i) => {
              const active = i === tfIdx;
              return (
                <Pressable
                  key={tt.label}
                  onPress={() => {
                    setTfIdx(i);
                    setAnalysis(null);
                  }}
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
                    {tt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* Overlay chips */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {([
            ["ema20", t("ema20")],
            ["ema50", t("ema50")],
            ["ema200", t("ema200")],
            ["bb", t("bollinger")],
            ["fvg", t("fvg_overlay")],
            ["fib", t("fib_overlay")],
            ["warzone", t("war_zone_overlay")],
            ["swings", t("swing_overlay")],
            ["signals", t("signals_overlay")],
          ] as const).map(([id, label]) => {
            const active = overlays.includes(id as OverlayKey);
            return (
              <Pressable
                key={id}
                onPress={() => toggleOverlay(id as OverlayKey)}
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
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* AI Analyze button */}
        <Pressable onPress={handleAnalyze} disabled={analyzing || candles.length < 60}>
          <LinearGradient
            colors={["#d4af37", "#b8860b"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.analyzeBtn, { borderRadius: radius - 4, opacity: analyzing ? 0.7 : 1 }]}
          >
            {analyzing ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Feather name="cpu" size={16} color={colors.background} />
            )}
            <Text style={{ color: colors.background, fontFamily: "Inter_700Bold", fontSize: 14, letterSpacing: 0.4 }}>
              {analyzing ? t("analyzing") : t("ai_analyze")}
            </Text>
          </LinearGradient>
        </Pressable>

        {/* Chart */}
        <Card style={{ paddingHorizontal: 4, paddingVertical: 10 }}>
          {candlesQ.isLoading ? (
            <View style={{ height: chartH, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={colors.gold} />
            </View>
          ) : candlesQ.isError ? (
            <View style={{ height: chartH, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: colors.bearish }}>{String(candlesQ.error?.message ?? "Failed")}</Text>
            </View>
          ) : (
            <TradingViewChart
              candles={candles}
              width={chartW}
              height={chartH}
              overlays={overlayLines}
              markers={signalMarkers}
              fvgZones={fvgOverlay}
              warZone={warOverlay}
              fibLevels={fibOverlay}
              hLines={hLines}
              isDark={colors.background === "#0a0a0a"}
            />
          )}
        </Card>

        {/* Analysis result panel */}
        {analysis && (
          <Card>
            <View style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <View
                style={[
                  styles.bigSig,
                  {
                    backgroundColor:
                      analysis.signal === "BUY" || analysis.signal === "PENDING_BUY"
                        ? colors.bullish
                        : analysis.signal === "SELL" || analysis.signal === "PENDING_SELL"
                        ? colors.bearish
                        : analysis.signal === "HIGH_RISK"
                        ? colors.bearish
                        : colors.muted,
                    borderRadius: radius - 6,
                  },
                ]}
              >
                <Text style={styles.bigSigText}>
                  {analysis.signal === "BUY"
                    ? t("signal_buy")
                    : analysis.signal === "SELL"
                    ? t("signal_sell")
                    : analysis.signal === "PENDING_BUY"
                    ? t("pending_buy")
                    : analysis.signal === "PENDING_SELL"
                    ? t("pending_sell")
                    : analysis.signal === "WAIT"
                    ? t("wait")
                    : analysis.signal === "INVALID"
                    ? t("invalid")
                    : analysis.signal === "HIGH_RISK"
                    ? t("high_risk")
                    : t("signal_neutral")}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.foreground, textAlign: dirAlign }]}>
                  {t("analysis_result")}
                </Text>
                <Text style={{ color: colors.gold, fontSize: 13, fontFamily: "Inter_700Bold", textAlign: dirAlign }}>
                  {t("confidence")}: {analysis.confidence}%
                </Text>
              </View>
            </View>

            {analysis.signal !== "NEUTRAL" && analysis.signal !== "WAIT" && analysis.signal !== "INVALID" && analysis.signal !== "HIGH_RISK" && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10, gap: 8 }}>
                <Stat label={t("entry_price")} value={analysis.entryPrice.toFixed(2)} color={colors.foreground} />
                <Stat label={t("stop_loss")} value={analysis.stopLoss.toFixed(2)} color={colors.bearish} />
                <Stat label={t("take_profit_1")} value={analysis.takeProfit1.toFixed(2)} color={colors.bullish} />
                <Stat label={t("take_profit_2")} value={analysis.takeProfit2.toFixed(2)} color={colors.bullish} />
              </View>
            )}

            {analysis.activeTriggers.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.subTitle, { color: colors.mutedForeground, textAlign: dirAlign }]}>
                  {t("active_triggers")}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {analysis.activeTriggers.map((tg, i) => (
                    <View key={i} style={[styles.tag, { borderColor: colors.gold, borderRadius: radius - 6 }]}>
                      <Text style={{ color: colors.gold, fontSize: 10, fontFamily: "Inter_700Bold" }}>{tg}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {analysis.explainability.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.subTitle, { color: colors.mutedForeground, textAlign: dirAlign }]}>
                  {t("explainability")}
                </Text>
                {analysis.explainability.map((e, i) => (
                  <View key={i} style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row", marginTop: 4 }]}>
                    <Feather name="check-circle" size={11} color={colors.bullish} />
                    <Text
                      style={{
                        color: colors.foreground,
                        fontSize: 12,
                        fontFamily: "Inter_500Medium",
                        textAlign: dirAlign,
                        writingDirection: isRTL ? "rtl" : "ltr",
                        flex: 1,
                      }}
                    >
                      {e}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {analysis.warningFlags.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.subTitle, { color: colors.bearish, textAlign: dirAlign }]}>
                  {t("warning_flags")}
                </Text>
                {analysis.warningFlags.map((w, i) => (
                  <View key={i} style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row", marginTop: 4 }]}>
                    <Feather name="alert-triangle" size={11} color={colors.bearish} />
                    <Text
                      style={{
                        color: colors.foreground,
                        fontSize: 12,
                        fontFamily: "Inter_500Medium",
                        textAlign: dirAlign,
                        writingDirection: isRTL ? "rtl" : "ltr",
                        flex: 1,
                      }}
                    >
                      {w}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
              <Stat
                label={t("war_zone_active")}
                value={analysis.warZoneActive ? t("yes") : t("no")}
                color={analysis.warZoneActive ? colors.bearish : colors.bullish}
              />
              <Stat label="ADX" value={analysis.adx.toFixed(0)} color={colors.foreground} />
              <Stat label="ATR" value={analysis.atr.toFixed(2)} color={colors.gold} />
            </View>
          </Card>
        )}

        {/* RSI subchart */}
        <Card style={{ paddingHorizontal: 4, paddingVertical: 10 }}>
          <View style={{ paddingHorizontal: 12, marginBottom: 4 }}>
            <Text
              style={{
                color: colors.mutedForeground,
                fontSize: 11,
                fontFamily: "Inter_600SemiBold",
                letterSpacing: 0.6,
                textAlign: dirAlign,
              }}
            >
              RSI(14) · {lastRsi != null ? lastRsi.toFixed(1) : "—"}
            </Text>
          </View>
          <RsiSparkline values={rsiVals.slice(-120)} width={chartW} height={70} />
        </Card>

        {/* Pivots */}
        {piv && (
          <Card>
            <Text style={[styles.title, { color: colors.foreground, textAlign: dirAlign }]}>
              {t("pivots_title")}
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
                  style={[styles.pivotItem, { borderColor: colors.border, borderRadius: radius - 6 }]}
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

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  const colors = useColors();
  const radius = useRadius();
  return (
    <View
      style={[
        statStyles.root,
        { borderColor: colors.border, borderRadius: radius - 6, backgroundColor: colors.cardElevated },
      ]}
    >
      <Text style={{ color: colors.mutedForeground, fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase" }}>
        {label}
      </Text>
      <Text style={{ color, fontSize: 14, fontFamily: "Inter_700Bold", marginTop: 3 }}>{value}</Text>
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
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderWidth: StyleSheet.hairlineWidth },
  tfChip: { paddingHorizontal: 12, paddingVertical: 7, borderWidth: StyleSheet.hairlineWidth, minWidth: 42, alignItems: "center" },
  overlayChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  analyzeBtn: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  title: { fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  subTitle: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.7, textTransform: "uppercase" },
  row: { alignItems: "center", gap: 10 },
  bigSig: { paddingHorizontal: 14, paddingVertical: 10, alignItems: "center", justifyContent: "center", minWidth: 80 },
  bigSigText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  pivotItem: { minWidth: 70, paddingHorizontal: 12, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth, alignItems: "center" },
});

const statStyles = StyleSheet.create({
  root: { flex: 1, padding: 10, borderWidth: StyleSheet.hairlineWidth, minWidth: 80 },
});
