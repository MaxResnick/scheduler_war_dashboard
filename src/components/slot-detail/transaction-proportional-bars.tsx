"use client";

import { useMemo } from "react";
import type { SlotTransaction } from "@/lib/types";

type Props = {
  transactions: SlotTransaction[];
  slotNumber?: number;
  validatorIdentity?: string;
  validatorName?: string | null;
  validatorClient?: string | null;
};

type BarDatum = {
  index: number;
  value: number; // base for width
  isJito: boolean;
};

const SCHEDULER_COLORS: Record<string, string> = {
  "AgaveBam": "#7C3AED",
  "Agave": "#2C3316",
  "JitoLabs": "#5F288D",
  "Frankendancer": "#fb923c",
  "Firedancer": "#ef4444",
  "AgavePaladin": "#facc15",
  "Harmonic": "#F5F2EB",
  "Unknown": "#64748b",
};

function getClientDisplayName(softwareClient: string): string {
  if (softwareClient === "JitoLabs") return "Jito Agave";
  if (softwareClient === "AgaveBam") return "BAM";
  return softwareClient;
}

function getClientColor(softwareClient: string): string {
  return SCHEDULER_COLORS[softwareClient] ?? "#64748b";
}

function makeBars(tx: SlotTransaction[], pick: (t: SlotTransaction) => number | null) {
  const series: BarDatum[] = tx
    .filter((t) => !t.isVote) // exclude vote transactions
    .map((t) => ({
      index: t.index,
      value: Math.max(0, pick(t) ?? 0),
      // Use the bundle-derived flag only
      isJito: Boolean(t.isJitoBundle)
    }));
  const total = series.reduce((a, b) => a + b.value, 0);
  return { series, total };
}

export default function TransactionProportionalBars({
  transactions,
  slotNumber,
  validatorIdentity,
  validatorName,
  validatorClient
}: Props) {
  const width = 1100;
  const height = 380;
  const padding = { top: 16, right: 24, bottom: 28, left: 24 };
  const plotWidth = width - padding.left - padding.right;
  const rowH = 150; // per panel

  const cu = useMemo(
    () => makeBars(transactions, (t) => t.computeUnitsConsumed),
    [transactions]
  );
  const fees = useMemo(
    () => makeBars(transactions, (t) => t.rewardLamports ?? (t.feeLamports ?? 0)),
    [transactions]
  );

  // Solid colors (non-pastel) for stronger contrast
  const jitoColor = "#ef4444"; // red-500
  const nonJitoColor = "#60a5fa"; // blue-400

  function renderPanel(
    yOffset: number,
    data: ReturnType<typeof makeBars>,
    title: string,
    unitLabel: string,
    sortByValue = false
  ) {
    // Optionally sort by value (descending)
    const series = sortByValue
      ? [...data.series].sort((a, b) => b.value - a.value)
      : data.series;

    // Avoid division by zero
    const total = Math.max(data.total, 1);
    let x = 0;
    const barY = yOffset + (slotNumber ? 48 : 32);
    const barHeight = rowH - (slotNumber ? 72 : 56);
    // solid colors, no cycling needed

    // No per-segment labels per request; keep structure for possible future use

    return (
      <g>
        {/* header row */}
        <text x={plotWidth / 2} y={yOffset + 14} textAnchor="middle" className="fill-slate-200 text-base font-semibold">
          {title}
        </text>
        {slotNumber && (
          <text
            x={plotWidth / 2}
            y={yOffset + 32}
            textAnchor="middle"
            className="fill-slate-400 text-xs"
          >
            Slot {slotNumber.toLocaleString()}
            {validatorIdentity ? ` • ${validatorName || validatorIdentity}` : ""}
            {validatorClient ? ` • ` : ""}
            {validatorClient && (
              <tspan fill={getClientColor(validatorClient)}>{getClientDisplayName(validatorClient)}</tspan>
            )}
          </text>
        )}

        {/* bars */}
        {series.map((d, i) => {
          const w = (d.value / total) * plotWidth;
          const color = d.isJito ? jitoColor : nonJitoColor;
          const rect = (
            <rect
              key={`seg-${i}`}
              x={x}
              y={barY}
              width={Math.max(0, w)}
              height={barHeight}
              fill={color}
              opacity={0.75}
            />
          );
          const ix = x + w / 2;
          x += w;
          return (
            <g key={`g-${i}`}
             >
              {rect}
            </g>
          );
        })}
        {/* ticks removed for a cleaner look */}
      </g>
    );
  }

  return (
    <div className="overflow-visible rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <svg width={width} height={height} className="overflow-visible mx-auto block">
        <g transform={`translate(${padding.left}, ${padding.top})`}>
          {renderPanel(0, cu, "Compute Units", "Compute Units", true)}
          {renderPanel(rowH + 32, fees, "Validator Rewards", "Validator Rewards", true)}
        </g>
      </svg>

      {/* legend */}
      <div className="mt-2 flex items-center gap-6 text-xs text-slate-400">
        <div className="flex items-center gap-2"><span className="inline-block h-2 w-4 rounded-sm" style={{backgroundColor: jitoColor}}></span>Jito bundle</div>
        <div className="flex items-center gap-2"><span className="inline-block h-2 w-4 rounded-sm" style={{backgroundColor: nonJitoColor}}></span>Regular transactions</div>
      </div>
    </div>
  );
}
