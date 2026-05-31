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
import { useT, useSettings } from "@/context/SettingsContext";
import { getMulti, getQuote, getCandles, WATCHLIST } from "@/lib/marketData";
import { ema, rsi, macd, atr } from "@/lib/indicators";
import { runAIAnalysis } from "@/lib/aiAnalysis";
import { runAdvancedAnalysis } from "@/lib/advancedAnalysis";

export default function MarketsScreen() {
  const colors = useColors();
  const radius = useRadius();
  const router = useRouter();
  const { setSymbol } = useMarket();
  const { t, lang, isRTL } = useT();
  const { settings } = useSettings();
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

  const refreshing = goldQuote.isFetching || goldCandles.isFetching || multi.isFetching;
  const onRefresh = () => {
    goldQuote.refetch();
    goldCandles.refetch();
    multi.refetch();
  };

  const closes = goldCandles.data?.candles.map((c) => c.c) ?? [];
  const e50 = ema(closes, 50);
  const e200 = ema(closes, 200);
  const r14 = rsi(closes, 14);
  const m = macd(closes);
  const a14 = atr(goldCandles.data?.candles ?? [], 14);
  const last = closes.length - 1;
  const trendVal =
    e50[last] != null && e200[last] != null
      ? (e50[last] as number) > (e200[last] as number)
        ? t("uptrend")
        : t("downtrend")
      : "—";
  const trendTone =
    e50[last] != null && e200[last] != null
      ? (e50[last] as number) > (e200[last] as number)
        ? "bull"
        : "bear"
      : "neutral";
  const rsiVal = r14[last];
  const macdVal = m.hist[last];
  const atrVal = a14[last];

  // Live AI quick signal via Quantum Flow + advanced analysis
  const liveAi = goldCandles.data && goldCandles.data.candles.length > 200
    ? runAIAnalysis(goldCandles.data.candles, settings, lang)
    : null;
  const advanced = goldCandles.data && goldCandles.data.candles.length > 200 && settings.enableAiAnalysis
    ? runAdvancedAnalysis(goldCandles.data.candles, settings, lang)
    : null;

  const goldSpark = closes.slice(-40);
  const dirAlign = isRTL ? "right" : "left";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={t("app_title")}
        subtitle={t("markets_subtitle")}
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 14 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
        }
      >
        {/* Hero */}
        <LinearGradient
          colors={["#1a1505", "#2a2008", "#13182966"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { borderColor: "#3a2f10", borderRadius: radius }]}
        >
          <View style={[styles.heroRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <View style={{ alignItems: isRTL ? "flex-end" : "flex-start" }}>
              <Text style={[styles.heroSub, { color: colors.gold, textAlign: dirAlign }]}>
                {t("gold_spot")}
              </Text>
              <Text style={[styles.heroPrice, { color: colors.foreground, textAlign: dirAlign }]}>
                {goldQuote.data ? `$${goldQuote.data.price.toFixed(2)}` : "—"}
              </Text>
              {goldQuote.data ? (
                <View style={[styles.heroChange, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <Feather
                    name={goldQuote.data.change >= 0 ? "arrow-up-right" : "arrow-down-right"}
                    size={14}
                    color={goldQuote.data.change >= 0 ? colors.bullish : colors.bearish}
                  />
                  <Text
                    style={[
                      styles.heroChangeText,
                      { color: goldQuote.data.change >= 0 ? colors.bullish : colors.bearish },
                    ]}
                  >
                    {goldQuote.data.change >= 0 ? "+" : ""}
                    {goldQuote.data.change.toFixed(2)} ({goldQuote.data.changePct.toFixed(2)}%)
                  </Text>
                </View>
              ) : null}
            </View>
            {goldSpark.length > 1 ? (
              <SparkLine values={goldSpark} width={120} height={56} color={colors.gold} strokeWidth={1.8} />
            ) : (
              <ActivityIndicator color={colors.gold} />
            )}
          </View>
          <View style={styles.heroStats}>
            {[
              { l: t("open_label"), v: goldQuote.data?.open, c: colors.foreground },
              { l: t("high_label"), v: goldQuote.data?.high, c: colors.bullish },
              { l: t("low_label"), v: goldQuote.data?.low, c: colors.bearish },
              { l: t("state_label"), v: goldQuote.data?.marketState, c: colors.gold, raw: true },
            ].map((s, i) => (
              <View key={i} style={styles.heroStat}>
                <Text style={[styles.heroStatLabel, { color: colors.mutedForeground }]}>{s.l}</Text>
                <Text style={[styles.heroStatVal, { color: s.c }]}>
                  {s.v == null ? "—" : s.raw ? String(s.v) : (s.v as number).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* Indicators */}
        <View style={styles.statRow}>
          <StatPill label={t("trend")} value={trendVal} tone={trendTone as "bull" | "bear" | "neutral"} />
          <StatPill
            label={t("rsi14")}
            value={rsiVal != null ? rsiVal.toFixed(1) : "—"}
            tone={rsiVal == null ? "neutral" : rsiVal > 70 ? "bear" : rsiVal < 30 ? "bull" : "neutral"}
          />
          <StatPill
            label={t("macd_h")}
            value={macdVal != null ? macdVal.toFixed(2) : "—"}
            tone={macdVal == null ? "neutral" : macdVal > 0 ? "bull" : "bear"}
          />
          <StatPill label={t("atr")} value={atrVal != null ? atrVal.toFixed(2) : "—"} tone="gold" />
        </View>

        {/* AI quick signal */}
        <Card>
          <View style={[styles.cardHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <View style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Feather name="zap" size={14} color={colors.gold} />
              <Text style={[styles.cardTitle, { color: colors.foreground, textAlign: dirAlign }]}>
                {t("ai_signal")}
              </Text>
            </View>
            <Pressable onPress={() => router.push("/signals")}>
              <Text style={[styles.linkText, { color: colors.gold }]}>{t("open")}</Text>
            </Pressable>
          </View>
          {liveAi && liveAi.signal !== "NEUTRAL" && advanced ? (
            <View style={{ marginTop: 10, gap: 8 }}>
              <View style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <View
                  style={[
                    styles.sideTag,
                    {
                      backgroundColor: liveAi.signal === "BUY" || liveAi.signal === "PENDING_BUY" ? colors.bullish : liveAi.signal === "SELL" || liveAi.signal === "PENDING_SELL" ? colors.bearish : colors.gold,
                      borderRadius: 6,
                    },
                  ]}
                >
                  <Text style={styles.sideTagText}>
                    {liveAi.signal === "BUY" ? t("signal_buy") : liveAi.signal === "SELL" ? t("signal_sell") : liveAi.signal === "PENDING_BUY" ? t("pending_buy") : liveAi.signal === "PENDING_SELL" ? t("pending_sell") : t("signal_neutral")}
                  </Text>
                </View>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16 }}>
                  ${liveAi.entryPrice.toFixed(2)}
                </Text>
                <Text
                  style={{
                    color:
                      advanced.rating === "A+" || advanced.rating === "A"
                        ? colors.bullish
                        : advanced.rating === "B"
                          ? colors.gold
                          : advanced.rating === "C"
                            ? colors.warning
                            : colors.bearish,
                    fontSize: 14,
                    fontFamily: "Inter_700Bold",
                  }}
                >
                  {advanced.rating}
                </Text>
                <Text style={{ color: colors.gold, fontSize: 12, fontFamily: "Inter_700Bold" }}>
                  {t("confidence")}: {liveAi.confidence}%
                </Text>
              </View>
              <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: 12, flexWrap: "wrap" }}>
                <Text style={{ color: colors.bearish, fontSize: 11, fontFamily: "Inter_700Bold" }}>
                  SL ${liveAi.stopLoss.toFixed(2)}
                </Text>
                <Text style={{ color: colors.bullish, fontSize: 11, fontFamily: "Inter_700Bold" }}>
                  TP1 ${advanced.tp1.toFixed(2)}
                </Text>
                <Text style={{ color: colors.bullish, fontSize: 11, fontFamily: "Inter_700Bold" }}>
                  TP2 ${advanced.tp2.toFixed(2)}
                </Text>
                <Text style={{ color: colors.bullish, fontSize: 11, fontFamily: "Inter_700Bold" }}>
                  TP3 ${advanced.tp3.toFixed(2)}
                </Text>
                <Text style={{ color: colors.gold, fontSize: 11, fontFamily: "Inter_700Bold" }}>
                  R:R {advanced.riskReward.toFixed(2)}
                </Text>
              </View>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 12,
                  fontFamily: "Inter_400Regular",
                  textAlign: dirAlign,
                  writingDirection: isRTL ? "rtl" : "ltr",
                }}
              >
                {liveAi.analysisSummary}
              </Text>
            </View>
          ) : (
            <Text
              style={{
                color: colors.mutedForeground,
                marginTop: 8,
                textAlign: dirAlign,
                writingDirection: isRTL ? "rtl" : "ltr",
              }}
            >
              {liveAi == null ? t("loading") : t("no_active_signal")}
            </Text>
          )}
        </Card>

        {/* Watchlist */}
        <View style={[styles.cardHeaderInline, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: dirAlign }]}>
            {t("watchlist")}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_500Medium" }}>
            {t("tap_load_chart")}
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
  hero: { padding: 18, borderWidth: 1, gap: 14 },
  heroRow: { justifyContent: "space-between", alignItems: "flex-end" },
  heroSub: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1.5 },
  heroPrice: { fontSize: 38, fontFamily: "Inter_700Bold", marginTop: 6, letterSpacing: -1 },
  heroChange: { alignItems: "center", gap: 4, marginTop: 4 },
  heroChangeText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  heroStats: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  heroStat: { gap: 2 },
  heroStatLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  heroStatVal: { fontSize: 13, fontFamily: "Inter_700Bold" },
  statRow: { flexDirection: "row", gap: 8 },
  cardHeader: { justifyContent: "space-between", alignItems: "center" },
  cardHeaderInline: {
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    marginBottom: -4,
  },
  cardTitle: { fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  row: { alignItems: "center", gap: 8 },
  linkText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  sideTag: { paddingHorizontal: 8, paddingVertical: 3 },
  sideTagText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
});
