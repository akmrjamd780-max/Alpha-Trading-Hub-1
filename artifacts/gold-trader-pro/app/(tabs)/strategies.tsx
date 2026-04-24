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
import { Card } from "@/components/Card";
import { PriceChart } from "@/components/PriceChart";
import { useColors, useRadius } from "@/hooks/useColors";
import { useMarket } from "@/context/MarketContext";
import { getCandles, type Interval, type Range, TIMEFRAMES } from "@/lib/marketData";
import { STRATEGIES, type Strategy } from "@/lib/strategies";
import { backtest } from "@/lib/backtester";

export default function StrategiesScreen() {
  const colors = useColors();
  const radius = useRadius();
  const { symbol } = useMarket();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const bottomPad = Platform.OS === "web" ? 100 : insets.bottom + 80;
  const [selected, setSelected] = useState<Strategy>(STRATEGIES[0]!);
  const [tfIdx, setTfIdx] = useState(3); // 1H

  const tf = TIMEFRAMES[tfIdx]!;
  const candlesQ = useQuery({
    queryKey: ["candles", symbol, tf.interval, tf.range],
    queryFn: () => getCandles(symbol, tf.interval as Interval, tf.range as Range),
  });

  const candles = candlesQ.data?.candles ?? [];

  const result = useMemo(() => {
    if (candles.length < 50) return null;
    const r = selected.run(candles);
    const bt = backtest(selected, candles);
    return { ...r, bt };
  }, [selected, candles]);

  const chartW = Math.min(width - 32, 720);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Strategies" subtitle={`${symbol} · ${tf.label} · ${selected.name}`} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 12 }}>
        {/* Strategy list */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
          <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 4 }}>
            {STRATEGIES.map((s) => {
              const active = s.id === selected.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setSelected(s)}
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
                    {s.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* TF */}
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

        {/* Strategy detail */}
        <Card>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.foreground }]}>{selected.name}</Text>
              <Text style={[styles.origin, { color: colors.gold }]}>{selected.origin}</Text>
            </View>
            <View
              style={[
                styles.categoryTag,
                { backgroundColor: colors.cardElevated, borderRadius: 6 },
              ]}
            >
              <Text style={{ color: colors.gold, fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.6 }}>
                {selected.category.toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={[styles.desc, { color: colors.mutedForeground }]}>
            {selected.description}
          </Text>
          <View style={{ flexDirection: "row", gap: 16, marginTop: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>Default Risk</Text>
              <Text style={[styles.metaVal, { color: colors.foreground }]}>
                {selected.defaultRiskPct}% / trade
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>Default R:R</Text>
              <Text style={[styles.metaVal, { color: colors.foreground }]}>1:2</Text>
            </View>
          </View>
        </Card>

        {/* Chart with markers */}
        <Card style={{ paddingHorizontal: 4, paddingVertical: 10 }}>
          {candlesQ.isLoading ? (
            <View style={{ height: 240, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={colors.gold} />
            </View>
          ) : (
            <PriceChart
              candles={candles.slice(-100)}
              width={chartW}
              height={240}
              markers={
                result?.signals
                  .filter((s) => s.index >= candles.length - 100)
                  .map((s) => ({
                    index: s.index - (candles.length - 100),
                    side: s.side as "LONG" | "SHORT",
                  })) ?? []
              }
            />
          )}
        </Card>

        {/* Backtest results */}
        {result?.bt && (
          <Card>
            <Text style={[styles.title, { color: colors.foreground, marginBottom: 8 }]}>
              Backtest · {tf.label} · {symbol}
            </Text>
            <View style={styles.btGrid}>
              <BtStat label="Total Return" value={`${result.bt.totalReturnPct.toFixed(2)}%`} tone={result.bt.totalReturnPct >= 0 ? "bull" : "bear"} />
              <BtStat label="Win Rate" value={`${result.bt.winRate.toFixed(1)}%`} tone={result.bt.winRate >= 50 ? "bull" : "bear"} />
              <BtStat label="Trades" value={`${result.bt.trades.length}`} />
              <BtStat label="Profit Factor" value={result.bt.profitFactor === Infinity ? "∞" : result.bt.profitFactor.toFixed(2)} tone={result.bt.profitFactor >= 1 ? "bull" : "bear"} />
              <BtStat label="Max DD" value={`${result.bt.maxDrawdownPct.toFixed(2)}%`} tone="bear" />
              <BtStat label="Expectancy" value={`${result.bt.expectancyPct.toFixed(2)}%`} tone={result.bt.expectancyPct >= 0 ? "bull" : "bear"} />
              <BtStat label="Avg Win" value={`${result.bt.avgWinPct.toFixed(2)}%`} tone="bull" />
              <BtStat label="Avg Loss" value={`${result.bt.avgLossPct.toFixed(2)}%`} tone="bear" />
            </View>
          </Card>
        )}

        {/* Recent signals list */}
        {result && result.signals.length > 0 && (
          <Card>
            <Text style={[styles.title, { color: colors.foreground, marginBottom: 8 }]}>
              Recent Signals
            </Text>
            {result.signals.slice(-8).reverse().map((s, i) => (
              <View
                key={i}
                style={[
                  styles.sigRow,
                  {
                    borderBottomColor: colors.border,
                    borderBottomWidth: i === 7 ? 0 : StyleSheet.hairlineWidth,
                  },
                ]}
              >
                <View
                  style={[
                    styles.sideTag,
                    { backgroundColor: s.side === "LONG" ? colors.bullish : colors.bearish, borderRadius: 5 },
                  ]}
                >
                  <Text style={styles.sideTagText}>{s.side}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                    ${s.price.toFixed(2)}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 10 }}>
                    {new Date(s.time).toLocaleString()} · {s.reason}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function BtStat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "bull" | "bear" }) {
  const colors = useColors();
  const radius = useRadius();
  const c = tone === "bull" ? colors.bullish : tone === "bear" ? colors.bearish : colors.foreground;
  return (
    <View style={[btStyles.root, { borderColor: colors.border, borderRadius: radius - 6 }]}>
      <Text style={[btStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[btStyles.value, { color: c }]}>{value}</Text>
    </View>
  );
}

const btStyles = StyleSheet.create({
  root: { width: "47%", padding: 10, borderWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.6, textTransform: "uppercase" },
  value: { fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 4 },
});

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
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  origin: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  categoryTag: { paddingHorizontal: 8, paddingVertical: 4 },
  desc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, marginTop: 8 },
  metaLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#7a8499", letterSpacing: 0.6, textTransform: "uppercase" },
  metaVal: { fontSize: 14, fontFamily: "Inter_700Bold", marginTop: 4 },
  btGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between" },
  sigRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  sideTag: { paddingHorizontal: 8, paddingVertical: 3 },
  sideTagText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.4 },
});
