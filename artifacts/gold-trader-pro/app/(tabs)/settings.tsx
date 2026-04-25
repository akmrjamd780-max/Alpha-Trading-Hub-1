import React from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/Header";
import { Card } from "@/components/Card";
import { useColors, useRadius } from "@/hooks/useColors";
import {
  useT,
  useSettings,
  activeFilterCount,
  type EngineMode,
  type SLMethod,
  type TPMethod,
  type SessionFilter,
  type ConfluenceMode,
} from "@/context/SettingsContext";

export default function SettingsScreen() {
  const colors = useColors();
  const radius = useRadius();
  const { t, isRTL, lang } = useT();
  const { settings, update, reset, setLang } = useSettings();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 100 : insets.bottom + 80;
  const dirAlign: "left" | "right" = isRTL ? "right" : "left";

  function handleReset() {
    if (Platform.OS === "web") {
      const ok = typeof window !== "undefined" ? window.confirm(t("reset_confirm")) : true;
      if (ok) reset();
    } else {
      Alert.alert(t("reset_settings"), t("reset_confirm"), [
        { text: t("cancel"), style: "cancel" },
        { text: t("reset"), style: "destructive", onPress: () => reset() },
      ]);
    }
  }

  const filterCount = activeFilterCount(settings);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={t("settings_title")}
        subtitle={lang === "ar" ? "تخصيص محرك التحليل" : "Customize the analysis engine"}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 12 }}>
        {/* Live status banner */}
        <Card>
          <View style={{ flexDirection: dirAlign === "right" ? "row-reverse" : "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.gold + "22",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="sliders" size={18} color={colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.gold,
                  fontFamily: "Inter_700Bold",
                  fontSize: 13,
                  textAlign: dirAlign,
                  writingDirection: isRTL ? "rtl" : "ltr",
                }}
              >
                {t("active_filters")}: {filterCount}
              </Text>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                  fontSize: 11,
                  marginTop: 2,
                  textAlign: dirAlign,
                  writingDirection: isRTL ? "rtl" : "ltr",
                }}
              >
                {t("setting_changed_hint")}
              </Text>
            </View>
          </View>
        </Card>

        {/* Language */}
        <Section title={t("language")} dirAlign={dirAlign}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["ar", "en"] as const).map((l) => {
              const active = settings.lang === l;
              return (
                <Pressable
                  key={l}
                  onPress={() => setLang(l)}
                  style={[
                    styles.langBtn,
                    {
                      backgroundColor: active ? colors.gold : colors.cardElevated,
                      borderColor: active ? colors.gold : colors.border,
                      borderRadius: radius - 4,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? colors.background : colors.foreground,
                      fontFamily: "Inter_700Bold",
                      fontSize: 13,
                    }}
                  >
                    {l === "ar" ? "العربية" : "English"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* Market structure */}
        <Section title={t("market_structure")} dirAlign={dirAlign}>
          <NumberRow
            label={t("swing_length")}
            value={settings.swingLength}
            onChange={(v) => update({ swingLength: clamp(Math.round(v), 2, 20) })}
            dirAlign={dirAlign}
          />
          <SwitchRow label={t("enable_wall")} value={settings.enableWall} onChange={(v) => update({ enableWall: v })} dirAlign={dirAlign} />
          <SwitchRow label={t("enable_war_zone")} value={settings.enableWarZone} onChange={(v) => update({ enableWarZone: v })} dirAlign={dirAlign} />
          <SwitchRow label={t("enable_bos")} value={settings.enableBOS} onChange={(v) => update({ enableBOS: v })} dirAlign={dirAlign} />
          <SwitchRow label={t("enable_fvg_signal")} value={settings.enableFVG} onChange={(v) => update({ enableFVG: v })} dirAlign={dirAlign} />
          <SwitchRow label={t("require_fvg")} value={settings.requireFvgConfluence} onChange={(v) => update({ requireFvgConfluence: v })} dirAlign={dirAlign} />
          <SwitchRow label={t("allow_counter_trend")} value={settings.allowCounterTrend} onChange={(v) => update({ allowCounterTrend: v })} dirAlign={dirAlign} />
        </Section>

        {/* Fibonacci */}
        <Section title={t("fibonacci")} dirAlign={dirAlign}>
          <SwitchRow label={t("use_golden_zone")} value={settings.useGoldenZone} onChange={(v) => update({ useGoldenZone: v })} dirAlign={dirAlign} />
          <SwitchRow label={t("require_golden_zone")} value={settings.requireGoldenZone} onChange={(v) => update({ requireGoldenZone: v })} dirAlign={dirAlign} />
        </Section>

        {/* Breakouts */}
        <Section title={t("breakouts")} dirAlign={dirAlign}>
          <SwitchRow label={t("enable_orb")} value={settings.enableOrb} onChange={(v) => update({ enableOrb: v })} dirAlign={dirAlign} />
        </Section>

        {/* Engine */}
        <Section title={t("engine")} dirAlign={dirAlign}>
          <Text style={[styles.subLabel, { color: colors.mutedForeground, textAlign: dirAlign }]}>{t("engine_mode")}</Text>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
            {(["fast", "balanced", "slow"] as EngineMode[]).map((m) => (
              <ModeBtn
                key={m}
                active={settings.engineMode === m}
                label={m === "fast" ? t("mode_fast") : m === "slow" ? t("mode_slow") : t("mode_balanced")}
                onPress={() => update({ engineMode: m })}
              />
            ))}
          </View>
          <View style={{ marginTop: 12 }}>
            <SwitchRow label={t("enable_qf_cross")} value={settings.enableQFCross} onChange={(v) => update({ enableQFCross: v })} dirAlign={dirAlign} />
            <SwitchRow label={t("use_custom_rsi_zones")} value={settings.useCustomRsiZones} onChange={(v) => update({ useCustomRsiZones: v })} dirAlign={dirAlign} />
            {settings.useCustomRsiZones && (
              <>
                <NumberRow label={t("buy_zone_low")} value={settings.buyZoneLow} onChange={(v) => update({ buyZoneLow: clamp(Math.round(v), 0, 100) })} dirAlign={dirAlign} />
                <NumberRow label={t("buy_zone_high")} value={settings.buyZoneHigh} onChange={(v) => update({ buyZoneHigh: clamp(Math.round(v), 0, 100) })} dirAlign={dirAlign} />
                <NumberRow label={t("sell_zone_low")} value={settings.sellZoneLow} onChange={(v) => update({ sellZoneLow: clamp(Math.round(v), 0, 100) })} dirAlign={dirAlign} />
                <NumberRow label={t("sell_zone_high")} value={settings.sellZoneHigh} onChange={(v) => update({ sellZoneHigh: clamp(Math.round(v), 0, 100) })} dirAlign={dirAlign} />
              </>
            )}
            <NumberRow label={t("rsi_period")} value={settings.rsiPeriod} onChange={(v) => update({ rsiPeriod: clamp(Math.round(v), 2, 50) })} dirAlign={dirAlign} />
            <NumberRow label={t("ema_rsi_period")} value={settings.emaRsiPeriod} onChange={(v) => update({ emaRsiPeriod: clamp(Math.round(v), 2, 50) })} dirAlign={dirAlign} />
            <NumberRow label={t("adx_period")} value={settings.adxPeriod} onChange={(v) => update({ adxPeriod: clamp(Math.round(v), 5, 50) })} dirAlign={dirAlign} />
            <NumberRow label={t("atr_period")} value={settings.atrPeriod} onChange={(v) => update({ atrPeriod: clamp(Math.round(v), 5, 50) })} dirAlign={dirAlign} />
          </View>
        </Section>

        {/* Mandatory filters */}
        <Section title={t("mandatory_filters")} dirAlign={dirAlign}>
          <NumberRow label={t("adx_threshold")} value={settings.adxThreshold} onChange={(v) => update({ adxThreshold: clamp(Math.round(v), 0, 60) })} dirAlign={dirAlign} />
          <NumberRow label={t("spike_filter")} value={settings.spikeFilterMult} step={0.1} onChange={(v) => update({ spikeFilterMult: clamp(round1(v), 1, 5) })} dirAlign={dirAlign} />
          <NumberRow label={t("min_vol_mult")} value={settings.minVolatilityMult} step={0.05} onChange={(v) => update({ minVolatilityMult: clamp(round2(v), 0, 2) })} dirAlign={dirAlign} />
          <Text style={[styles.subLabel, { color: colors.mutedForeground, textAlign: dirAlign, marginTop: 10 }]}>{t("session_filter")}</Text>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            {(["all", "asia", "london", "ny", "london_ny"] as SessionFilter[]).map((s) => (
              <ModeBtn
                key={s}
                active={settings.sessionFilter === s}
                label={
                  s === "all"
                    ? t("session_all")
                    : s === "asia"
                    ? t("session_asia")
                    : s === "london"
                    ? t("session_london")
                    : s === "ny"
                    ? t("session_ny")
                    : t("session_london_ny")
                }
                onPress={() => update({ sessionFilter: s })}
              />
            ))}
          </View>
        </Section>

        {/* Optional filters */}
        <Section title={t("optional_filters")} dirAlign={dirAlign}>
          <SwitchRow label={t("use_mtf_filter")} value={settings.useMtfFilter} onChange={(v) => update({ useMtfFilter: v })} dirAlign={dirAlign} />
          <SwitchRow label={t("use_vwap_filter")} value={settings.useVwapFilter} onChange={(v) => update({ useVwapFilter: v })} dirAlign={dirAlign} />
          <SwitchRow label={t("use_macd_div_filter")} value={settings.useMacdDivFilter} onChange={(v) => update({ useMacdDivFilter: v })} dirAlign={dirAlign} />
          <SwitchRow label={t("use_dxy_filter")} value={settings.useDxyFilter} onChange={(v) => update({ useDxyFilter: v })} dirAlign={dirAlign} />
          <SwitchRow label={t("use_moon_filter")} value={settings.useMoonFilter} onChange={(v) => update({ useMoonFilter: v })} dirAlign={dirAlign} />
          <Text style={[styles.subLabel, { color: colors.mutedForeground, textAlign: dirAlign, marginTop: 10 }]}>{t("confluence_mode")}</Text>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
            {(["any", "majority", "all"] as ConfluenceMode[]).map((m) => (
              <ModeBtn
                key={m}
                active={settings.confluenceMode === m}
                label={m === "any" ? t("conf_any") : m === "majority" ? t("conf_majority") : t("conf_all")}
                onPress={() => update({ confluenceMode: m })}
              />
            ))}
          </View>
          <NumberRow label={t("min_confidence")} value={settings.minConfidence} onChange={(v) => update({ minConfidence: clamp(Math.round(v), 0, 99) })} dirAlign={dirAlign} />
          <NumberRow label={t("min_rr")} value={settings.minRiskReward} step={0.1} onChange={(v) => update({ minRiskReward: clamp(round1(v), 0.5, 5) })} dirAlign={dirAlign} />
        </Section>

        {/* Confidence weights */}
        <Section title={t("weights_section")} dirAlign={dirAlign}>
          <NumberRow label={t("weight_bos")} value={settings.weightBOS} onChange={(v) => update({ weightBOS: clamp(Math.round(v), 0, 30) })} dirAlign={dirAlign} />
          <NumberRow label={t("weight_wall")} value={settings.weightWall} onChange={(v) => update({ weightWall: clamp(Math.round(v), 0, 30) })} dirAlign={dirAlign} />
          <NumberRow label={t("weight_golden")} value={settings.weightGoldenZone} onChange={(v) => update({ weightGoldenZone: clamp(Math.round(v), 0, 30) })} dirAlign={dirAlign} />
          <NumberRow label={t("weight_fvg")} value={settings.weightFVG} onChange={(v) => update({ weightFVG: clamp(Math.round(v), 0, 30) })} dirAlign={dirAlign} />
          <NumberRow label={t("weight_macd")} value={settings.weightMacdDiv} onChange={(v) => update({ weightMacdDiv: clamp(Math.round(v), 0, 30) })} dirAlign={dirAlign} />
          <NumberRow label={t("weight_mtf")} value={settings.weightMtf} onChange={(v) => update({ weightMtf: clamp(Math.round(v), 0, 30) })} dirAlign={dirAlign} />
          <NumberRow label={t("weight_vwap")} value={settings.weightVwap} onChange={(v) => update({ weightVwap: clamp(Math.round(v), 0, 30) })} dirAlign={dirAlign} />
          <NumberRow label={t("weight_orb")} value={settings.weightOrb} onChange={(v) => update({ weightOrb: clamp(Math.round(v), 0, 30) })} dirAlign={dirAlign} />
          <NumberRow label={t("weight_moon")} value={settings.weightMoon} onChange={(v) => update({ weightMoon: clamp(Math.round(v), 0, 30) })} dirAlign={dirAlign} />
        </Section>

        {/* Early warning */}
        <Section title={t("early_warning")} dirAlign={dirAlign}>
          <SwitchRow label={t("enable_early_warning")} value={settings.enableEarlyWarning} onChange={(v) => update({ enableEarlyWarning: v })} dirAlign={dirAlign} />
        </Section>

        {/* Risk management */}
        <Section title={t("risk_management")} dirAlign={dirAlign}>
          <Text style={[styles.subLabel, { color: colors.mutedForeground, textAlign: dirAlign, marginBottom: 6 }]}>{t("sl_method")}</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {(["structural", "atr", "fib"] as SLMethod[]).map((m) => (
              <ModeBtn
                key={m}
                active={settings.slMethod === m}
                label={m === "structural" ? t("method_structural") : m === "atr" ? t("method_atr") : t("method_fib")}
                onPress={() => update({ slMethod: m })}
              />
            ))}
          </View>
          {settings.slMethod === "atr" && (
            <NumberRow label={t("atr_sl_mult")} value={settings.atrSlMult} step={0.1} onChange={(v) => update({ atrSlMult: clamp(round1(v), 0.3, 5) })} dirAlign={dirAlign} />
          )}
          <Text style={[styles.subLabel, { color: colors.mutedForeground, textAlign: dirAlign, marginTop: 12, marginBottom: 6 }]}>{t("tp_method")}</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {(["structural", "fib", "atr"] as TPMethod[]).map((m) => (
              <ModeBtn
                key={m}
                active={settings.tpMethod === m}
                label={m === "structural" ? t("method_structural") : m === "fib" ? t("method_fib") : t("method_atr")}
                onPress={() => update({ tpMethod: m })}
              />
            ))}
          </View>
          {settings.tpMethod === "atr" && (
            <NumberRow label={t("atr_tp_mult")} value={settings.atrTpMult} step={0.1} onChange={(v) => update({ atrTpMult: clamp(round1(v), 0.5, 8) })} dirAlign={dirAlign} />
          )}
          {settings.tpMethod === "fib" && (
            <>
              <FibLevelRow label={t("fib_tp1_level")} value={settings.fibTp1} onChange={(v) => update({ fibTp1: v })} dirAlign={dirAlign} />
              <FibLevelRow label={t("fib_tp2_level")} value={settings.fibTp2} onChange={(v) => update({ fibTp2: v })} dirAlign={dirAlign} />
            </>
          )}
          <View style={{ marginTop: 10 }}>
            <SwitchRow label={t("use_trailing")} value={settings.useTrailing} onChange={(v) => update({ useTrailing: v })} dirAlign={dirAlign} />
          </View>
        </Section>

        {/* About */}
        <Section title={t("about")} dirAlign={dirAlign}>
          <Text
            style={{
              color: colors.mutedForeground,
              fontSize: 12,
              fontFamily: "Inter_500Medium",
              lineHeight: 19,
              textAlign: dirAlign,
              writingDirection: isRTL ? "rtl" : "ltr",
            }}
          >
            {t("about_text")}
          </Text>
          <Text style={{ color: colors.gold, fontSize: 11, fontFamily: "Inter_700Bold", marginTop: 8, textAlign: dirAlign }}>
            v1.1.0
          </Text>
        </Section>

        <Pressable
          onPress={handleReset}
          style={[styles.resetBtn, { borderColor: colors.bearish, borderRadius: radius - 4, backgroundColor: colors.cardElevated }]}
        >
          <Feather name="rotate-ccw" size={14} color={colors.bearish} />
          <Text style={{ color: colors.bearish, fontFamily: "Inter_700Bold", fontSize: 13 }}>{t("reset_settings")}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function clamp(v: number, lo: number, hi: number) {
  if (isNaN(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}
function round1(v: number) {
  return Math.round(v * 10) / 10;
}
function round2(v: number) {
  return Math.round(v * 100) / 100;
}

function Section({ title, children, dirAlign }: { title: string; children: React.ReactNode; dirAlign: "left" | "right" }) {
  const colors = useColors();
  return (
    <Card>
      <Text
        style={{
          color: colors.gold,
          fontSize: 12,
          fontFamily: "Inter_700Bold",
          letterSpacing: 0.6,
          textTransform: "uppercase",
          marginBottom: 10,
          textAlign: dirAlign,
        }}
      >
        {title}
      </Text>
      {children}
    </Card>
  );
}

function SwitchRow({ label, value, onChange, dirAlign }: { label: string; value: boolean; onChange: (v: boolean) => void; dirAlign: "left" | "right" }) {
  const colors = useColors();
  return (
    <View style={[styles.row, { flexDirection: dirAlign === "right" ? "row-reverse" : "row", borderColor: colors.border }]}>
      <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_500Medium", flex: 1, textAlign: dirAlign, writingDirection: dirAlign === "right" ? "rtl" : "ltr" }}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.gold }}
        thumbColor={value ? colors.background : colors.mutedForeground}
      />
    </View>
  );
}

function NumberRow({
  label,
  value,
  onChange,
  step = 1,
  dirAlign,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  dirAlign: "left" | "right";
}) {
  const colors = useColors();
  const radius = useRadius();
  const [text, setText] = React.useState(String(value));
  React.useEffect(() => {
    setText(String(value));
  }, [value]);
  return (
    <View style={[styles.row, { flexDirection: dirAlign === "right" ? "row-reverse" : "row", borderColor: colors.border }]}>
      <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_500Medium", flex: 1, textAlign: dirAlign, writingDirection: dirAlign === "right" ? "rtl" : "ltr" }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Pressable
          onPress={() => onChange(value - step)}
          style={[styles.numBtn, { backgroundColor: colors.cardElevated, borderColor: colors.border, borderRadius: radius - 8 }]}
        >
          <Feather name="minus" size={12} color={colors.gold} />
        </Pressable>
        <TextInput
          value={text}
          onChangeText={setText}
          onBlur={() => {
            const n = parseFloat(text);
            if (!isNaN(n)) onChange(n);
            else setText(String(value));
          }}
          keyboardType="decimal-pad"
          style={[styles.input, { color: colors.foreground, backgroundColor: colors.cardElevated, borderColor: colors.border, borderRadius: radius - 8 }]}
        />
        <Pressable
          onPress={() => onChange(value + step)}
          style={[styles.numBtn, { backgroundColor: colors.cardElevated, borderColor: colors.border, borderRadius: radius - 8 }]}
        >
          <Feather name="plus" size={12} color={colors.gold} />
        </Pressable>
      </View>
    </View>
  );
}

function FibLevelRow({ label, value, onChange, dirAlign }: { label: string; value: string; onChange: (v: string) => void; dirAlign: "left" | "right" }) {
  const colors = useColors();
  const radius = useRadius();
  const options = ["1.000", "1.272", "1.414", "1.618", "2.000", "2.618"];
  return (
    <View style={[styles.row, { flexDirection: dirAlign === "right" ? "row-reverse" : "row", borderColor: colors.border, alignItems: "flex-start" }]}>
      <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_500Medium", flex: 1, textAlign: dirAlign, writingDirection: dirAlign === "right" ? "rtl" : "ltr" }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, maxWidth: 200, justifyContent: "flex-end" }}>
        {options.map((o) => {
          const active = value === o;
          return (
            <Pressable
              key={o}
              onPress={() => onChange(o)}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 5,
                borderWidth: 1,
                borderColor: active ? colors.gold : colors.border,
                backgroundColor: active ? colors.gold : colors.cardElevated,
                borderRadius: radius - 8,
              }}
            >
              <Text style={{ color: active ? colors.background : colors.foreground, fontSize: 10, fontFamily: "Inter_700Bold" }}>{o}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ModeBtn({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const colors = useColors();
  const radius = useRadius();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.modeBtn,
        {
          backgroundColor: active ? colors.gold : colors.cardElevated,
          borderColor: active ? colors.gold : colors.border,
          borderRadius: radius - 6,
        },
      ]}
    >
      <Text style={{ color: active ? colors.background : colors.foreground, fontFamily: "Inter_700Bold", fontSize: 11 }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  langBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderWidth: 1.5 },
  modeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, alignItems: "center" },
  subLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.4 },
  numBtn: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth },
  input: {
    minWidth: 60,
    textAlign: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    borderWidth: StyleSheet.hairlineWidth,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
  },
});
