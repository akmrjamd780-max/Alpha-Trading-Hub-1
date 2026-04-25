import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { Card } from "@/components/Card";
import { useColors, useRadius } from "@/hooks/useColors";
import { useT } from "@/context/SettingsContext";
import type {
  AdvancedAnalysis,
  FactorScore,
  PriceLevel,
  Zone,
} from "@/lib/advancedAnalysis";

// =============================================================
// AnalysisCard — full structured render of the Advanced Analysis.
// Sections: header (signal + rating), trade plan, pending order,
// reversal probabilities, factor board, patterns, support/resistance,
// zones, confirmation/cancellation conditions, reasons, notes.
// =============================================================

const RATING_COLORS: Record<string, string> = {
  "A+": "#16a34a",
  A: "#22c55e",
  B: "#eab308",
  C: "#f59e0b",
  D: "#ef4444",
};

function fmt(n: number) {
  return n.toFixed(2);
}

export function AnalysisCard({
  analysis,
  symbol,
}: {
  analysis: AdvancedAnalysis;
  symbol: string;
}) {
  const colors = useColors();
  const radius = useRadius();
  const { t, lang, isRTL } = useT();
  const dirAlign: "left" | "right" = isRTL ? "right" : "left";
  const rowDir = isRTL ? "row-reverse" : "row";
  const a = analysis;
  const sig = a.base.signal;
  const sigColor = sig === "BUY" ? colors.bullish : sig === "SELL" ? colors.bearish : colors.gold;
  const sigText =
    sig === "BUY"
      ? lang === "ar"
        ? "شراء"
        : "BUY"
      : sig === "SELL"
        ? lang === "ar"
          ? "بيع"
          : "SELL"
        : lang === "ar"
          ? "محايد"
          : "NEUTRAL";

  return (
    <View style={{ gap: 12 }}>
      {/* Header: signal + rating */}
      <LinearGradient
        colors={
          sig === "BUY"
            ? ["#0a2418", "#0a0e1a"]
            : sig === "SELL"
              ? ["#240a0e", "#0a0e1a"]
              : ["#1a1505", "#0a0e1a"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          s.hero,
          { borderColor: sigColor + "55", borderRadius: radius },
        ]}
      >
        <View style={[s.heroRow, { flexDirection: rowDir }]}>
          <View style={{ alignItems: isRTL ? "flex-end" : "flex-start", gap: 4 }}>
            <Text style={[s.symbolLabel, { color: colors.mutedForeground, textAlign: dirAlign }]}>
              {symbol}
            </Text>
            <View style={[{ flexDirection: rowDir, alignItems: "center", gap: 8 }]}>
              <View style={[s.sideTag, { backgroundColor: sigColor }]}>
                <Text style={s.sideTagText}>{sigText}</Text>
              </View>
              <Text style={[s.entryText, { color: colors.foreground }]}>
                ${fmt(a.base.entryPrice)}
              </Text>
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 11, textAlign: dirAlign, writingDirection: isRTL ? "rtl" : "ltr" }}>
              {a.base.analysisSummary}
            </Text>
          </View>
          <View style={{ alignItems: "center", gap: 2 }}>
            <View
              style={[
                s.ratingBadge,
                {
                  backgroundColor: RATING_COLORS[a.rating] + "22",
                  borderColor: RATING_COLORS[a.rating],
                  borderRadius: radius - 6,
                },
              ]}
            >
              <Text style={[s.ratingText, { color: RATING_COLORS[a.rating] }]}>{a.rating}</Text>
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 }}>
              {t("rating_label")}
            </Text>
            <Text style={{ color: colors.gold, fontSize: 11, fontFamily: "Inter_700Bold" }}>
              {a.base.confidence}% · {a.ratingScore}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Pending order suggestion */}
      {a.pendingOrder && (
        <Card>
          <View style={[{ flexDirection: rowDir, alignItems: "center", gap: 8 }]}>
            <Feather name="clock" size={14} color={colors.gold} />
            <Text style={[s.cardTitle, { color: colors.foreground, textAlign: dirAlign, flex: 1 }]}>
              {t("pending_order")}
            </Text>
            <Text style={{ color: colors.gold, fontSize: 12, fontFamily: "Inter_700Bold" }}>
              {t(
                a.pendingOrder.type === "BUY_LIMIT"
                  ? "buy_limit"
                  : a.pendingOrder.type === "SELL_LIMIT"
                    ? "sell_limit"
                    : a.pendingOrder.type === "BUY_STOP"
                      ? "buy_stop"
                      : "sell_stop",
              )}
            </Text>
          </View>
          <View style={[{ flexDirection: rowDir, alignItems: "center", gap: 6, marginTop: 6 }]}>
            <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{t("pending_at")}</Text>
            <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_700Bold" }}>
              ${fmt(a.pendingOrder.price)}
            </Text>
          </View>
          <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 4, textAlign: dirAlign, writingDirection: isRTL ? "rtl" : "ltr" }}>
            {lang === "ar" ? a.pendingOrder.reasonAr : a.pendingOrder.reasonEn}
          </Text>
        </Card>
      )}

      {/* Trade plan */}
      {sig !== "NEUTRAL" && (
        <Card>
          <View style={[{ flexDirection: rowDir, alignItems: "center", gap: 8 }]}>
            <Feather name="target" size={14} color={colors.gold} />
            <Text style={[s.cardTitle, { color: colors.foreground, textAlign: dirAlign, flex: 1 }]}>
              {t("trade_plan")}
            </Text>
            <Text style={{ color: colors.gold, fontSize: 11, fontFamily: "Inter_700Bold" }}>
              R:R {a.riskReward.toFixed(2)}
            </Text>
          </View>
          <View style={{ marginTop: 10, gap: 6 }}>
            <PriceRow label={t("entry_label")} price={a.base.entryPrice} color={colors.gold} dirAlign={dirAlign} />
            <PriceRow label={t("sl_label")} price={a.base.stopLoss} color={colors.bearish} dirAlign={dirAlign} />
            <PriceRow label={t("tp1_label")} price={a.tp1} color={colors.bullish} dirAlign={dirAlign} subText={`${t("reversal_prob")} ${a.reversalP1}%`} mutedColor={colors.mutedForeground} />
            <PriceRow label={t("tp2_label")} price={a.tp2} color={colors.bullish} dirAlign={dirAlign} subText={`${t("reversal_prob")} ${a.reversalP2}%`} mutedColor={colors.mutedForeground} />
            <PriceRow label={t("tp3_label")} price={a.tp3} color={colors.bullish} dirAlign={dirAlign} subText={`${t("reversal_prob")} ${a.reversalP3}%`} mutedColor={colors.mutedForeground} />
          </View>
        </Card>
      )}

      {/* Factor board */}
      <Card>
        <View style={[{ flexDirection: rowDir, alignItems: "center", gap: 8 }]}>
          <Feather name="grid" size={14} color={colors.gold} />
          <Text style={[s.cardTitle, { color: colors.foreground, textAlign: dirAlign, flex: 1 }]}>
            {t("factor_board")}
          </Text>
          <Text
            style={{
              color: a.factorScore > 0 ? colors.bullish : a.factorScore < 0 ? colors.bearish : colors.mutedForeground,
              fontSize: 12,
              fontFamily: "Inter_700Bold",
            }}
          >
            {a.factorScore > 0 ? "+" : ""}
            {a.factorScore} / 100
          </Text>
        </View>
        <View style={{ marginTop: 10, gap: 6 }}>
          {a.factors.map((f) => (
            <FactorRow key={f.key} f={f} dirAlign={dirAlign} rowDir={rowDir} lang={lang} />
          ))}
        </View>
      </Card>

      {/* Patterns */}
      <Card>
        <View style={[{ flexDirection: rowDir, alignItems: "center", gap: 8 }]}>
          <Feather name="bar-chart-2" size={14} color={colors.gold} />
          <Text style={[s.cardTitle, { color: colors.foreground, textAlign: dirAlign, flex: 1 }]}>
            {t("detected_patterns")}
          </Text>
        </View>
        {a.patterns.length === 0 ? (
          <Text style={{ color: colors.mutedForeground, marginTop: 8, textAlign: dirAlign, writingDirection: isRTL ? "rtl" : "ltr" }}>
            {t("no_patterns")}
          </Text>
        ) : (
          <View style={{ marginTop: 8, gap: 8 }}>
            {a.patterns.map((p) => (
              <View key={p.key} style={[{ flexDirection: rowDir, alignItems: "center", gap: 8 }]}>
                <View
                  style={[
                    s.dotSm,
                    {
                      backgroundColor:
                        p.side === "BULL" ? colors.bullish : p.side === "BEAR" ? colors.bearish : colors.gold,
                    },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 13, textAlign: dirAlign, writingDirection: isRTL ? "rtl" : "ltr" }}>
                    {lang === "ar" ? p.nameAr : p.nameEn}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, textAlign: dirAlign, writingDirection: isRTL ? "rtl" : "ltr" }}>
                    {lang === "ar" ? p.descAr : p.descEn}
                  </Text>
                </View>
                <Text style={{ color: colors.gold, fontSize: 11, fontFamily: "Inter_700Bold" }}>{p.strength}%</Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* Levels: Support/Resistance side by side */}
      <View style={{ flexDirection: rowDir, gap: 10 }}>
        <LevelsCard title={t("support_levels")} levels={a.supports} color={colors.bullish} icon="trending-up" lang={lang} dirAlign={dirAlign} rowDir={rowDir} />
        <LevelsCard title={t("resistance_levels")} levels={a.resistances} color={colors.bearish} icon="trending-down" lang={lang} dirAlign={dirAlign} rowDir={rowDir} />
      </View>

      {/* Zones */}
      <Card>
        <View style={[{ flexDirection: rowDir, alignItems: "center", gap: 8 }]}>
          <Feather name="layers" size={14} color={colors.gold} />
          <Text style={[s.cardTitle, { color: colors.foreground, textAlign: dirAlign, flex: 1 }]}>
            {lang === "ar" ? "المناطق" : "Zones"}
          </Text>
        </View>
        <ZoneSection title={t("demand_zones")} zones={a.demandZones} color={colors.bullish} lang={lang} dirAlign={dirAlign} rowDir={rowDir} />
        <ZoneSection title={t("supply_zones")} zones={a.supplyZones} color={colors.bearish} lang={lang} dirAlign={dirAlign} rowDir={rowDir} />
        <ZoneSection title={t("liquidity_zones")} zones={a.liquidityZones} color={colors.gold} lang={lang} dirAlign={dirAlign} rowDir={rowDir} />
      </Card>

      {/* Confirmation conditions */}
      {a.confirmConditions.length > 0 && (
        <Card>
          <View style={[{ flexDirection: rowDir, alignItems: "center", gap: 8 }]}>
            <Feather name="check-circle" size={14} color={colors.bullish} />
            <Text style={[s.cardTitle, { color: colors.foreground, textAlign: dirAlign, flex: 1 }]}>
              {t("confirm_conditions")}
            </Text>
          </View>
          <View style={{ marginTop: 8, gap: 6 }}>
            {a.confirmConditions.map((c, i) => (
              <BulletRow key={i} text={c} color={colors.bullish} dirAlign={dirAlign} rowDir={rowDir} isRTL={isRTL} fg={colors.foreground} />
            ))}
          </View>
        </Card>
      )}

      {/* Cancellation conditions */}
      {a.cancelConditions.length > 0 && (
        <Card>
          <View style={[{ flexDirection: rowDir, alignItems: "center", gap: 8 }]}>
            <Feather name="x-circle" size={14} color={colors.bearish} />
            <Text style={[s.cardTitle, { color: colors.foreground, textAlign: dirAlign, flex: 1 }]}>
              {t("cancel_conditions")}
            </Text>
          </View>
          <View style={{ marginTop: 8, gap: 6 }}>
            {a.cancelConditions.map((c, i) => (
              <BulletRow key={i} text={c} color={colors.bearish} dirAlign={dirAlign} rowDir={rowDir} isRTL={isRTL} fg={colors.foreground} />
            ))}
          </View>
        </Card>
      )}

      {/* Reasons */}
      {a.reasons.length > 0 && (
        <Card>
          <View style={[{ flexDirection: rowDir, alignItems: "center", gap: 8 }]}>
            <Feather name="info" size={14} color={colors.gold} />
            <Text style={[s.cardTitle, { color: colors.foreground, textAlign: dirAlign, flex: 1 }]}>
              {t("reasons_label")}
            </Text>
          </View>
          <View style={{ marginTop: 8, gap: 6 }}>
            {a.reasons.map((c, i) => (
              <BulletRow key={i} text={c} color={colors.gold} dirAlign={dirAlign} rowDir={rowDir} isRTL={isRTL} fg={colors.foreground} />
            ))}
          </View>
        </Card>
      )}

      {/* Important notes */}
      {a.importantNotes.length > 0 && (
        <Card>
          <View style={[{ flexDirection: rowDir, alignItems: "center", gap: 8 }]}>
            <Feather name="alert-triangle" size={14} color={colors.warning} />
            <Text style={[s.cardTitle, { color: colors.foreground, textAlign: dirAlign, flex: 1 }]}>
              {t("important_notes")}
            </Text>
          </View>
          <View style={{ marginTop: 8, gap: 6 }}>
            {a.importantNotes.map((c, i) => (
              <BulletRow key={i} text={c} color={colors.warning} dirAlign={dirAlign} rowDir={rowDir} isRTL={isRTL} fg={colors.foreground} />
            ))}
          </View>
        </Card>
      )}
    </View>
  );
}

