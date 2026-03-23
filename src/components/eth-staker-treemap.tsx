"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import type { EthStaker } from "@/lib/eth-stakers";

type Props = {
  stakers: EthStaker[];
};

type TreemapNode = {
  staker: EthStaker;
  x: number;
  y: number;
  width: number;
  height: number;
};

const STAKER_COLOR = "#3D3E3F";

function formatStake(eth: number): string {
  if (eth >= 1e6) return `${(eth / 1e6).toFixed(1)}M ETH`;
  if (eth >= 1e3) return `${(eth / 1e3).toFixed(0)}K ETH`;
  return `${eth.toFixed(0)} ETH`;
}

function layoutTreemap(
  items: { value: number; data: EthStaker }[],
  x: number,
  y: number,
  width: number,
  height: number
): TreemapNode[] {
  if (items.length === 0) return [];
  if (items.length === 1) {
    return [{ staker: items[0].data, x, y, width, height }];
  }

  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return [];

  const sorted = [...items].sort((a, b) => b.value - a.value);
  const result: TreemapNode[] = [];
  let currentX = x;
  let currentY = y;
  let remainingWidth = width;
  let remainingHeight = height;
  let remainingItems = [...sorted];
  let remainingTotal = total;

  while (remainingItems.length > 0) {
    const isHorizontal = remainingWidth >= remainingHeight;
    let rowItems: typeof items = [];
    let rowTotal = 0;
    let bestAspect = Infinity;

    for (let i = 1; i <= remainingItems.length; i++) {
      const slice = remainingItems.slice(0, i);
      const sliceTotal = slice.reduce((sum, item) => sum + item.value, 0);
      const sliceRatio = sliceTotal / remainingTotal;
      const rowSize = isHorizontal ? remainingWidth * sliceRatio : remainingHeight * sliceRatio;

      let worstAspect = 0;
      for (const item of slice) {
        const itemRatio = item.value / sliceTotal;
        const itemWidth = isHorizontal ? rowSize : remainingWidth * itemRatio;
        const itemHeight = isHorizontal ? remainingHeight * itemRatio : rowSize;
        const aspect = Math.max(itemWidth / itemHeight, itemHeight / itemWidth);
        worstAspect = Math.max(worstAspect, aspect);
      }

      if (worstAspect <= bestAspect) {
        bestAspect = worstAspect;
        rowItems = slice;
        rowTotal = sliceTotal;
      } else {
        break;
      }
    }

    if (rowItems.length === 0) {
      rowItems = [remainingItems[0]];
      rowTotal = remainingItems[0].value;
    }

    const rowRatio = rowTotal / remainingTotal;
    const rowSize = isHorizontal ? remainingWidth * rowRatio : remainingHeight * rowRatio;

    let offset = 0;
    for (const item of rowItems) {
      const itemRatio = item.value / rowTotal;
      const itemSize = (isHorizontal ? remainingHeight : remainingWidth) * itemRatio;

      result.push({
        staker: item.data,
        x: isHorizontal ? currentX : currentX + offset,
        y: isHorizontal ? currentY + offset : currentY,
        width: isHorizontal ? rowSize : itemSize,
        height: isHorizontal ? itemSize : rowSize,
      });
      offset += itemSize;
    }

    if (isHorizontal) {
      currentX += rowSize;
      remainingWidth -= rowSize;
    } else {
      currentY += rowSize;
      remainingHeight -= rowSize;
    }

    remainingItems = remainingItems.slice(rowItems.length);
    remainingTotal -= rowTotal;
  }

  return result;
}

