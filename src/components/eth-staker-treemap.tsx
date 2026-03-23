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

type GroupNode = {
  category: string;
  stakers: EthStaker[];
  totalStake: number;
  x: number;
  y: number;
  width: number;
  height: number;
  nodes: TreemapNode[];
};

const CATEGORY_COLORS: Record<string, string> = {
  "Liquid Staking": "#3b82f6",
  "CEXs": "#ef4444",
  "Staking Pools": "#22c55e",
  "Liquid Restaking": "#8b5cf6",
  "Solo Stakers": "#f59e0b",
  "Unidentified": "#64748b",
};

function getColor(category: string): string {
  return CATEGORY_COLORS[category] ?? "#64748b";
}

function formatStake(eth: number): string {
  if (eth >= 1e6) return `${(eth / 1e6).toFixed(1)}M ETH`;
  if (eth >= 1e3) return `${(eth / 1e3).toFixed(0)}K ETH`;
  return `${eth.toFixed(0)} ETH`;
}

// Simple squarified treemap layout
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

function layoutGroups(
  groups: { category: string; stakers: EthStaker[]; totalStake: number }[],
  width: number,
  height: number
): GroupNode[] {
  const total = groups.reduce((sum, g) => sum + g.totalStake, 0);
  if (total === 0) return [];

  const sorted = [...groups].sort((a, b) => b.totalStake - a.totalStake);
  const result: GroupNode[] = [];
  let currentX = 0;
  let currentY = 0;
  let remainingWidth = width;
  let remainingHeight = height;
  let remainingItems = [...sorted];
  let remainingTotal = total;

  while (remainingItems.length > 0) {
    const isHorizontal = remainingWidth >= remainingHeight;
    let rowItems: typeof sorted = [];
    let rowTotal = 0;
    let bestAspect = Infinity;

    for (let i = 1; i <= remainingItems.length; i++) {
      const slice = remainingItems.slice(0, i);
      const sliceTotal = slice.reduce((sum, item) => sum + item.totalStake, 0);
      const sliceRatio = sliceTotal / remainingTotal;
      const rowSize = isHorizontal ? remainingWidth * sliceRatio : remainingHeight * sliceRatio;

      let worstAspect = 0;
      for (const item of slice) {
        const itemRatio = item.totalStake / sliceTotal;
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
      rowTotal = remainingItems[0].totalStake;
    }

    const rowRatio = rowTotal / remainingTotal;
    const rowSize = isHorizontal ? remainingWidth * rowRatio : remainingHeight * rowRatio;

    let offset = 0;
    for (const item of rowItems) {
      const itemRatio = item.totalStake / rowTotal;
      const itemSize = (isHorizontal ? remainingHeight : remainingWidth) * itemRatio;

      const groupX = isHorizontal ? currentX : currentX + offset;
      const groupY = isHorizontal ? currentY + offset : currentY;
      const groupWidth = isHorizontal ? rowSize : itemSize;
      const groupHeight = isHorizontal ? itemSize : rowSize;

      const stakerItems = item.stakers.map((s) => ({ value: s.amountStaked, data: s }));
      const nodes = layoutTreemap(stakerItems, groupX + 1, groupY + 1, groupWidth - 2, groupHeight - 2);

      result.push({
        category: item.category,
        stakers: item.stakers,
        totalStake: item.totalStake,
        x: groupX,
        y: groupY,
        width: groupWidth,
        height: groupHeight,
        nodes,
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
    const query = searchTerm.toLowerCase();
    return staker.name.toLowerCase().includes(query);
  };

  const highlightedStaker = useMemo(() => {
    if (!searchTerm.trim()) return null;
    return stakers.find((s) => isHighlighted(s)) ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stakers, searchTerm]);

  const groups = useMemo(() => {
    const grouped = new Map<string, EthStaker[]>();
    for (const s of stakers) {
      const existing = grouped.get(s.category) ?? [];
      existing.push(s);
      grouped.set(s.category, existing);
    }
    return Array.from(grouped.entries())
      .map(([category, vals]) => ({
        category,
        stakers: vals,
        totalStake: vals.reduce((sum, v) => sum + v.amountStaked, 0),
      }))
      .sort((a, b) => b.totalStake - a.totalStake);
  }, [stakers]);

  const groupNodes = useMemo(() => layoutGroups(groups, width, height), [groups, width, height]);

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
          {groupNodes.map((group) => (
            <g key={group.category}>
              <rect
                x={group.x}
                y={group.y}
                width={group.width}
                height={group.height}
                fill={getColor(group.category)}
                fillOpacity={0.15}
                stroke={getColor(group.category)}
                strokeWidth={2}
              />
              {(() => {
                const showGroupLabel = group.width > 60 && group.height > 40;
                const pct = ((group.totalStake / totalStake) * 100).toFixed(1);
                const showPct = group.height > 70;
                const nameFontSize = Math.min(15, Math.max(10, group.width / 10));
                const pctFontSize = Math.min(22, Math.max(12, group.width / 7));
                const blockHeight = showPct ? nameFontSize + pctFontSize + 6 : nameFontSize;
                const cx = group.x + group.width / 2;
                const cy = group.y + group.height / 2;
                const nameY = cy - blockHeight / 2 + nameFontSize / 2;
                const pctY = nameY + nameFontSize + 4 + pctFontSize / 2;
                const labelZoneW = Math.min(
                  group.width - 4,
                  Math.max(
                    nameFontSize * group.category.length * 0.65,
                    pctFontSize * (pct.length + 1) * 0.65
                  ) + 24
                );
                const labelZoneH = blockHeight + 16;
                const labelLeft = cx - labelZoneW / 2;
                const labelTop = cy - labelZoneH / 2;

                return (
                  <>
                    {group.nodes.map((node) => {
                      const isHovered = hoveredStaker === node.staker.name;
                      const highlighted = isHighlighted(node.staker);
                      const minDimension = Math.min(node.width, node.height);
                      const nodeCx = node.x + node.width / 2;
                      const nodeCy = node.y + node.height / 2;
                      const insideLabelZone =
                        showGroupLabel &&
                        nodeCx >= labelLeft &&
                        nodeCx <= labelLeft + labelZoneW &&
                        nodeCy >= labelTop &&
                        nodeCy <= labelTop + labelZoneH;
                      const showLabel = minDimension > 30 && !insideLabelZone;

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
                            fill={highlighted ? "#f59e0b" : getColor(node.staker.category)}
                            fillOpacity={highlighted ? 1 : isHovered ? 0.9 : 0.7}
                            stroke={highlighted ? "#fff" : isHovered ? "#fff" : getColor(node.staker.category)}
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

                    {showGroupLabel && (
                      <g
                        className="pointer-events-none"
                        style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.9))" }}
                      >
                        <text
                          x={cx}
                          y={nameY}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="white"
                          fontWeight="600"
                          style={{ fontSize: nameFontSize }}
                        >
                          {group.category}
                        </text>
                        {showPct && (
                          <text
                            x={cx}
                            y={pctY}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="white"
                            fontWeight="700"
                            style={{ fontSize: pctFontSize }}
                          >
                            {pct}%
                          </text>
                        )}
                      </g>
                    )}
                  </>
                );
              })()}
            </g>
          ))}
        </svg>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-anza-border bg-anza-surface p-4">
          <p className="text-sm text-anza-green-muted">Total Stakers</p>
          <p className="text-2xl font-semibold">{stakers.length.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-anza-border bg-anza-surface p-4">
          <p className="text-sm text-anza-green-muted">Total Stake</p>
          <p className="text-2xl font-semibold">{formatStake(totalStake)}</p>
        </div>
        <div className="rounded-lg border border-anza-border bg-anza-surface p-4">
          <p className="text-sm text-anza-green-muted">Categories</p>
          <p className="text-2xl font-semibold">{groups.length}</p>
        </div>
        <div className="rounded-lg border border-anza-border bg-anza-surface p-4">
          <p className="text-sm text-anza-green-muted">Largest Category</p>
          <p className="text-2xl font-semibold">{groups[0]?.category ?? "—"}</p>
        </div>
      </div>
    </div>
  );
}