function PriceRow({
  label,
  price,
  color,
  dirAlign,
  subText,
  mutedColor,
}: {
  label: string;
  price: number;
  color: string;
  dirAlign: "left" | "right";
  subText?: string;
  mutedColor?: string;
}) {
  return (
    <View style={[s.priceRow, { flexDirection: dirAlign === "right" ? "row-reverse" : "row" }]}>
      <View style={[s.dot, { backgroundColor: color }]} />
      <Text style={{ color: color, fontFamily: "Inter_700Bold", fontSize: 12, flex: 1, textAlign: dirAlign }}>
        {label}
      </Text>
      <View style={{ alignItems: dirAlign === "right" ? "flex-start" : "flex-end" }}>
        <Text style={{ color, fontFamily: "Inter_700Bold", fontSize: 14 }}>
          ${fmt(price)}
        </Text>
        {subText ? (
          <Text style={{ color: mutedColor, fontSize: 9, fontFamily: "Inter_500Medium" }}>{subText}</Text>
        ) : null}
      </View>
    </View>
  );
}

function FactorRow({
  f,
  dirAlign,
  rowDir,
  lang,
}: {
  f: FactorScore;
  dirAlign: "left" | "right";
  rowDir: "row" | "row-reverse";
  lang: "ar" | "en";
}) {
  const colors = useColors();
  const sColor = f.state === "POS" ? colors.bullish : f.state === "NEG" ? colors.bearish : colors.mutedForeground;
  return (
    <View style={[{ flexDirection: rowDir, alignItems: "center", gap: 8 }]}>
      <Feather
        name={f.state === "POS" ? "arrow-up-right" : f.state === "NEG" ? "arrow-down-right" : "minus"}
        size={12}
        color={sColor}
      />
      <Text style={{ color: colors.foreground, fontSize: 12, flex: 1, fontFamily: "Inter_500Medium", textAlign: dirAlign }}>
        {lang === "ar" ? f.labelAr : f.labelEn}
      </Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_500Medium", minWidth: 60, textAlign: "center" }}>
        {lang === "ar" ? f.rawAr : f.rawEn}
      </Text>
      <View style={[s.barTrack, { backgroundColor: colors.cardElevated }]}>
        <View style={[s.barFill, { width: `${Math.max(4, f.strength)}%`, backgroundColor: sColor }]} />
      </View>
      <Text style={{ color: sColor, fontSize: 10, fontFamily: "Inter_700Bold", width: 30, textAlign: "right" }}>
        {f.strength}%
      </Text>
    </View>
  );
}

