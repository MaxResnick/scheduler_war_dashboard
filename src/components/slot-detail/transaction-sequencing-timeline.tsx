"use client";

import { useMemo } from "react";
import type { SlotEntry, SlotTransaction } from "@/lib/types";

type Props = {
  entries: SlotEntry[];
  transactions: SlotTransaction[];
  slotNumber?: number;
  validatorIdentity?: string;
  validatorName?: string | null;
  validatorClient?: string | null;
};

type TxPoint = { tick: number };

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

function buildEntryBoundaries(entries: SlotEntry[]) {
  let cumulativeTx = 0;
  let tickOne = 0; // one-based PoH tick counter (0 before first tick)
  return entries.map((e) => {
    if (e.executedTransactionCount === 0) {
      tickOne += 1; // advance tick on zero-tx entry
    }
    const start = cumulativeTx;
    const end = cumulativeTx + e.executedTransactionCount - 1;
    cumulativeTx += e.executedTransactionCount;
    const currentTick = tickOne > 0 ? tickOne : 1; // clamp to 1 if no tick yet
    return {
      entryIndex: e.index,
      executed: e.executedTransactionCount,
      startTxIndex: start,
      endTxIndex: end,
      tickOne: currentTick
    };
  });
}

function tickFromIndex(
  txIndex: number,
  boundaries: ReturnType<typeof buildEntryBoundaries>
): number | null {
  const boundary = boundaries.find(
    (b) => txIndex >= b.startTxIndex && txIndex <= b.endTxIndex
  );
  return boundary ? boundary.tickOne : null;
}

function makeTickHistogram(points: TxPoint[], totalTicks: number) {
  const bins = Math.max(1, totalTicks);
  const counts = new Array(bins).fill(0);
  points.forEach((p) => {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((p.tick - 1))));
    counts[idx]++;
  });
  const maxCount = counts.length ? Math.max(...counts) : 1;
  return { counts, maxCount, bins };
}

