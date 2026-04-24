import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors, useRadius } from "@/hooks/useColors";

interface Props<T extends string> {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  const colors = useColors();
  const radius = useRadius();
  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: radius - 2,
        },
      ]}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              styles.item,
              {
                backgroundColor: active ? colors.primary : "transparent",
                borderRadius: radius - 4,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: active ? colors.primaryForeground : colors.mutedForeground,
                  fontFamily: active ? "Inter_700Bold" : "Inter_500Medium",
                },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    padding: 4,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  item: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
});
