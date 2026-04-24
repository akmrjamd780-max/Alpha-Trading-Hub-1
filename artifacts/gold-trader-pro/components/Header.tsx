import React from "react";
import { Pressable, StyleSheet, Text, View, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useColors } from "@/hooks/useColors";
import { useT, useSettings } from "@/context/SettingsContext";

interface Props {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  showActions?: boolean;
}

export function ScreenHeader({ title, subtitle, right, showActions = true }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isRTL, lang } = useT();
  const { setLang } = useSettings();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 18) : insets.top;

  return (
    <LinearGradient
      colors={[colors.background, colors.card]}
      style={[
        styles.root,
        { paddingTop: topPad + 14, borderBottomColor: colors.border },
      ]}
    >
      <View
        style={[
          styles.row,
          { flexDirection: isRTL ? "row-reverse" : "row" },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.title,
              {
                color: colors.foreground,
                writingDirection: isRTL ? "rtl" : "ltr",
                textAlign: isRTL ? "right" : "left",
              },
            ]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[
                styles.subtitle,
                {
                  color: colors.mutedForeground,
                  writingDirection: isRTL ? "rtl" : "ltr",
                  textAlign: isRTL ? "right" : "left",
                },
              ]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        {showActions && (
          <View style={[styles.actions, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Pressable
              onPress={() => setLang(lang === "ar" ? "en" : "ar")}
              style={[styles.iconBtn, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}
            >
              <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 11 }}>
                {lang === "ar" ? "EN" : "ع"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/settings")}
              style={[styles.iconBtn, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}
            >
              <Feather name="settings" size={14} color={colors.gold} />
            </Pressable>
          </View>
        )}

        {right}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    alignItems: "center",
    gap: 10,
  },
  actions: {
    alignItems: "center",
    gap: 6,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
    letterSpacing: 0.3,
  },
});
