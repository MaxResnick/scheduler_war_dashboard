"use client";

import { useId, useMemo } from "react";

type ChartPoint = {
  timestamp: string;
  value: number;
};

type MiniAreaChartProps = {
  points: ChartPoint[];
  color?: string;
  height?: number;
};

export default function MiniAreaChart({
  points,
  color = "#38bdf8",
  height = 160
}: MiniAreaChartProps) {
  const rawId = useId();
  const gradientId = useMemo(
    () => `mini-area-gradient-${rawId.replace(/:/g, "-")}`,
    [rawId]
  );

  const path = useMemo<{
    area: string;
    line: string;
  } | null>(() => {
    if (!points.length) {
      return null;
    }

    const sorted = [...points].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const minX = new Date(sorted[0]?.timestamp ?? 0).getTime();
    const maxX = new Date(sorted[sorted.length - 1]?.timestamp ?? 0).getTime();
    const minY = Math.min(...sorted.map((p) => p.value));
    const maxY = Math.max(...sorted.map((p) => p.value));

    if (minX === maxX) {
      return null;
    }

    const yRange = maxY - minY || 1;
    const xRange = maxX - minX || 1;

    const normalizeX = (value: number) =>
      ((value - minX) / xRange) * 100;
    const normalizeY = (value: number) =>
      100 - ((value - minY) / yRange) * 100;

    const commands = sorted.map((point, index) => {
      const x = normalizeX(new Date(point.timestamp).getTime());
      const y = normalizeY(point.value);
      return `${index === 0 ? "M" : "L"} ${x},${y}`;
    });

    const lastPoint = sorted[sorted.length - 1];
    const firstPoint = sorted[0];

    const areaPath = [
      ...commands,
      `L ${normalizeX(new Date(lastPoint.timestamp).getTime())},100`,
      `L ${normalizeX(new Date(firstPoint.timestamp).getTime())},100`,
      "Z"
    ];

    return {
      area: areaPath.join(" "),
      line: commands.join(" ")
    };
  }, [points]);

  return (
    <svg
      className="w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ height }}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          x2="0"
          y1="0"
          y2="1"
        >
          <stop offset="0%" stopColor={color} stopOpacity={0.4} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {path && (
        <>
          <path
            d={path.area}
            fill={`url(#${gradientId})`}
            stroke="none"
          />
          <path
            d={path.line}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
          />
        </>
      )}
    </svg>
  );
}
