import React from "react";
import { StyleSheet, View, type ViewProps } from "react-native";

import { useColors, useRadius } from "@/hooks/useColors";

interface Props extends ViewProps {
  elevated?: boolean;
}

export function Card({ children, style, elevated, ...rest }: Props) {
  const colors = useColors();
  const radius = useRadius();
  return (
    <View
      {...rest}
      style={[
        styles.root,
        {
          backgroundColor: elevated ? colors.cardElevated : colors.card,
          borderColor: colors.border,
          borderRadius: radius,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
