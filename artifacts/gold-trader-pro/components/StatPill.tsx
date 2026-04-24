import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors, useRadius } from "@/hooks/useColors";

interface Props {
  label: string;
  value: string;
  tone?: "neutral" | "bull" | "bear" | "gold";
}

export function StatPill({ label, value, tone = "neutral" }: Props) {
  const colors = useColors();
  const radius = useRadius();
  const valueColor =
    tone === "bull"
      ? colors.bullish
      : tone === "bear"
      ? colors.bearish
      : tone === "gold"
      ? colors.gold
      : colors.foreground;
  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: radius - 4,
        },
      ]}
    >
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  value: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    marginTop: 4,
    letterSpacing: -0.2,
  },
});
