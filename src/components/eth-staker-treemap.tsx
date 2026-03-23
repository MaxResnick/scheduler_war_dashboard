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
