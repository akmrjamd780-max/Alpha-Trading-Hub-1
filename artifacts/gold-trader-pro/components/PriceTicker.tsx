import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useColors, useRadius } from "@/hooks/useColors";
import { SparkLine } from "./SparkLine";

interface Props {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  sparkline?: number[];
}

export function PriceTicker({ symbol, price, change, changePct, sparkline }: Props) {
  const colors = useColors();
  const radius = useRadius();
  const up = change >= 0;
  const color = up ? colors.bullish : colors.bearish;
  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: radius,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.symbol, { color: colors.foreground }]}>{symbol}</Text>
        <Text style={[styles.price, { color: colors.foreground }]}>
          {formatPrice(price)}
        </Text>
        <View style={styles.changeRow}>
          <Feather
            name={up ? "trending-up" : "trending-down"}
            size={12}
            color={color}
          />
          <Text style={[styles.changeText, { color }]}>
            {up ? "+" : ""}
            {change.toFixed(2)} ({up ? "+" : ""}
            {changePct.toFixed(2)}%)
          </Text>
        </View>
      </View>
      {sparkline && sparkline.length > 1 ? (
        <SparkLine values={sparkline} width={70} height={36} color={color} />
      ) : null}
    </View>
  );
}

function formatPrice(p: number): string {
  if (p >= 1000) return p.toFixed(2);
  if (p >= 1) return p.toFixed(4);
  return p.toFixed(6);
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  symbol: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    opacity: 0.65,
  },
  price: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginTop: 2,
  },
  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  changeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
