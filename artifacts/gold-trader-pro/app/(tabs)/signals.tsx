import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/Header";
import { Card } from "@/components/Card";
import { AnalysisCard } from "@/components/AnalysisCard";
import { useColors, useRadius } from "@/hooks/useColors";
import { useMarket } from "@/context/MarketContext";
import { useT, useSettings } from "@/context/SettingsContext";
import { getCandles, type Interval, type Range } from "@/lib/marketData";
import { STRATEGIES } from "@/lib/strategies";
import { ema, rsi, macd, atr, bollinger, stochastic } from "@/lib/indicators";
import { runAdvancedAnalysis } from "@/lib/advancedAnalysis";

export default function SignalsScreen() {
  const colors = useColors();
  const radius = useRadius();
  const { symbol } = useMarket();
  const { t, isRTL, lang } = useT();
  const { settings } = useSettings();
  const dirAlign: "left" | "right" = isRTL ? "right" : "left";
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 100 : insets.bottom + 80;

  const candlesQ = useQuery({
    queryKey: ["candles", symbol, "60m" as Interval, "3mo" as Range],
    queryFn: () => getCandles(symbol, "60m", "3mo"),
    refetchInterval: 60_000,
  });

  const candles = candlesQ.data?.candles ?? [];
  const closes = candles.map((c) => c.c);

  const advanced = useMemo(() => {
    if (candles.length < 200 || !settings.enableAiAnalysis) return null;
    return runAdvancedAnalysis(candles, settings, lang);
  }, [candles, settings, lang]);

  const score = useMemo(() => {
    if (candles.length < 200) return null;
    const e20 = ema(closes, 20);
    const e50 = ema(closes, 50);
    const e200 = ema(closes, 200);
    const r = rsi(closes, 14);
    const m = macd(closes);
    const bb = bollinger(closes, 20, 2);
    const a = atr(candles, 14);
    const st = stochastic(candles, 14, 3);
    const i = candles.length - 1;
    const c = candles[i]!;
    const v20 = e20[i]!;
    const v50 = e50[i]!;
    const v200 = e200[i]!;
    const rv = r[i]!;
    const mv = m.macd[i]!;
    const sv = m.signal[i]!;
    const bu = bb.upper[i]!;
    const bl = bb.lower[i]!;
    const av = a[i]!;
    const kv = st.k[i]!;

    const components = [
      { label: "Trend (EMA20>50)", value: v20 > v50, weight: 20, isBull: v20 > v50 },
      { label: "Bias (EMA50>200)", value: v50 > v200, weight: 15, isBull: v50 > v200 },
      { label: "Momentum (RSI>50)", value: rv > 50, weight: 10, isBull: rv > 50, raw: rv.toFixed(1) },
      { label: "MACD > Signal", value: mv > sv, weight: 15, isBull: mv > sv },
      { label: "BB position", value: (c.c - bl) / (bu - bl), weight: 20, isBull: (c.c - bl) / (bu - bl) < 0.4, raw: (((c.c - bl) / (bu - bl)) * 100).toFixed(0) + "%" },
      { label: "Volatility (ATR)", value: av, weight: 5, isBull: av < c.c * 0.005, raw: av.toFixed(2) },
      { label: "Stochastic K", value: kv, weight: 15, isBull: kv > 50 && kv < 80, raw: kv.toFixed(0) },
    ];
    let total = 0;
    components.forEach((cp) => {
      if (cp.label.includes("BB position")) {
        const pos = cp.value as number;
        if (pos < 0.2) total += 20;
        else if (pos > 0.8) total -= 20;
      } else if (cp.label.includes("Volatility")) {
        total += (cp.isBull ? 1 : -1) * 5;
      } else if (cp.label.includes("Stochastic")) {
        if (kv < 25) total += 15;
        else if (kv > 75) total -= 15;
      } else {
        total += (cp.isBull ? 1 : -1) * cp.weight;
      }
    });
    return { total, components, lastPrice: c.c };
  }, [candles, closes]);

  const allSignals = useMemo(() => {
    if (candles.length < 100) return [];
    const out: { strategy: string; side: "LONG" | "SHORT"; price: number; time: number; reason: string }[] = [];
    for (const s of STRATEGIES) {
      const r = s.run(candles);
      const last = r.signals[r.signals.length - 1];
      if (last) {
        out.push({
          strategy: s.name,
          side: last.side as "LONG" | "SHORT",
          price: last.price,
          time: last.time,
          reason: last.reason,
        });
      }
    }
    return out.sort((a, b) => b.time - a.time);
  }, [candles]);

  const consensus = useMemo(() => {
    let long = 0;
    let short = 0;
    for (const s of allSignals) {
      if (s.side === "LONG") long++;
      else short++;
    }
    return { long, short, total: allSignals.length };
  }, [allSignals]);

  const scoreLabel =
    score == null
      ? "—"
      : score.total >= 50
      ? t("strong_buy")
      : score.total >= 20
      ? t("buy")
      : score.total <= -50
      ? t("strong_sell")
      : score.total <= -20
      ? t("sell")
      : t("neutral");

  const scoreTone =
    score == null
      ? colors.mutedForeground
      : score.total > 0
      ? colors.bullish
      : score.total < 0
      ? colors.bearish
      : colors.gold;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t("signals_title")} subtitle={`${symbol} · 1H · multi-strategy`} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 12 }}>
        {/* Advanced AI analysis (top priority) */}
        {advanced && <AnalysisCard analysis={advanced} symbol={symbol} />}

        {/* AI Score panel */}
        <LinearGradient
          colors={["#1a1505", "#13182966"]}
          style={[styles.hero, { borderColor: "#3a2f10", borderRadius: radius }]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Text style={[styles.heroSub, { color: colors.gold, textAlign: dirAlign }]}>{t("ai_score")}</Text>
              <Text style={[styles.heroBig, { color: scoreTone }]}>
                {score ? (score.total >= 0 ? "+" : "") + score.total : "—"}
              </Text>
              <Text style={[styles.heroLabel, { color: scoreTone }]}>{scoreLabel}</Text>
            </View>
            {candlesQ.isLoading ? <ActivityIndicator color={colors.gold} /> : <ScoreGauge score={score?.total ?? 0} />}
          </View>
          {score && (
            <View style={{ marginTop: 14, gap: 6 }}>
              {score.components.map((cp, i) => (
                <View key={i} style={styles.compRow}>
                  <Feather
                    name={cp.isBull ? "check-circle" : "x-circle"}
                    size={12}
                    color={cp.isBull ? colors.bullish : colors.bearish}
                  />
                  <Text style={{ color: colors.foreground, fontSize: 12, flex: 1, fontFamily: "Inter_500Medium" }}>
                    {cp.label}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>
                    {cp.raw ?? (cp.isBull ? "Bullish" : "Bearish")}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </LinearGradient>

        {/* Consensus */}
        <Card>
          <Text style={[styles.title, { color: colors.foreground, marginBottom: 8, textAlign: dirAlign }]}>
            {t("strategy_consensus")}
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View
              style={[
                styles.consensusBox,
                { backgroundColor: colors.cardElevated, borderColor: colors.bullish, borderRadius: radius - 4 },
              ]}
            >
              <Feather name="trending-up" size={16} color={colors.bullish} />
              <Text style={[styles.consensusBig, { color: colors.bullish }]}>
                {consensus.long}
              </Text>
              <Text style={[styles.consensusLabel, { color: colors.mutedForeground }]}>{t("long_label")}</Text>
            </View>
            <View
              style={[
                styles.consensusBox,
                { backgroundColor: colors.cardElevated, borderColor: colors.bearish, borderRadius: radius - 4 },
              ]}
            >
              <Feather name="trending-down" size={16} color={colors.bearish} />
              <Text style={[styles.consensusBig, { color: colors.bearish }]}>
                {consensus.short}
              </Text>
              <Text style={[styles.consensusLabel, { color: colors.mutedForeground }]}>{t("short_label")}</Text>
            </View>
            <View
              style={[
                styles.consensusBox,
                { backgroundColor: colors.cardElevated, borderColor: colors.gold, borderRadius: radius - 4 },
              ]}
            >
              <Feather name="layers" size={16} color={colors.gold} />
              <Text style={[styles.consensusBig, { color: colors.gold }]}>
                {consensus.total}
              </Text>
              <Text style={[styles.consensusLabel, { color: colors.mutedForeground }]}>{t("signals_count")}</Text>
            </View>
          </View>
        </Card>

        {/* Per-strategy latest signal */}
        <Card>
          <Text style={[styles.title, { color: colors.foreground, marginBottom: 8, textAlign: dirAlign }]}>
            {t("latest_by_strategy")}
          </Text>
          {allSignals.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, marginTop: 6, textAlign: dirAlign }}>
              {candlesQ.isLoading ? t("loading") : t("no_signals")}
            </Text>
          ) : (
            allSignals.map((s, i) => (
              <View
                key={i}
                style={[
                  styles.sigRow,
                  {
                    borderBottomColor: colors.border,
                    borderBottomWidth: i === allSignals.length - 1 ? 0 : StyleSheet.hairlineWidth,
                  },
                ]}
              >
                <View
                  style={[
                    styles.sideTag,
                    {
                      backgroundColor: s.side === "LONG" ? colors.bullish : colors.bearish,
                      borderRadius: 5,
                    },
                  ]}
                >
                  <Text style={styles.sideTagText}>{s.side}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_700Bold" }}>
                    {s.strategy}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular" }}>
                    {s.reason}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_700Bold" }}>
                    ${s.price.toFixed(2)}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_500Medium" }}>
                    {new Date(s.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

import Svg, { Circle, G } from "react-native-svg";

function ScoreGauge({ score }: { score: number }) {
  const colors = useColors();
  const size = 90;
  const r = 38;
  const c = 2 * Math.PI * r;
  const pct = Math.max(-100, Math.min(100, score)) / 100;
  const fillColor = score > 0 ? colors.bullish : score < 0 ? colors.bearish : colors.gold;
  const offset = c * (1 - Math.abs(pct));
  return (
    <Svg width={size} height={size}>
      <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#2a2008" strokeWidth={6} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={fillColor}
          strokeWidth={6}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  hero: { padding: 18, borderWidth: 1 },
  heroSub: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1.5 },
  heroBig: { fontSize: 44, fontFamily: "Inter_700Bold", marginTop: 6, letterSpacing: -1 },
  heroLabel: { fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  compRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  title: { fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  consensusBox: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  consensusBig: { fontSize: 24, fontFamily: "Inter_700Bold" },
  consensusLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.6 },
  sigRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  sideTag: { paddingHorizontal: 8, paddingVertical: 3 },
  sideTagText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.4 },
});
