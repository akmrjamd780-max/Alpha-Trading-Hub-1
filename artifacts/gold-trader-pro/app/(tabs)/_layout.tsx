import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useT } from "@/context/SettingsContext";

export default function TabLayout() {
  const colors = useColors();
  const { t } = useT();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarLabelStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 10,
          letterSpacing: 0.4,
        },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.card,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84, paddingBottom: 8 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tab_markets"),
          tabBarIcon: ({ color, size }) => (
            <Feather name="grid" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="charts"
        options={{
          title: t("tab_charts"),
          tabBarIcon: ({ color, size }) => (
            <Feather name="bar-chart-2" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="strategies"
        options={{
          title: t("tab_strategies"),
          tabBarIcon: ({ color, size }) => (
            <Feather name="cpu" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="signals"
        options={{
          title: t("tab_signals"),
          tabBarIcon: ({ color, size }) => (
            <Feather name="zap" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: t("tab_journal"),
          tabBarIcon: ({ color, size }) => (
            <Feather name="book-open" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tab_settings"),
          tabBarIcon: ({ color, size }) => (
            <Feather name="settings" size={size - 2} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