function LevelsCard({
  title,
  levels,
  color,
  icon,
  lang,
  dirAlign,
  rowDir,
}: {
  title: string;
  levels: PriceLevel[];
  color: string;
  icon: keyof typeof Feather.glyphMap;
  lang: "ar" | "en";
  dirAlign: "left" | "right";
  rowDir: "row" | "row-reverse";
}) {
  const colors = useColors();
  return (
    <View style={{ flex: 1 }}>
      <Card>
        <View style={[{ flexDirection: rowDir, alignItems: "center", gap: 6 }]}>
          <Feather name={icon} size={12} color={color} />
          <Text style={{ color: color, fontFamily: "Inter_700Bold", fontSize: 11, flex: 1, textAlign: dirAlign }}>
            {title}
          </Text>
        </View>
        <View style={{ marginTop: 6, gap: 4 }}>
          {levels.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 10, textAlign: dirAlign }}>—</Text>
          ) : (
            levels.map((l, i) => (
              <View key={i} style={[{ flexDirection: rowDir, alignItems: "center", gap: 4 }]}>
                <Text style={{ color, fontFamily: "Inter_700Bold", fontSize: 12 }}>${fmt(l.price)}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 9, flex: 1, textAlign: dirAlign, writingDirection: dirAlign === "right" ? "rtl" : "ltr" }}>
                  {lang === "ar" ? l.labelAr : l.labelEn}
                </Text>
              </View>
            ))
          )}
        </View>
      </Card>
    </View>
  );
}

