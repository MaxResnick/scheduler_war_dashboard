"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import SchedulerTreemap from "@/components/scheduler-treemap";
import EthStakerTreemap from "@/components/eth-staker-treemap";
import ValidatorListExport from "@/components/validator-list-export";
import type { ValidatorData } from "@/lib/types";
import type { EthStaker } from "@/lib/eth-stakers";

type Network = "solana" | "ethereum";

type Props = {
  solanaValidators: ValidatorData[];
  ethStakers: EthStaker[];
};

type CumulativePoint = { index: number; cumulativePct: number };

function buildCumulativeCurve(
  items: { stake: number }[]
): CumulativePoint[] {
  const sorted = [...items].sort((a, b) => b.stake - a.stake);
  const total = sorted.reduce((sum, s) => sum + s.stake, 0);
  if (total === 0) return [];
  let cumulative = 0;
  return sorted.map((s, i) => {
    cumulative += s.stake;
    return { index: i + 1, cumulativePct: (cumulative / total) * 100 };
  });
}

export default function NetworkTreemapToggle({ solanaValidators, ethStakers }: Props) {
  const [network, setNetwork] = useState<Network>("solana");
  const [containerWidth, setContainerWidth] = useState(1200);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const solanaCurve = useMemo(
    () => buildCumulativeCurve(solanaValidators.map((v) => ({ stake: v.activeStake }))),
    [solanaValidators]
  );

  const ethCurve = useMemo(
    () =>
      buildCumulativeCurve(
        ethStakers
          .filter((s) => s.category !== "Unidentified")
          .map((s) => ({ stake: s.amountStaked }))
      ),
    [ethStakers]
  );

  const maxEntities = Math.max(solanaCurve.length, ethCurve.length, 1);

  return (
    <div ref={containerRef}>
      <div className="flex flex-col gap-8">
        {/* Toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-anza-border bg-anza-surface p-1 w-fit">
          <button
            onClick={() => setNetwork("solana")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              network === "solana"
                ? "bg-anza-green text-anza-bg"
                : "text-anza-green-muted hover:text-anza-green"
            }`}
          >
            Solana
          </button>
          <button
            onClick={() => setNetwork("ethereum")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              network === "ethereum"
                ? "bg-anza-green text-anza-bg"
                : "text-anza-green-muted hover:text-anza-green"
            }`}
          >
            Ethereum
          </button>
        </div>

        {network === "solana" ? (
          <>
            <SchedulerTreemap validators={solanaValidators} />
            <ValidatorListExport validators={solanaValidators} />
          </>
        ) : (
          <EthStakerTreemap stakers={ethStakers} />
        )}

        {/* Cumulative Stake Comparison Chart */}
        {solanaCurve.length > 0 && ethCurve.length > 0 &&
          (() => {
            const chartW = containerWidth;
            const chartH = 350;
            const pad = { top: 30, right: 30, bottom: 55, left: 60 };
            const plotW = chartW - pad.left - pad.right;
            const plotH = chartH - pad.top - pad.bottom;

            const logMin = 0; // log10(1) = 0
            const logMax = Math.log10(maxEntities);

            function xForEntity(entity: number): number {
              if (entity <= 1) return pad.left;
              return pad.left + (Math.log10(entity) / logMax) * plotW;
            }

            function buildPath(curve: CumulativePoint[]): string {
              return curve
                .map((d, i) => {
                  const x = xForEntity(d.index);
                  const y = pad.top + plotH - (d.cumulativePct / 100) * plotH;
                  return `${i === 0 ? "M" : "L"}${x},${y}`;
                })
                .join("");
            }

            const solanaPath = buildPath(solanaCurve);
            const ethPath = buildPath(ethCurve);

            const solanaColor = "#9945FF";
            const ethColor = "#3D3E3F";

            // Y-axis: horizontal lines at 33% and 66%
            const yRefLines = [33, 66];
            const yTicks = [0, 25, 50, 75, 100];

            // X-axis: log-scale ticks at powers of 10 and intermediate values
            const xTickValues: number[] = [];
            for (let p = 0; p <= Math.ceil(logMax); p++) {
              const val = Math.pow(10, p);
              if (val <= maxEntities) xTickValues.push(val);
            }

            return (
              <div className="overflow-hidden rounded-lg border border-anza-border bg-anza-surface p-4">
                <h3 className="mb-2 text-lg font-semibold">
                  Cumulative Stake Distribution — Solana vs Ethereum
                </h3>
                <p className="mb-3 text-xs text-anza-green-muted">
                  Entities ranked by stake (largest first). Ethereum excludes unidentified stakers.
                  Log scale on x-axis.
                </p>
                <svg width={chartW} height={chartH} className="block">
                  {/* Y grid lines */}
                  {yTicks.map((pct) => {
                    const y = pad.top + plotH - (pct / 100) * plotH;
                    return (
                      <g key={`y-${pct}`}>
                        <line
                          x1={pad.left}
                          y1={y}
                          x2={pad.left + plotW}
                          y2={y}
                          stroke="rgb(71,85,105)"
                          strokeDasharray="2 4"
                          opacity={0.2}
                        />
                        <text
                          x={pad.left - 8}
                          y={y}
                          textAnchor="end"
                          dominantBaseline="middle"
                          className="fill-anza-green-muted text-[11px]"
                        >
                          {pct}%
                        </text>
                      </g>
                    );
                  })}

                  {/* 33% and 66% reference lines */}
                  {yRefLines.map((pct) => {
                    const y = pad.top + plotH - (pct / 100) * plotH;
                    return (
                      <line
                        key={`ref-${pct}`}
                        x1={pad.left}
                        y1={y}
                        x2={pad.left + plotW}
                        y2={y}
                        stroke="#f59e0b"
                        strokeDasharray="6 4"
                        opacity={0.5}
                      />
                    );
                  })}

                  {/* X-axis ticks (log scale) */}
                  {xTickValues.map((count) => {
                    const x = xForEntity(count);
                    return (
                      <g key={`x-${count}`}>
                        <line
                          x1={x}
                          y1={pad.top + plotH}
                          x2={x}
                          y2={pad.top + plotH + 6}
                          stroke="rgb(71,85,105)"
                          opacity={0.5}
                        />
                        <line
                          x1={x}
                          y1={pad.top}
                          x2={x}
                          y2={pad.top + plotH}
                          stroke="rgb(71,85,105)"
                          strokeDasharray="2 4"
                          opacity={0.1}
                        />
                        <text
                          x={x}
                          y={pad.top + plotH + 20}
                          textAnchor="middle"
                          className="fill-anza-green-muted text-[11px]"
                        >
                          {count.toLocaleString()}
                        </text>
                      </g>
                    );
                  })}

                  {/* Axis labels */}
                  <text
                    x={pad.left + plotW / 2}
                    y={chartH - 4}
                    textAnchor="middle"
                    className="fill-anza-green-mid text-xs"
                  >
                    Entities (ranked by stake, log scale)
                  </text>
                  <text
                    x={14}
                    y={pad.top + plotH / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-anza-green-mid text-xs"
                    transform={`rotate(-90, 14, ${pad.top + plotH / 2})`}
                  >
                    Cumulative Stake %
                  </text>

                  {/* Solana curve */}
                  <path d={solanaPath} fill="none" stroke={solanaColor} strokeWidth={2.5} />

                  {/* Ethereum curve */}
                  <path d={ethPath} fill="none" stroke={ethColor} strokeWidth={2.5} />

                  {/* Axes */}
                  <line
                    x1={pad.left}
                    y1={pad.top}
                    x2={pad.left}
                    y2={pad.top + plotH}
                    stroke="rgb(71,85,105)"
                    opacity={0.5}
                  />
                  <line
                    x1={pad.left}
                    y1={pad.top + plotH}
                    x2={pad.left + plotW}
                    y2={pad.top + plotH}
                    stroke="rgb(71,85,105)"
                    opacity={0.5}
                  />

                  {/* Legend */}
                  <g>
                    <line
                      x1={pad.left + plotW - 160}
                      y1={pad.top + 12}
                      x2={pad.left + plotW - 130}
                      y2={pad.top + 12}
                      stroke={solanaColor}
                      strokeWidth={2.5}
                    />
                    <text
                      x={pad.left + plotW - 125}
                      y={pad.top + 12}
                      dominantBaseline="middle"
                      className="fill-anza-green text-[12px] font-medium"
                    >
                      Solana ({solanaCurve.length.toLocaleString()})
                    </text>
                    <line
                      x1={pad.left + plotW - 160}
                      y1={pad.top + 30}
                      x2={pad.left + plotW - 130}
                      y2={pad.top + 30}
                      stroke={ethColor}
                      strokeWidth={2.5}
                    />
                    <text
                      x={pad.left + plotW - 125}
                      y={pad.top + 30}
                      dominantBaseline="middle"
                      className="fill-anza-green text-[12px] font-medium"
                    >
                      Ethereum ({ethCurve.length.toLocaleString()})
                    </text>
                    <line
                      x1={pad.left + plotW - 160}
                      y1={pad.top + 48}
                      x2={pad.left + plotW - 130}
                      y2={pad.top + 48}
                      stroke="#f59e0b"
                      strokeWidth={1.5}
                      strokeDasharray="6 4"
                    />
                    <text
                      x={pad.left + plotW - 125}
                      y={pad.top + 48}
                      dominantBaseline="middle"
                      className="fill-anza-green-muted text-[12px]"
                    >
                      33% / 66%
                    </text>
                  </g>
                </svg>
              </div>
            );
          })()}
      </div>
    </div>
  );
}
