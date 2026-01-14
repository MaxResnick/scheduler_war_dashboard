"use client";

import { useMemo } from "react";
import type { SlotEntry } from "@/lib/types";

type Props = {
  entries: SlotEntry[];
  slotNumber: number | null;
};

export default function GeyserEntryPlot({ entries, slotNumber }: Props) {
  const hasData = entries.length > 0;
  const chartWidth = 1200;
  const chartHeight = 360;
  const padding = { top: 32, right: 28, bottom: 64, left: 52 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  const { minIndex, maxIndex, maxTx, zeroIndices } = useMemo(() => {
    const indices = entries.map((e) => e.index);
    const txCounts = entries.map((e) => e.executedTransactionCount);
    return {
      minIndex: indices.length ? Math.min(...indices) : 0,
      maxIndex: indices.length ? Math.max(...indices) : 1,
      maxTx: txCounts.length ? Math.max(1, ...txCounts, 1) : 1,
      zeroIndices: entries
        .filter((e) => e.executedTransactionCount === 0)
        .map((e) => e.index)
    };
  }, [entries]);

  const span = Math.max(1, maxIndex - minIndex);
  const xForEntry = (index: number) => {
    if (!hasData) return 0;
    return ((index - minIndex) / span) * plotWidth;
  };

  const barWidth = useMemo(() => {
    if (!hasData) return 0;
    const spacing = plotWidth / Math.max(entries.length, 1);
    return Math.max(2, spacing * 0.7);
  }, [entries.length, hasData, plotWidth]);

  const xTicks = useMemo(() => {
    if (!hasData) return [];
    const tickCount = 8;
    const step = Math.max(1, Math.round(span / (tickCount - 1)));
    const ticks = [];
    for (let v = minIndex; v <= maxIndex; v += step) {
      ticks.push(v);
    }
    if (ticks[ticks.length - 1] !== maxIndex) ticks.push(maxIndex);
    return ticks;
  }, [hasData, maxIndex, minIndex, span]);

  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-50">Geyser Entries Trace</h3>
          <p className="text-sm text-slate-400">
            Bars show executed transactions per entry; dotted lines mark PoH tick entries with zero transactions.
          </p>
        </div>
        <div className="text-right text-xs text-slate-400">
          <div>Slot: {slotNumber ?? "—"}</div>
          <div className="mt-1">
            Entries: {entries.length.toLocaleString()} · Zero-tx entries: {zeroIndices.length.toLocaleString()}
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-6 text-sm text-slate-400">
          No geyser entries available for this slot.
        </div>
      ) : (
        <svg width={chartWidth} height={chartHeight} className="overflow-visible mx-auto block">
          <defs>
            <linearGradient id="entryBar" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.65" />
            </linearGradient>
          </defs>
          <g transform={`translate(${padding.left}, ${padding.top})`}>
            {/* Horizontal grid */}
            {yTicks.map((f) => {
              const y = plotHeight - f * plotHeight;
              return (
                <line
                  key={`h-${f}`}
                  x1={0}
                  y1={y}
                  x2={plotWidth}
                  y2={y}
                  stroke="rgb(71,85,105)"
                  strokeWidth={1}
                  opacity={0.35}
                />
              );
            })}

            {/* Dotted guides for zero-tx entries */}
            {zeroIndices.map((idx) => {
              const x = xForEntry(idx);
              return (
                <line
                  key={`zero-${idx}`}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={plotHeight}
                  stroke="rgb(248,250,252)"
                  strokeDasharray="3 6"
                  opacity={0.5}
                >
                  <title>Entry {idx}: PoH tick / no executed transactions</title>
                </line>
              );
            })}

            {/* Entry bars */}
            {entries.map((entry) => {
              const x = xForEntry(entry.index) - barWidth / 2;
              const h = (entry.executedTransactionCount / maxTx) * plotHeight;
              const y = plotHeight - h;
              return (
                <rect
                  key={`bar-${entry.index}`}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(2, h)}
                  fill="url(#entryBar)"
                  opacity={entry.executedTransactionCount === 0 ? 0.35 : 0.9}
                >
                  <title>
                    Entry {entry.index}: {entry.executedTransactionCount} tx
                  </title>
                </rect>
              );
            })}

            {/* X axis */}
            <line
              x1={0}
              y1={plotHeight}
              x2={plotWidth}
              y2={plotHeight}
              stroke="rgb(148,163,184)"
              strokeWidth={1.5}
            />
            {xTicks.map((tick) => {
              const x = xForEntry(tick);
              return (
                <g key={`xt-${tick}`}>
                  <line x1={x} y1={plotHeight} x2={x} y2={plotHeight + 6} stroke="rgb(148,163,184)" />
                  <text
                    x={x}
                    y={plotHeight + 22}
                    textAnchor="middle"
                    className="fill-slate-400 text-xs"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}
            <text
              x={plotWidth / 2}
              y={plotHeight + 42}
              textAnchor="middle"
              className="fill-slate-300 text-sm"
            >
              Entry index (geyser)
            </text>

            {/* Y axis */}
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={plotHeight}
              stroke="rgb(148,163,184)"
              strokeWidth={1.5}
            />
            {yTicks.map((f) => {
              const y = plotHeight - f * plotHeight;
              const label = Math.round(f * maxTx);
              return (
                <g key={`yt-${f}`}>
                  <line x1={-6} y1={y} x2={0} y2={y} stroke="rgb(148,163,184)" />
                  <text x={-10} y={y + 4} textAnchor="end" className="fill-slate-400 text-xs">
                    {label}
                  </text>
                </g>
              );
            })}
            <text
              x={-plotHeight / 2}
              y={-34}
              textAnchor="middle"
              transform={`rotate(-90, ${-plotHeight / 2}, -34)`}
              className="fill-slate-300 text-sm"
            >
              Executed transactions
            </text>
          </g>
        </svg>
      )}
    </div>
  );
}