export default function TransactionSequencingTimeline({
  entries,
  transactions,
  slotNumber,
  validatorIdentity,
  validatorName,
  validatorClient
}: Props) {
  const boundaries = useMemo(() => buildEntryBoundaries(entries), [entries]);

  const groups = useMemo(() => {
    const vote: TxPoint[] = [];
    const jito: TxPoint[] = [];
    const regular: TxPoint[] = [];

    transactions.forEach((tx) => {
      const tick = typeof tx.pohTickNumber === 'number'
        ? tx.pohTickNumber + 1
        : tickFromIndex(tx.index, boundaries) ?? null;
      if (tick == null) return;
      if (tx.isVote) vote.push({ tick });
      else if (tx.isJitoBundle) jito.push({ tick });
      else regular.push({ tick });
    });

    return { vote, jito, regular };
  }, [transactions, boundaries]);

  const maxTick = useMemo(() => {
    const all = [
      ...groups.vote.map((p) => p.tick),
      ...groups.jito.map((p) => p.tick),
      ...groups.regular.map((p) => p.tick)
    ];
    const m = all.length ? Math.max(...all) : 1;
    return Math.max(64, m); // default to 64 ticks
  }, [groups]);

  const voteHist = useMemo(() => makeTickHistogram(groups.vote, maxTick), [groups.vote, maxTick]);
  const jitoHist = useMemo(() => makeTickHistogram(groups.jito, maxTick), [groups.jito, maxTick]);
  const regHist = useMemo(() => makeTickHistogram(groups.regular, maxTick), [groups.regular, maxTick]);

  const chartWidth = 1100;
  const panelHeight = 150;
  const gap = 24;
  const padding = { top: 24, right: 24, bottom: 36, left: 24 };
  const chartHeight = padding.top + padding.bottom + panelHeight * 3 + gap * 2; // 3 panels + gaps
  const plotWidth = chartWidth - padding.left - padding.right;

  const panels = [
    { key: "vote", label: "Vote", color: { point: "#15803d", fill: "#bbf7d0" }, data: groups.vote, hist: voteHist },
    { key: "jito", label: "Jito Bundle", color: { point: "#dc2626", fill: "#fecaca" }, data: groups.jito, hist: jitoHist },
    { key: "regular", label: "Regular (non-vote)", color: { point: "#2563eb", fill: "#bfdbfe" }, data: groups.regular, hist: regHist }
  ] as const;

  function tickToX(tick: number) {
    return maxTick > 1 ? ((tick - 1) / (maxTick - 1)) * plotWidth : 0;
  }

  return (
    <div className="overflow-visible rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div className="mb-2">
        <h3 className="text-lg font-semibold">Transaction Sequencing Timeline</h3>
        <p className="text-xs text-slate-400">
          PoH tick across the slot
          {slotNumber ? ` • Slot ${slotNumber.toLocaleString()}` : ""}
          {validatorIdentity ? ` • ${validatorName || validatorIdentity}` : ""}
          {validatorClient && (
            <>
              {" • "}
              <span style={{ color: getClientColor(validatorClient) }}>{getClientDisplayName(validatorClient)}</span>
            </>
          )}
        </p>
      </div>

      <svg width={chartWidth} height={chartHeight} className="overflow-visible mx-auto block">
        <g transform={`translate(${padding.left}, ${padding.top})`}>
          {/* Vertical dotted grid at each PoH tick across all panels */}
          {(() => {
            const axisY = 3 * panelHeight + 2 * gap;
            return Array.from({ length: maxTick }, (_, i) => i + 1).map((tickVal) => {
              const x = tickToX(tickVal);
              return (
                <line
                  key={`vgrid-${tickVal}`}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={axisY}
                  stroke="rgb(71,85,105)"
                  strokeDasharray="2 4"
                  opacity={0.25}
                />
              );
            });
          })()}
          {panels.map((panel, i) => {
            const yOffset = i * (panelHeight + gap);

            return (
              <g key={panel.key}>
                <text x={0} y={yOffset + 14} textAnchor="start" className="fill-slate-300 text-sm">
                  {panel.label}
                </text>

                {/* Histogram bars by time */}
                {panel.hist.counts.map((c, bi) => {
                  const binX0 = tickToX(bi + 1);
                  const binX1 = tickToX(bi + 2);
                  const w = Math.max(0, (binX1 - binX0) - 1);
                  const h = panel.hist.maxCount ? (c / panel.hist.maxCount) * (panelHeight - 40) : 0;
                  const y = yOffset + panelHeight - h;
                  return (
                    <rect
                      key={`bar-${panel.key}-${bi}`}
                      x={binX0 + 0.5}
                      y={y}
                      width={w}
                      height={h}
                      fill={panel.color.fill}
                      opacity={0.75}
                    />
                  );
                })}

                {/* Scatter dots removed for cleaner look */}
              </g>
            );
          })}

          {/* X axis */}
          {(() => {
            const axisY = 3 * panelHeight + 2 * gap;
            return (
              <line
                x1={0}
                y1={axisY}
                x2={plotWidth}
                y2={axisY}
                stroke="rgb(148,163,184)"
                strokeWidth={1.5}
              />
            );
          })()}
          {/* tick marks at every PoH tick; labels sparsely */}
          {(() => {
            const axisY = 3 * panelHeight + 2 * gap;
            return Array.from({ length: maxTick }, (_, i) => i + 1).map((tickVal) => {
              const x = tickToX(tickVal);
              return (
                <line
                  key={`tickmark-${tickVal}`}
                  x1={x}
                  y1={axisY}
                  x2={x}
                  y2={axisY + 4}
                  stroke="rgb(148,163,184)"
                  opacity={0.7}
                />
              );
            });
          })()}
          {(() => {
            const axisY = 3 * panelHeight + 2 * gap;
            const labelStep = Math.max(1, Math.ceil(maxTick / 16));
            const labelTicks = Array.from({ length: maxTick }, (_, i) => i + 1).filter(
              (t) => t === 1 || t === maxTick || t % labelStep === 0
            );
            return labelTicks.map((tickVal) => {
              const x = tickToX(tickVal);
              return (
                <text
                  key={`ticklabel-${tickVal}`}
                  x={x}
                  y={axisY + 12}
                  textAnchor="middle"
                  className="fill-slate-400 text-xs"
                >
                  {tickVal}
                </text>
              );
            });
          })()}
          <text x={plotWidth / 2} y={3 * panelHeight + 2 * gap + 26} textAnchor="middle" className="fill-slate-300 text-sm">
            PoH Tick (#)
          </text>
        </g>
      </svg>
    </div>
  );
}
