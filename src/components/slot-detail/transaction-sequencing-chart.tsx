"use client";

import { useMemo } from "react";
import type { SlotEntry, SlotTransaction } from "@/lib/types";

type TransactionSequencingChartProps = {
  entries: SlotEntry[];
  transactions: SlotTransaction[];
  slotNumber?: number;
  validatorIdentity?: string;
};

type CumulativeData = {
  tick: number; // 1-based PoH tick number
  cumulativeVotes: number;
  cumulativeJito: number;
  cumulativeRegular: number;
};

export default function TransactionSequencingChart({
  entries,
  transactions,
  slotNumber,
  validatorIdentity
}: TransactionSequencingChartProps) {
  const chartWidth = 1200;
  const chartHeight = 500;
  const padding = { top: 40, right: 40, bottom: 60, left: 24 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  // Build cumulative counts per PoH tick (1..64) based on tx -> tick mapping
  const { cumulativeData, maxTick } = useMemo(() => {
    if (transactions.length === 0) return { cumulativeData: [] as CumulativeData[], maxTick: 1 };

    // Determine tick for each transaction (prefer server-provided mapping)
    const ticks = transactions
      .map((tx) => (typeof tx.pohTickNumber === "number" ? tx.pohTickNumber + 1 : null))
      .filter((t): t is number => !!t && t > 0);

    let maxTick = Math.max(64, ticks.length ? Math.max(...ticks) : 1);

    const votesPerTick = new Array(maxTick + 1).fill(0);
    const jitoPerTick = new Array(maxTick + 1).fill(0);
    const regularPerTick = new Array(maxTick + 1).fill(0);

    transactions.forEach((tx) => {
      const tick = typeof tx.pohTickNumber === "number" ? tx.pohTickNumber + 1 : null;
      if (!tick || tick < 1 || tick > maxTick) return;
      if (tx.isVote) votesPerTick[tick]++;
      else if (tx.isJitoBundle) jitoPerTick[tick]++;
      else regularPerTick[tick]++;
    });

    const data: CumulativeData[] = [];
    let cumVotes = 0;
    let cumJito = 0;
    let cumRegular = 0;
    for (let t = 1; t <= maxTick; t++) {
      cumVotes += votesPerTick[t] || 0;
      cumJito += jitoPerTick[t] || 0;
      cumRegular += regularPerTick[t] || 0;
      data.push({ tick: t, cumulativeVotes: cumVotes, cumulativeJito: cumJito, cumulativeRegular: cumRegular });
    }

    return { cumulativeData: data, maxTick };
  }, [transactions]);

  const maxCumulative = useMemo(() => {
    if (cumulativeData.length === 0) return 1;
    const mv = Math.max(...cumulativeData.map((d) => d.cumulativeVotes));
    const mj = Math.max(...cumulativeData.map((d) => d.cumulativeJito));
    const mr = Math.max(...cumulativeData.map((d) => d.cumulativeRegular));
    return Math.max(mv, mj, mr);
  }, [cumulativeData]);

  const maxTickValue = maxTick;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Cumulative Transaction Sequencing</h3>
        <p className="text-sm text-slate-400">
          Cumulative by PoH tick (#{maxTickValue})
          {slotNumber ? ` • Slot ${slotNumber.toLocaleString()}` : ""}
          {validatorIdentity ? ` • Validator ${validatorIdentity}` : ""}
        </p>
      </div>

      <svg width={chartWidth} height={chartHeight} className="overflow-visible mx-auto block">
        <g transform={`translate(${padding.left}, ${padding.top})`}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const y = plotHeight - fraction * plotHeight;
            return (
              <line
                key={fraction}
                x1={0}
                y1={y}
                x2={plotWidth}
                y2={y}
                stroke="rgb(51, 65, 85)"
                strokeWidth={1}
                opacity={0.5}
              />
            );
          })}

          {/* Regular line (blue pastel) */}
          {cumulativeData.length > 1 && (
            <polyline
              points={cumulativeData
                .map((d, i) => {
                  const x = (i / (cumulativeData.length - 1)) * plotWidth;
                  const y = plotHeight - (d.cumulativeRegular / maxCumulative) * plotHeight;
                  return `${x},${y}`;
                })
                .join(" ")}
              fill="none"
              stroke="#bfdbfe"
              strokeWidth={3}
              opacity={0.75}
            />
          )}

          {/* Jito line (red pastel) */}
          {cumulativeData.length > 1 && (
            <polyline
              points={cumulativeData
                .map((d, i) => {
                  const x = (i / (cumulativeData.length - 1)) * plotWidth;
                  const y = plotHeight - (d.cumulativeJito / maxCumulative) * plotHeight;
                  return `${x},${y}`;
                })
                .join(" ")}
              fill="none"
              stroke="#fecaca"
              strokeWidth={3}
              opacity={0.75}
            />
          )}

          {/* Votes line (green pastel) */}
          {cumulativeData.length > 1 && (
            <polyline
              points={cumulativeData
                .map((d, i) => {
                  const x = (i / (cumulativeData.length - 1)) * plotWidth;
                  const y = plotHeight - (d.cumulativeVotes / maxCumulative) * plotHeight;
                  return `${x},${y}`;
                })
                .join(" ")}
              fill="none"
              stroke="#bbf7d0"
              strokeWidth={3}
              opacity={0.75}
            />
          )}

          {/* Data points for non-votes */}
          {/* Optional data points removed for cleaner look */}

          {/* Data points for votes */}
          {}

          {/* X-axis */}
          <line
            x1={0}
            y1={plotHeight}
            x2={plotWidth}
            y2={plotHeight}
            stroke="rgb(148, 163, 184)"
            strokeWidth={2}
          />
          <text
            x={plotWidth / 2}
            y={plotHeight + 40}
            textAnchor="middle"
            className="fill-slate-300 text-sm"
          >
            PoH Tick (#)
          </text>

          {/* Y-axis */}
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={plotHeight}
            stroke="rgb(148, 163, 184)"
            strokeWidth={2}
          />
          <text
            x={-plotHeight / 2}
            y={-50}
            textAnchor="middle"
            transform={`rotate(-90, ${-plotHeight / 2}, -50)`}
            className="fill-slate-300 text-sm"
          >
            Cumulative Transactions
          </text>

          {/* X-axis ticks */}
          {cumulativeData.map((d, i) => {
            if (i % Math.ceil(cumulativeData.length / 8) !== 0) return null;
            const x = (i / (cumulativeData.length - 1)) * plotWidth;
            return (
              <g key={`xtick-${d.tick}`}>
                <line x1={x} y1={plotHeight} x2={x} y2={plotHeight + 5} stroke="rgb(148, 163, 184)" strokeWidth={1} />
                <text x={x} y={plotHeight + 20} textAnchor="middle" className="fill-slate-400 text-xs">
                  {d.tick}
                </text>
              </g>
            );
          })}

          {/* Y-axis ticks */}
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const y = plotHeight - fraction * plotHeight;
            const label = Math.round(fraction * maxCumulative);
            return (
              <g key={`ytick-${fraction}`}>
                <line
                  x1={-5}
                  y1={y}
                  x2={0}
                  y2={y}
                  stroke="rgb(148, 163, 184)"
                  strokeWidth={1}
                />
                <text
                  x={-10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-400 text-xs"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <div className="h-0.5 w-6" style={{ backgroundColor: '#bbf7d0' }} />
          <span>Votes (cumulative)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-0.5 w-6" style={{ backgroundColor: '#fecaca' }} />
          <span>Jito bundle (cumulative)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-0.5 w-6" style={{ backgroundColor: '#bfdbfe' }} />
          <span>Regular (non-vote) (cumulative)</span>
        </div>
      </div>
    </div>
  );
}
