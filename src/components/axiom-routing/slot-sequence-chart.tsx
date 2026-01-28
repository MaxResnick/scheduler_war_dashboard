"use client";

import type { SlotData } from "@/lib/types";

// Color map matching the landing page scheduler-treemap.tsx
const SCHEDULER_COLORS: Record<string, string> = {
  "AgaveBam": "#7C3AED",      // purple
  "JitoLabs": "#5F288D",      // darker purple
  "Frankendancer": "#fb923c", // orange
  "Harmonic": "#F5F2EB",      // cream/white
};

// Display name mapping
function getDisplayName(validatorType: string): string {
  if (validatorType === "JitoLabs") return "Jito";
  if (validatorType === "AgaveBam") return "BAM";
  if (validatorType === "Frankendancer") return "FD";
  return validatorType;
}

function getColor(validatorType: string): string {
  return SCHEDULER_COLORS[validatorType] ?? "#64748b";
}

// Aggregate chart component - shows averaged data across multiple transitions
type AggregateChartProps = {
  sequences: SlotData[][];
  title: string;
  showAxiom?: boolean; // true = axiom tx, false = total tx
  height?: number;
  count: number;
};

export function AggregateTransitionChart({
  sequences,
  title,
  showAxiom = true,
  height = 100,
  count
}: AggregateChartProps) {
  if (sequences.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-600 text-xs">
        No data
      </div>
    );
  }

  const maxLen = Math.max(...sequences.map(s => s.length));
  if (maxLen === 0) return null;

  // Calculate average tx count at each position
  const positionData: { avgValue: number; dominantType: string }[] = [];

  for (let i = 0; i < maxLen; i++) {
    const values: number[] = [];
    const typeFreq = new Map<string, number>();

    for (const seq of sequences) {
      if (i < seq.length) {
        const slot = seq[i];
        values.push(showAxiom ? slot.axiomTxCount : slot.totalTxCount);
        typeFreq.set(slot.validatorType, (typeFreq.get(slot.validatorType) ?? 0) + 1);
      }
    }

    const avgValue = values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : 0;

    // Find most common type
    let dominantType = "Unknown";
    let maxFreq = 0;
    Array.from(typeFreq.entries()).forEach(([type, freq]) => {
      if (freq > maxFreq) {
        maxFreq = freq;
        dominantType = type;
      }
    });

    positionData.push({ avgValue, dominantType });
  }

  const maxValue = Math.max(...positionData.map(p => p.avgValue), 1);
  const barWidth = 100 / maxLen;
  const barGap = 1.5;
  const transitionIdx = 3; // Position 3 is the "from" slot

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] font-medium text-slate-300 truncate">{title}</div>
        <div className="text-[9px] text-slate-500">{count}</div>
      </div>

      <div className="flex-1 relative" style={{ minHeight: height }}>
        <svg
          className="w-full h-full"
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
        >
          {/* Transition line */}
          <line
            x1={(transitionIdx + 1) * barWidth}
            y1={0}
            x2={(transitionIdx + 1) * barWidth}
            y2={height}
            stroke="#fbbf24"
            strokeWidth={0.3}
            strokeDasharray="1,1"
          />

          {/* Bars */}
          {positionData.map((pd, idx) => {
            const barHeight = (pd.avgValue / maxValue) * (height - 15);
            const x = idx * barWidth + barGap / 2;
            const y = height - barHeight - 8;
            const color = getColor(pd.dominantType);

            return (
              <rect
                key={idx}
                x={`${x}%`}
                y={Math.max(0, y)}
                width={`${barWidth - barGap}%`}
                height={Math.max(0, barHeight)}
                fill={color}
                opacity={0.9}
                rx={0.5}
              />
            );
          })}
        </svg>
      </div>

      {/* X-axis labels - simplified */}
      <div className="flex justify-between text-[8px] text-slate-600 mt-0.5">
        {positionData.map((pd, idx) => {
          const label = idx - transitionIdx;
          return (
            <div
              key={idx}
              className="flex flex-col items-center"
              style={{ width: `${barWidth}%` }}
            >
              <span className={idx === transitionIdx ? "text-yellow-500" : ""}>
                {label === 0 ? "0" : label > 0 ? `+${label}` : label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Export default for backwards compatibility
export default function SlotSequenceChart() {
  return null;
}
