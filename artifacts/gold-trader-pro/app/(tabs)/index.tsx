import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/Header";
import { PriceTicker } from "@/components/PriceTicker";
import { Card } from "@/components/Card";
import { StatPill } from "@/components/StatPill";
import { SparkLine } from "@/components/SparkLine";
import { useColors, useRadius } from "@/hooks/useColors";
import { useMarket } from "@/context/MarketContext";
import { getMulti, getQuote, getCandles, WATCHLIST } from "@/lib/marketData";
import { ema, rsi, macd, atr } from "@/lib/indicators";
import { STRATEGIES } from "@/lib/strategies";

export default function MarketsScreen() {
  const colors = useColors();
  const radius = useRadius();
  const router = useRouter();
  const { setSymbol } = useMarket();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 100 : insets.bottom + 80;

  const goldQuote = useQuery({
    queryKey: ["quote", "XAUUSD"],
    queryFn: () => getQuote("XAUUSD"),
    refetchInterval: 30_000,
  });

  const goldCandles = useQuery({
    queryKey: ["candles", "XAUUSD", "15m", "5d"],
    queryFn: () => getCandles("XAUUSD", "15m", "5d"),
    refetchInterval: 60_000,
  });

  const multi = useQuery({
    queryKey: ["multi", WATCHLIST.join(",")],
    queryFn: () => getMulti(WATCHLIST),
    refetchInterval: 60_000,
  });

  const refreshing =
    goldQuote.isFetching || goldCandles.isFetching || multi.isFetching;

  const onRefresh = () => {
    goldQuote.refetch();
    goldCandles.refetch();
    multi.refetch();
  };

  // Live indicator readouts
  const closes = goldCandles.data?.candles.map((c) => c.c) ?? [];
  const e50 = ema(closes, 50);
  const e200 = ema(closes, 200);
  const r14 = rsi(closes, 14);
  const m = macd(closes);
  const a14 = atr(goldCandles.data?.candles ?? [], 14);
  const last = closes.length - 1;
  const trend =
    e50[last] != null && e200[last] != null
      ? (e50[last] as number) > (e200[last] as number)
        ? "Uptrend"
        : "Downtrend"
      : "—";
  const trendTone = trend === "Uptrend" ? "bull" : trend === "Downtrend" ? "bear" : "neutral";
  const rsiVal = r14[last];
  const macdVal = m.hist[last];
  const atrVal = a14[last];

  // Mini AI score
  const aiSig = STRATEGIES.find((s) => s.id === "ai-ensemble");
  const aiResult = aiSig && goldCandles.data ? aiSig.run(goldCandles.data.candles) : null;
  const lastAi = aiResult?.signals[aiResult.signals.length - 1];

  const goldSpark = closes.slice(-40);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Gold Trader Pro"
        subtitle="Markets · XAUUSD · live"
        right={
          <View style={[styles.statusDot, { backgroundColor: colors.bullish }]} />
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        {/* Hero gold panel */}
        <LinearGradient
          colors={["#1a1505", "#2a2008", "#13182966"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.hero,
            { borderColor: "#3a2f10", borderRadius: radius },
          ]}
        >
          <View style={styles.heroRow}>
            <View>
              <Text style={[styles.heroSub, { color: colors.gold }]}>XAU/USD · GOLD SPOT</Text>
              <Text style={[styles.heroPrice, { color: colors.foreground }]}>
                {goldQuote.data ? `$${goldQuote.data.price.toFixed(2)}` : "—"}
              </Text>
              {goldQuote.data ? (
                <View style={styles.heroChange}>
                  <Feather
                    name={goldQuote.data.change >= 0 ? "arrow-up-right" : "arrow-down-right"}
                    size={14}
                    color={goldQuote.data.change >= 0 ? colors.bullish : colors.bearish}
                  />
                  <Text
                    style={[
                      styles.heroChangeText,
                      {
                        color:
                          goldQuote.data.change >= 0 ? colors.bullish : colors.bearish,
                      },
                    ]}
                  >
                    {goldQuote.data.change >= 0 ? "+" : ""}
                    {goldQuote.data.change.toFixed(2)} (
                    {goldQuote.data.changePct.toFixed(2)}%)
                  </Text>
                </View>
              ) : null}
            </View>
            {goldSpark.length > 1 ? (
              <SparkLine
                values={goldSpark}
                width={120}
                height={56}
                color={colors.gold}
                strokeWidth={1.8}
              />
            ) : (
              <ActivityIndicator color={colors.gold} />
            )}
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatLabel, { color: colors.mutedForeground }]}>OPEN</Text>
              <Text style={[styles.heroStatVal, { color: colors.foreground }]}>
                {goldQuote.data ? goldQuote.data.open.toFixed(2) : "—"}
              </Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatLabel, { color: colors.mutedForeground }]}>HIGH</Text>
              <Text style={[styles.heroStatVal, { color: colors.bullish }]}>
                {goldQuote.data ? goldQuote.data.high.toFixed(2) : "—"}
              </Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatLabel, { color: colors.mutedForeground }]}>LOW</Text>
              <Text style={[styles.heroStatVal, { color: colors.bearish }]}>
                {goldQuote.data ? goldQuote.data.low.toFixed(2) : "—"}
              </Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatLabel, { color: colors.mutedForeground }]}>STATE</Text>
              <Text style={[styles.heroStatVal, { color: colors.gold }]}>
                {goldQuote.data?.marketState ?? "—"}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Live indicator readout */}
        <View style={styles.statRow}>
          <StatPill
            label="Trend"
            value={trend}
            tone={trendTone as "bull" | "bear" | "neutral"}
          />
          <StatPill
            label="RSI 14"
            value={rsiVal != null ? rsiVal.toFixed(1) : "—"}
            tone={
              rsiVal == null
                ? "neutral"
                : rsiVal > 70
                ? "bear"
                : rsiVal < 30
                ? "bull"
                : "neutral"
            }
          />
          <StatPill
            label="MACD H"
            value={macdVal != null ? macdVal.toFixed(2) : "—"}
            tone={macdVal == null ? "neutral" : macdVal > 0 ? "bull" : "bear"}
          />
          <StatPill label="ATR" value={atrVal != null ? atrVal.toFixed(2) : "—"} tone="gold" />
        </View>

        {/* AI quick signal */}
        <Card>
          <View style={styles.cardHeader}>
            <View style={styles.row}>
              <Feather name="zap" size={14} color={colors.gold} />
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                AI Ensemble Signal
              </Text>
            </View>
            <Pressable onPress={() => router.push("/signals")}>
              <Text style={[styles.linkText, { color: colors.gold }]}>Open →</Text>
            </Pressable>
          </View>
          {lastAi ? (
            <View style={{ marginTop: 10, gap: 6 }}>
              <View style={styles.row}>
                <View
                  style={[
                    styles.sideTag,
                    {
                      backgroundColor:
                        lastAi.side === "LONG" ? colors.bullish : colors.bearish,
                      borderRadius: 6,
                    },
                  ]}
                >
                  <Text style={styles.sideTagText}>{lastAi.side}</Text>
                </View>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16 }}>
                  ${lastAi.price.toFixed(2)}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_500Medium" }}>
                  {new Date(lastAi.time).toLocaleString()}
                </Text>
              </View>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" }}>
                {lastAi.reason}
              </Text>
            </View>
          ) : (
            <Text style={{ color: colors.mutedForeground, marginTop: 8 }}>
              No active signal — waiting for confirmation.
            </Text>
          )}
        </Card>

        {/* Watchlist */}
        <View style={styles.cardHeaderInline}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Watchlist</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_500Medium" }}>
            Tap to load chart
          </Text>
        </View>

        {multi.data?.items.map((item) => (
          <Pressable
            key={item.symbol}
            onPress={() => {
              setSymbol(item.symbol);
              router.push("/charts");
            }}
          >
            <PriceTicker
              symbol={item.symbol}
              price={item.price}
              change={item.change}
              changePct={item.changePct}
              sparkline={item.sparkline}
            />
          </Pressable>
        )) ?? (
          <Card>
            <ActivityIndicator color={colors.gold} />
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  hero: {
    padding: 18,
    borderWidth: 1,
    gap: 14,
  },
  heroRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  heroSub: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1.5 },
  heroPrice: { fontSize: 38, fontFamily: "Inter_700Bold", marginTop: 6, letterSpacing: -1 },
  heroChange: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  heroChangeText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  heroStats: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  heroStat: { gap: 2 },
  heroStatLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  heroStatVal: { fontSize: 13, fontFamily: "Inter_700Bold" },
  statRow: { flexDirection: "row", gap: 8 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardHeaderInline: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    marginBottom: -4,
  },
  cardTitle: { fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  linkText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  sideTag: { paddingHorizontal: 8, paddingVertical: 3 },
  sideTagText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
});
