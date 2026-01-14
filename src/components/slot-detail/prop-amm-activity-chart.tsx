"use client";

import { useMemo } from "react";
import type { SlotTransaction } from "@/lib/types";
import { PROP_AMM_ACCOUNTS } from "@/lib/prop-amm";

type Props = {
  transactions: SlotTransaction[];
  width?: number;
  height?: number;
  containerClassName?: string;
  title?: string;
  subtitle?: string;
  hideHeader?: boolean;
  showLegend?: boolean;
  slotNumber?: number;
  validatorIdentity?: string;
};

const COLOR_PALETTE = [
  "#38bdf8",
  "#f472b6",
  "#facc15",
  "#a78bfa",
  "#34d399",
  "#fb7185",
  "#f97316",
  "#c084fc"
];

export default function PropAmmActivityChart({
  transactions,
  width,
  height,
  containerClassName,
  title,
  subtitle,
  hideHeader = false,
  showLegend = true,
  slotNumber,
  validatorIdentity
}: Props) {
  const propTransactions = useMemo(
    () => transactions.filter((t) => !!t.propAmmAccount && !t.isVote),
    [transactions]
  );

  const accountLines = useMemo(() => {
    const count = PROP_AMM_ACCOUNTS.length || 1;
    const pointSpacing = 1 / (count + 1);
    return PROP_AMM_ACCOUNTS.map((acct, idx) => ({
      ...acct,
      yFraction: pointSpacing * (idx + 1),
      color: COLOR_PALETTE[idx % COLOR_PALETTE.length]
    }));
  }, []);

  const tickValues = useMemo(() => {
    const ticks = propTransactions
      .map((t) =>
        typeof t.pohTickNumber === "number" ? t.pohTickNumber + 1 : null
      )
      .filter((t): t is number => !!t && t > 0);
    const maxObserved = ticks.length ? Math.max(...ticks) : 0;
    return Math.max(64, maxObserved || 0);
  }, [propTransactions]);

  const cuStats = useMemo(() => {
    const values = propTransactions
      .map((t) => (typeof t.computeUnitsConsumed === "number" ? t.computeUnitsConsumed : null))
      .filter((v): v is number => v !== null && v >= 0);
    const max = values.length ? Math.max(...values) : 0;
    return { max };
  }, [propTransactions]);

  const chartWidth = width ?? 1200;
  const chartHeight = height ?? 420;
  const padding = { top: 32, right: 32, bottom: 60, left: 140 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  function xForTick(tick: number) {
    if (tickValues <= 1) return 0;
    return ((tick - 1) / (tickValues - 1)) * plotWidth;
  }

  function radiusForCU(cu: number | null | undefined) {
    const minR = 4;
    const maxR = 18;
    if (!cu || cu <= 0 || cuStats.max <= 0) return minR;
    const logMax = Math.log10(cuStats.max + 1);
    const normalized = logMax > 0 ? Math.log10(cu + 1) / logMax : 0;
    return minR + normalized * (maxR - minR);
  }

  const headerTitle = title ?? "Prop AMM Sequencing";
  const headerSubtitle =
    subtitle ??
    `PoH ticks with compute-weighted arrivals per prop AMM signer (max tick #${tickValues})${
      slotNumber ? ` • Slot ${slotNumber.toLocaleString()}` : ""
    }${validatorIdentity ? ` • Validator ${validatorIdentity}` : ""}`;

  return (
    <div className={`overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40 p-6 ${containerClassName ?? ""}`}>
      {!hideHeader && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold">{headerTitle}</h3>
          <p className="text-sm text-slate-400">{headerSubtitle}</p>
        </div>
      )}

      <svg width={chartWidth} height={chartHeight} className="mx-auto block overflow-visible">
        <g transform={`translate(${padding.left}, ${padding.top})`}>
          {/* account lines */}
          {accountLines.map((acct) => {
            const y = plotHeight * acct.yFraction;
            return (
              <g key={acct.account}>
                <line
                  x1={0}
                  x2={plotWidth}
                  y1={y}
                  y2={y}
                  stroke={acct.color}
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  opacity={0.7}
                />
                <text
                  x={-16}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-100 text-sm"
                >
                  {acct.label}
                </text>
              </g>
            );
          })}

          {/* dots */}
          {propTransactions.map((tx) => {
            if (!tx.propAmmAccount || typeof tx.pohTickNumber !== "number") return null;
            const acct = accountLines.find((a) => a.account === tx.propAmmAccount);
            if (!acct) return null;
            const tick = tx.pohTickNumber + 1;
            const x = xForTick(tick);
            const y = plotHeight * acct.yFraction;
            const radius = radiusForCU(tx.computeUnitsConsumed ?? null);
            return (
              <g key={`${tx.signature}-${tick}`} transform={`translate(${x}, ${y})`}>
                {tx.isJitoBundle ? (
                  <rect
                    x={-radius}
                    y={-radius}
                    width={radius * 2}
                    height={radius * 2}
                    fill={acct.color}
                    fillOpacity={0.8}
                  />
                ) : (
                  <circle r={radius} fill={acct.color} fillOpacity={0.8} />
                )}
                <title>
                  {`${acct.label} • Tick ${tick}\nCU used: ${tx.computeUnitsConsumed?.toLocaleString() ?? "n/a"}\nSignature: ${tx.signature}`}
                </title>
              </g>
            );
          })}

          {/* X-axis */}
          <line x1={0} y1={plotHeight} x2={plotWidth} y2={plotHeight} stroke="rgb(148, 163, 184)" strokeWidth={1.5} />

          {/* X-axis ticks */}
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const x = fraction * plotWidth;
            const tick = Math.round(1 + fraction * (tickValues - 1));
            return (
              <g key={`tick-${fraction}`}>
                <line
                  x1={x}
                  y1={plotHeight}
                  x2={x}
                  y2={plotHeight + 6}
                  stroke="rgb(148, 163, 184)"
                  strokeWidth={1}
                />
                <text x={x} y={plotHeight + 22} textAnchor="middle" className="fill-slate-400 text-xs">
                  {tick}
                </text>
              </g>
            );
          })}

          <text
            x={plotWidth / 2}
            y={plotHeight + 44}
            textAnchor="middle"
            className="fill-slate-300 text-sm"
          >
            PoH Tick (#)
          </text>
        </g>
      </svg>

      {propTransactions.length === 0 && (
        <p className="mt-4 text-center text-sm text-slate-400">
          No prop AMM transactions landed in this slot.
        </p>
      )}

      {showLegend && (
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
          {accountLines.map((acct) => (
            <div key={`legend-${acct.account}`} className="flex items-center gap-2">
              <span className="inline-block h-2 w-4 rounded-sm" style={{ backgroundColor: acct.color }} />
              {acct.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
