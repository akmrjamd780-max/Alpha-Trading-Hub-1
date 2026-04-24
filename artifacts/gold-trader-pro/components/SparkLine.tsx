import React, { useMemo } from "react";
import Svg, { Path } from "react-native-svg";

interface Props {
  values: number[];
  width: number;
  height: number;
  color: string;
  strokeWidth?: number;
}

export function SparkLine({ values, width, height, color, strokeWidth = 1.5 }: Props) {
  const d = useMemo(() => {
    if (values.length < 2) return "";
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const step = width / (values.length - 1);
    return values
      .map((v, i) => {
        const x = i * step;
        const y = height - ((v - min) / range) * height;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }, [values, width, height]);

  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={color} strokeWidth={strokeWidth} fill="none" />
    </Svg>
  );
}