export default function EthStakerTreemap({ stakers }: Props) {
  const [hoveredStaker, setHoveredStaker] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
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

  const width = containerWidth;
  const height = Math.max(500, Math.min(700, containerWidth * 0.55));

  const isHighlighted = (staker: EthStaker): boolean => {
    if (!searchTerm.trim()) return false;
    return staker.name.toLowerCase().includes(searchTerm.toLowerCase());
  };

  const highlightedStaker = useMemo(() => {
    if (!searchTerm.trim()) return null;
    return stakers.find((s) => s.name.toLowerCase().includes(searchTerm.toLowerCase())) ?? null;
  }, [stakers, searchTerm]);

  const nodes = useMemo(() => {
    const items = stakers.map((s) => ({ value: s.amountStaked, data: s }));
    return layoutTreemap(items, 0, 0, width, height);
  }, [stakers, width, height]);

  const totalStake = useMemo(() => stakers.reduce((sum, s) => sum + s.amountStaked, 0), [stakers]);

  // Cumulative stake curve — exclude "Unidentified"
  const cumulativeData = useMemo(() => {
    const identified = stakers
      .filter((s) => s.category !== "Unidentified")
      .sort((a, b) => b.amountStaked - a.amountStaked);
    const identifiedTotal = identified.reduce((sum, s) => sum + s.amountStaked, 0);
    let cumulative = 0;
    return identified.map((s, i) => {
      cumulative += s.amountStaked;
      return {
        index: i + 1,
        name: s.name,
        stake: s.amountStaked,
        cumulativePct: (cumulative / identifiedTotal) * 100,
      };
    });
  }, [stakers]);

  if (stakers.length === 0) {
    return (
      <div className="rounded-lg border border-anza-border bg-anza-surface p-8 text-center">
        <p className="text-anza-green-muted">No Ethereum staker data available.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-6">
      {/* Search */}
      <div className="flex flex-col gap-2">
        <input
          type="text"
          placeholder="Search by staker name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-lg border border-anza-border bg-anza-surface px-4 py-3 text-sm text-anza-green placeholder-anza-green-subtle focus:border-anza-green focus:outline-none focus:ring-1 focus:ring-anza-green"
        />
        {highlightedStaker && (
          <div className="text-sm">
            <span className="text-anza-green-muted">Found: </span>
            <span className="font-medium text-anza-green-mid">{highlightedStaker.name}</span>
            <span className="text-anza-green-muted"> — </span>
            <span className="text-anza-green-mid">{formatStake(highlightedStaker.amountStaked)}</span>
            <span className="text-anza-green-muted"> — </span>
            <span className="text-anza-green-mid">{highlightedStaker.category}</span>
          </div>
        )}
      </div>

      {/* Treemap */}
      <div className="relative overflow-hidden rounded-lg border border-anza-border bg-anza-surface">
        <svg width={width} height={height} className="block">
          {nodes.map((node) => {
            const isHovered = hoveredStaker === node.staker.name;
            const highlighted = isHighlighted(node.staker);
            const minDimension = Math.min(node.width, node.height);
            const nodeCx = node.x + node.width / 2;
            const nodeCy = node.y + node.height / 2;
            const showLabel = minDimension > 30;

            return (
              <g
                key={node.staker.name}
                onMouseEnter={() => setHoveredStaker(node.staker.name)}
                onMouseLeave={() => setHoveredStaker(null)}
              >
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  fill={highlighted ? "#f59e0b" : STAKER_COLOR}
                  fillOpacity={highlighted ? 1 : isHovered ? 0.9 : 0.7}
                  stroke={highlighted ? "#fff" : isHovered ? "#fff" : STAKER_COLOR}
                  strokeWidth={highlighted ? 3 : isHovered ? 2 : 0.5}
                  style={{ cursor: "default" }}
                />
                {showLabel && (
                  <text
                    x={nodeCx}
                    y={nodeCy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-white text-[9px] font-medium pointer-events-none"
                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
                  >
                    {node.staker.name.slice(0, Math.floor(node.width / 6))}
                  </text>
                )}
                <title>{`${node.staker.name}\nStake: ${formatStake(node.staker.amountStaked)}\nCategory: ${node.staker.category}\nMarket Share: ${(node.staker.marketshare * 100).toFixed(2)}%`}</title>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Cumulative Stake Chart */}
      {cumulativeData.length > 0 && (() => {
        const chartW = width;
        const chartH = 300;
        const pad = { top: 30, right: 30, bottom: 50, left: 60 };
        const plotW = chartW - pad.left - pad.right;
        const plotH = chartH - pad.top - pad.bottom;
        const n = cumulativeData.length;

        // Build path
        const points = cumulativeData.map((d, i) => {
          const x = pad.left + (i / (n - 1)) * plotW;
          const y = pad.top + plotH - (d.cumulativePct / 100) * plotH;
          return `${x},${y}`;
        });
        const linePath = `M${points.join("L")}`;
        const areaPath = `${linePath}L${pad.left + plotW},${pad.top + plotH}L${pad.left},${pad.top + plotH}Z`;

        // Y-axis ticks
        const yTicks = [0, 25, 50, 75, 100];
        // X-axis: show a few entity count markers
        const xTicks = [1, Math.round(n * 0.25), Math.round(n * 0.5), Math.round(n * 0.75), n];

        // Find where 50% and 33% thresholds are crossed
        const idx50 = cumulativeData.findIndex((d) => d.cumulativePct >= 50);
        const idx33 = cumulativeData.findIndex((d) => d.cumulativePct >= 33);

        return (
          <div className="overflow-hidden rounded-lg border border-anza-border bg-anza-surface p-4">
            <h3 className="mb-2 text-lg font-semibold">Cumulative Stake Distribution</h3>
            <p className="mb-3 text-xs text-anza-green-muted">
              Entities ranked by stake (largest first), excluding unidentified.
              {idx50 >= 0 && ` Top ${idx50 + 1} entities control 50% of identified stake.`}
            </p>
            <svg width={chartW} height={chartH} className="block">
              {/* Grid lines */}
              {yTicks.map((pct) => {
                const y = pad.top + plotH - (pct / 100) * plotH;
                return (
                  <g key={`y-${pct}`}>
                    <line x1={pad.left} y1={y} x2={pad.left + plotW} y2={y} stroke="rgb(71,85,105)" strokeDasharray="2 4" opacity={0.25} />
                    <text x={pad.left - 8} y={y} textAnchor="end" dominantBaseline="middle" className="fill-anza-green-muted text-[11px]">
                      {pct}%
                    </text>
                  </g>
                );
              })}

              {/* X-axis ticks */}
              {xTicks.map((count) => {
                const x = pad.left + ((count - 1) / (n - 1)) * plotW;
                return (
                  <g key={`x-${count}`}>
                    <line x1={x} y1={pad.top + plotH} x2={x} y2={pad.top + plotH + 6} stroke="rgb(71,85,105)" opacity={0.5} />
                    <text x={x} y={pad.top + plotH + 20} textAnchor="middle" className="fill-anza-green-muted text-[11px]">
                      {count}
                    </text>
                  </g>
                );
              })}

              {/* Axis labels */}
              <text x={pad.left + plotW / 2} y={chartH - 4} textAnchor="middle" className="fill-anza-green-mid text-xs">
                Entities (ranked by stake)
              </text>
              <text x={14} y={pad.top + plotH / 2} textAnchor="middle" dominantBaseline="middle" className="fill-anza-green-mid text-xs" transform={`rotate(-90, 14, ${pad.top + plotH / 2})`}>
                Cumulative %
              </text>

              {/* Area fill */}
              <path d={areaPath} fill={STAKER_COLOR} opacity={0.15} />

              {/* Line */}
              <path d={linePath} fill="none" stroke={STAKER_COLOR} strokeWidth={2.5} />

              {/* 50% threshold marker */}
              {idx50 >= 0 && (() => {
                const x = pad.left + (idx50 / (n - 1)) * plotW;
                const y = pad.top + plotH - (cumulativeData[idx50].cumulativePct / 100) * plotH;
                return (
                  <g>
                    <line x1={x} y1={y} x2={x} y2={pad.top + plotH} stroke="#ef4444" strokeDasharray="4 3" opacity={0.6} />
                    <circle cx={x} cy={y} r={4} fill="#ef4444" />
                    <text x={x + 6} y={y - 6} className="fill-anza-green text-[10px] font-semibold">
                      50% at {idx50 + 1} entities
                    </text>
                  </g>
                );
              })()}

              {/* 33% threshold marker */}
              {idx33 >= 0 && idx33 !== idx50 && (() => {
                const x = pad.left + (idx33 / (n - 1)) * plotW;
                const y = pad.top + plotH - (cumulativeData[idx33].cumulativePct / 100) * plotH;
                return (
                  <g>
                    <line x1={x} y1={y} x2={x} y2={pad.top + plotH} stroke="#f59e0b" strokeDasharray="4 3" opacity={0.6} />
                    <circle cx={x} cy={y} r={4} fill="#f59e0b" />
                    <text x={x + 6} y={y - 6} className="fill-anza-green text-[10px] font-semibold">
                      33% at {idx33 + 1} entities
                    </text>
                  </g>
                );
              })()}

              {/* Axes */}
              <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + plotH} stroke="rgb(71,85,105)" opacity={0.5} />
              <line x1={pad.left} y1={pad.top + plotH} x2={pad.left + plotW} y2={pad.top + plotH} stroke="rgb(71,85,105)" opacity={0.5} />
            </svg>
          </div>
        );
      })()}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-anza-border bg-anza-surface p-4">
          <p className="text-sm text-anza-green-muted">Total Stakers</p>
          <p className="text-2xl font-semibold">{stakers.length.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-anza-border bg-anza-surface p-4">
          <p className="text-sm text-anza-green-muted">Total Stake</p>
          <p className="text-2xl font-semibold">{formatStake(totalStake)}</p>
        </div>
        <div className="rounded-lg border border-anza-border bg-anza-surface p-4">
          <p className="text-sm text-anza-green-muted">Largest Staker</p>
          <p className="text-2xl font-semibold">{stakers[0]?.name ?? "—"}</p>
        </div>
      </div>
    </div>
  );
}
