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
import { useT, useSettings, type EngineMode, type SLMethod, type TPMethod } from "@/context/SettingsContext";

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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t("settings_title")} subtitle={lang === "ar" ? "تخصيص محرك التحليل" : "Customize the analysis engine"} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 12 }}>
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
            onChange={(v) => update({ swingLength: Math.max(2, Math.min(20, Math.round(v))) })}
            dirAlign={dirAlign}
          />
          <SwitchRow
            label={t("enable_wall")}
            value={settings.enableWall}
            onChange={(v) => update({ enableWall: v })}
            dirAlign={dirAlign}
          />
          <SwitchRow
            label={t("enable_war_zone")}
            value={settings.enableWarZone}
            onChange={(v) => update({ enableWarZone: v })}
            dirAlign={dirAlign}
          />
        </Section>

        {/* Fibonacci */}
        <Section title={t("fibonacci")} dirAlign={dirAlign}>
          <SwitchRow
            label={t("use_golden_zone")}
            value={settings.useGoldenZone}
            onChange={(v) => update({ useGoldenZone: v })}
            dirAlign={dirAlign}
          />
        </Section>

        {/* Breakouts */}
        <Section title={t("breakouts")} dirAlign={dirAlign}>
          <SwitchRow
            label={t("enable_orb")}
            value={settings.enableOrb}
            onChange={(v) => update({ enableOrb: v })}
            dirAlign={dirAlign}
          />
        </Section>

        {/* Engine */}
        <Section title={t("engine")} dirAlign={dirAlign}>
          <Text style={[styles.subLabel, { color: colors.mutedForeground, textAlign: dirAlign }]}>
            {t("engine_mode")}
          </Text>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
            {(["fast", "balanced", "slow"] as EngineMode[]).map((m) => {
              const active = settings.engineMode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => update({ engineMode: m })}
                  style={[
                    styles.modeBtn,
                    {
                      backgroundColor: active ? colors.gold : colors.cardElevated,
                      borderColor: active ? colors.gold : colors.border,
                      borderRadius: radius - 6,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? colors.background : colors.foreground,
                      fontFamily: "Inter_700Bold",
                      fontSize: 11,
                    }}
                  >
                    {m === "fast" ? t("mode_fast") : m === "slow" ? t("mode_slow") : t("mode_balanced")}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* Mandatory filters */}
        <Section title={t("mandatory_filters")} dirAlign={dirAlign}>
          <NumberRow
            label={t("adx_threshold")}
            value={settings.adxThreshold}
            onChange={(v) => update({ adxThreshold: Math.max(10, Math.min(60, Math.round(v))) })}
            dirAlign={dirAlign}
          />
          <NumberRow
            label={t("spike_filter")}
            value={settings.spikeFilterMult}
            step={0.1}
            onChange={(v) => update({ spikeFilterMult: Math.max(1, Math.min(5, Math.round(v * 10) / 10)) })}
            dirAlign={dirAlign}
          />
        </Section>

        {/* Optional filters */}
        <Section title={t("optional_filters")} dirAlign={dirAlign}>
          <SwitchRow label={t("use_mtf_filter")} value={settings.useMtfFilter} onChange={(v) => update({ useMtfFilter: v })} dirAlign={dirAlign} />
          <SwitchRow label={t("use_vwap_filter")} value={settings.useVwapFilter} onChange={(v) => update({ useVwapFilter: v })} dirAlign={dirAlign} />
          <SwitchRow label={t("use_macd_div_filter")} value={settings.useMacdDivFilter} onChange={(v) => update({ useMacdDivFilter: v })} dirAlign={dirAlign} />
          <SwitchRow label={t("use_dxy_filter")} value={settings.useDxyFilter} onChange={(v) => update({ useDxyFilter: v })} dirAlign={dirAlign} />
          <SwitchRow label={t("use_moon_filter")} value={settings.useMoonFilter} onChange={(v) => update({ useMoonFilter: v })} dirAlign={dirAlign} />
        </Section>

        {/* Early warning */}
        <Section title={t("early_warning")} dirAlign={dirAlign}>
          <SwitchRow
            label={t("enable_early_warning")}
            value={settings.enableEarlyWarning}
            onChange={(v) => update({ enableEarlyWarning: v })}
            dirAlign={dirAlign}
          />
        </Section>

        {/* Risk management */}
        <Section title={t("risk_management")} dirAlign={dirAlign}>
          <Text style={[styles.subLabel, { color: colors.mutedForeground, textAlign: dirAlign, marginBottom: 6 }]}>
            {t("sl_method")}
          </Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {(["structural", "atr", "fib"] as SLMethod[]).map((m) => {
              const active = settings.slMethod === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => update({ slMethod: m })}
                  style={[
                    styles.modeBtn,
                    {
                      backgroundColor: active ? colors.gold : colors.cardElevated,
                      borderColor: active ? colors.gold : colors.border,
                      borderRadius: radius - 6,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? colors.background : colors.foreground,
                      fontFamily: "Inter_700Bold",
                      fontSize: 11,
                    }}
                  >
                    {m === "structural" ? t("method_structural") : m === "atr" ? t("method_atr") : t("method_fib")}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.subLabel, { color: colors.mutedForeground, textAlign: dirAlign, marginTop: 12, marginBottom: 6 }]}>
            {t("tp_method")}
          </Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {(["structural", "fib"] as TPMethod[]).map((m) => {
              const active = settings.tpMethod === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => update({ tpMethod: m })}
                  style={[
                    styles.modeBtn,
                    {
                      backgroundColor: active ? colors.gold : colors.cardElevated,
                      borderColor: active ? colors.gold : colors.border,
                      borderRadius: radius - 6,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? colors.background : colors.foreground,
                      fontFamily: "Inter_700Bold",
                      fontSize: 11,
                    }}
                  >
                    {m === "structural" ? t("method_structural") : t("method_fib")}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ marginTop: 10 }}>
            <SwitchRow
              label={t("use_trailing")}
              value={settings.useTrailing}
              onChange={(v) => update({ useTrailing: v })}
              dirAlign={dirAlign}
            />
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
          <Text
            style={{
              color: colors.gold,
              fontSize: 11,
              fontFamily: "Inter_700Bold",
              marginTop: 8,
              textAlign: dirAlign,
            }}
          >
            v1.0.0
          </Text>
        </Section>

        <Pressable
          onPress={handleReset}
          style={[
            styles.resetBtn,
            { borderColor: colors.bearish, borderRadius: radius - 4, backgroundColor: colors.cardElevated },
          ]}
        >
          <Feather name="rotate-ccw" size={14} color={colors.bearish} />
          <Text style={{ color: colors.bearish, fontFamily: "Inter_700Bold", fontSize: 13 }}>
            {t("reset_settings")}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
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
          style={[
            styles.input,
            { color: colors.foreground, backgroundColor: colors.cardElevated, borderColor: colors.border, borderRadius: radius - 8 },
          ]}
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