function ZoneSection({
  title,
  zones,
  color,
  lang,
  dirAlign,
  rowDir,
}: {
  title: string;
  zones: Zone[];
  color: string;
  lang: "ar" | "en";
  dirAlign: "left" | "right";
  rowDir: "row" | "row-reverse";
}) {
  const colors = useColors();
  if (zones.length === 0) return null;
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ color: color, fontFamily: "Inter_700Bold", fontSize: 11, textAlign: dirAlign, marginBottom: 4 }}>
        {title}
      </Text>
      <View style={{ gap: 4 }}>
        {zones.map((z, i) => (
          <View key={i} style={[{ flexDirection: rowDir, alignItems: "center", gap: 8 }]}>
            <View style={[s.dotSm, { backgroundColor: color }]} />
            <Text style={{ color: colors.foreground, fontSize: 12, fontFamily: "Inter_500Medium" }}>
              ${fmt(z.low)} – ${fmt(z.high)}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 10, flex: 1, textAlign: dirAlign, writingDirection: dirAlign === "right" ? "rtl" : "ltr" }}>
              {lang === "ar" ? z.labelAr : z.labelEn}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function BulletRow({
  text,
  color,
  dirAlign,
  rowDir,
  isRTL,
  fg,
}: {
  text: string;
  color: string;
  dirAlign: "left" | "right";
  rowDir: "row" | "row-reverse";
  isRTL: boolean;
  fg: string;
}) {
  return (
    <View style={[{ flexDirection: rowDir, alignItems: "flex-start", gap: 8 }]}>
      <View style={[s.dotSm, { backgroundColor: color, marginTop: 5 }]} />
      <Text style={{ color: fg, fontSize: 12, flex: 1, fontFamily: "Inter_500Medium", textAlign: dirAlign, writingDirection: isRTL ? "rtl" : "ltr", lineHeight: 18 }}>
        {text}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { padding: 16, borderWidth: 1 },
  heroRow: { justifyContent: "space-between", alignItems: "center" },
  symbolLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.2 },
  entryText: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  ratingBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 56,
    alignItems: "center",
    borderWidth: 1.5,
  },
  ratingText: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  sideTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  sideTagText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  cardTitle: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  priceRow: { alignItems: "center", gap: 8, paddingVertical: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotSm: { width: 6, height: 6, borderRadius: 3 },
  barTrack: {
    width: 60,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  barFill: { height: 4, borderRadius: 2 },
});
