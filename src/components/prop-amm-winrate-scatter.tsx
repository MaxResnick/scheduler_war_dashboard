"use client";

import { PROP_AMM_GROUPS } from "@/lib/prop-amm";
import { useMemo } from "react";

export type ValidatorWinRate = {
  validator: string;
  totalSlots: number;
  winRates: Record<string, number>;
};

type Props = {
  data: ValidatorWinRate[];
};

const COLOR_SCALE = ["#0f172a", "#1e293b", "#334155", "#475569", "#64748b", "#818cf8", "#a78bfa", "#f87171"];

function colorForRate(rate: number) {
  const clamped = Math.max(0, Math.min(1, rate));
  const idx = Math.min(COLOR_SCALE.length - 1, Math.floor(clamped * (COLOR_SCALE.length - 1)));
  return COLOR_SCALE[idx];
}

export default function PropAmmWinrateScatter({ data }: Props) {
  const cellWidth = 140;
  const cellHeight = 28;
  const padding = { top: 80, right: 180, bottom: 40, left: 220 };

  const validators = useMemo(() => data.map((d) => d.validator), [data]);
  const height = padding.top + padding.bottom + validators.length * cellHeight;
  const width = padding.left + padding.right + PROP_AMM_GROUPS.length * cellWidth;

  const cellData = useMemo(
    () =>
      data.map((entry) =>
        PROP_AMM_GROUPS.map((group) => ({
          validator: entry.validator,
          group,
          winRate: entry.totalSlots > 0 ? entry.winRates[group] ?? 0 : 0,
          totalSlots: entry.totalSlots
        }))
      ),
    [data]
  );

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
        No prop AMM oracle wins detected in this range.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">Prop AMM Win Rate Heatmap</h3>
        <p className="text-sm text-slate-400">
          Validators along the rows, prop AMM oracles along columns. Cell color encodes how often that validator allowed a given prop AMM to land the first oracle update (win rate). Darker cells mean higher win rates.
        </p>
      </div>
      <svg width={width} height={height} className="mx-auto block overflow-visible">
        <g transform={`translate(${padding.left}, ${padding.top})`}>
          {/* column headers */}
          {PROP_AMM_GROUPS.map((group, idx) => (
            <text
              key={`col-${group}`}
              x={idx * cellWidth + cellWidth / 2}
              y={-20}
              textAnchor="middle"
              className="fill-slate-300 text-sm"
            >
              {group}
            </text>
          ))}

          {/* row labels */}
          {validators.map((validator, rowIdx) => (
            <text
              key={`row-${validator}`}
              x={-20}
              y={rowIdx * cellHeight + cellHeight / 2 + 4}
              textAnchor="end"
              className="fill-slate-300 text-xs font-mono"
            >
              {validator}
            </text>
          ))}

          {/* heatmap cells */}
          {cellData.map((row, rowIdx) =>
            row.map((cell, colIdx) => {
              const x = colIdx * cellWidth;
              const y = rowIdx * cellHeight;
              const color = colorForRate(cell.winRate);
              return (
                <g key={`${cell.validator}-${cell.group}`}>
                  <rect
                    x={x}
                    y={y}
                    width={cellWidth - 4}
                    height={cellHeight - 4}
                    fill={color}
                    rx={4}
                  />
                  <text
                    x={x + (cellWidth - 4) / 2}
                    y={y + (cellHeight - 4) / 2 + 4}
                    textAnchor="middle"
                    className="fill-white text-xs font-semibold"
                  >
                    {(cell.winRate * 100).toFixed(0)}%
                  </text>
                  <title>
                    {`${cell.group} vs ${cell.validator}\nSlots: ${cell.totalSlots}\nWin rate: ${(cell.winRate * 100).toFixed(1)}%`}
                  </title>
                </g>
              );
            })
          )}
        </g>
      </svg>

      <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">0%</div>
        <div className="flex-1 h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${COLOR_SCALE.join(",")})` }} />
        <div className="flex items-center gap-2">100%</div>
      </div>
    </div>
  );
}
