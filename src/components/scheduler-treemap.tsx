"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ValidatorData } from "@/lib/validators-app";

type Props = {
  validators: ValidatorData[];
};

type TreemapNode = {
  validator: ValidatorData;
  x: number;
  y: number;
  width: number;
  height: number;
};

type GroupNode = {
  softwareClient: string;
  validators: ValidatorData[];
  totalStake: number;
  x: number;
  y: number;
  width: number;
  height: number;
  nodes: TreemapNode[];
};

const SCHEDULER_COLORS: Record<string, string> = {
  "AgaveBam": "#7C3AED",
  "Agave": "#2C3316",
  "Jito Agave": "#5F288D",
  "Frankendancer": "#fb923c",
  "Firedancer": "#ef4444",
  "AgavePaladin": "#facc15",
  "Harmonic": "#F5F2EB",
  "Unknown": "#64748b", // Neutral gray for unidentified validators
};

// Rename labels for display
function getDisplayName(softwareClient: string): string {
  if (softwareClient === "JitoLabs") return "Jito Agave";
  return softwareClient;
}

function getColor(softwareClient: string): string {
  const displayName = getDisplayName(softwareClient);
  return SCHEDULER_COLORS[displayName] ?? "#64748b";
}

// Simple squarified treemap layout
function layoutTreemap(
  items: { value: number; data: ValidatorData }[],
  x: number,
  y: number,
  width: number,
  height: number
): TreemapNode[] {
  if (items.length === 0) return [];
  if (items.length === 1) {
    return [{
      validator: items[0].data,
      x,
      y,
      width,
      height,
    }];
  }

  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return [];

  // Sort by value descending
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

    // Find how many items to include in this row/column
    let rowItems: typeof items = [];
    let rowTotal = 0;
    let bestAspect = Infinity;

    for (let i = 1; i <= remainingItems.length; i++) {
      const slice = remainingItems.slice(0, i);
      const sliceTotal = slice.reduce((sum, item) => sum + item.value, 0);
      const sliceRatio = sliceTotal / remainingTotal;

      const rowSize = isHorizontal
        ? remainingWidth * sliceRatio
        : remainingHeight * sliceRatio;

      // Calculate worst aspect ratio in this slice
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

    // Layout this row
    const rowRatio = rowTotal / remainingTotal;
    const rowSize = isHorizontal
      ? remainingWidth * rowRatio
      : remainingHeight * rowRatio;

    let offset = 0;
    for (const item of rowItems) {
      const itemRatio = item.value / rowTotal;
      const itemSize = (isHorizontal ? remainingHeight : remainingWidth) * itemRatio;

      result.push({
        validator: item.data,
        x: isHorizontal ? currentX : currentX + offset,
        y: isHorizontal ? currentY + offset : currentY,
        width: isHorizontal ? rowSize : itemSize,
        height: isHorizontal ? itemSize : rowSize,
      });

      offset += itemSize;
    }

    // Update remaining space
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
  groups: { softwareClient: string; validators: ValidatorData[]; totalStake: number }[],
  width: number,
  height: number
): GroupNode[] {
  const total = groups.reduce((sum, g) => sum + g.totalStake, 0);
  if (total === 0) return [];

  // Layout groups as a simple treemap
  const groupItems = groups.map(g => ({ value: g.totalStake, data: g }));
  const sorted = [...groupItems].sort((a, b) => b.value - a.value);

  const result: GroupNode[] = [];
  let currentX = 0;
  let currentY = 0;
  let remainingWidth = width;
  let remainingHeight = height;
  let remainingItems = [...sorted];
  let remainingTotal = total;

  while (remainingItems.length > 0) {
    const isHorizontal = remainingWidth >= remainingHeight;

    let rowItems: typeof groupItems = [];
    let rowTotal = 0;
    let bestAspect = Infinity;

    for (let i = 1; i <= remainingItems.length; i++) {
      const slice = remainingItems.slice(0, i);
      const sliceTotal = slice.reduce((sum, item) => sum + item.value, 0);
      const sliceRatio = sliceTotal / remainingTotal;

      const rowSize = isHorizontal
        ? remainingWidth * sliceRatio
        : remainingHeight * sliceRatio;

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
    const rowSize = isHorizontal
      ? remainingWidth * rowRatio
      : remainingHeight * rowRatio;

    let offset = 0;
    for (const item of rowItems) {
      const itemRatio = item.value / rowTotal;
      const itemSize = (isHorizontal ? remainingHeight : remainingWidth) * itemRatio;

      const groupX = isHorizontal ? currentX : currentX + offset;
      const groupY = isHorizontal ? currentY + offset : currentY;
      const groupWidth = isHorizontal ? rowSize : itemSize;
      const groupHeight = isHorizontal ? itemSize : rowSize;

      // Layout validators within the group
      const validatorItems = item.data.validators.map(v => ({
        value: v.activeStake,
        data: v,
      }));
      const validatorNodes = layoutTreemap(
        validatorItems,
        groupX + 1,
        groupY + 1,
        groupWidth - 2,
        groupHeight - 2
      );

      result.push({
        softwareClient: item.data.softwareClient,
        validators: item.data.validators,
        totalStake: item.data.totalStake,
        x: groupX,
        y: groupY,
        width: groupWidth,
        height: groupHeight,
        nodes: validatorNodes,
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

function formatStake(lamports: number): string {
  const sol = lamports / 1e9;
  if (sol >= 1e6) return `${(sol / 1e6).toFixed(1)}M SOL`;
  if (sol >= 1e3) return `${(sol / 1e3).toFixed(0)}K SOL`;
  return `${sol.toFixed(0)} SOL`;
}

export default function SchedulerTreemap({ validators }: Props) {
  const [hoveredValidator, setHoveredValidator] = useState<string | null>(null);
  const [loadingValidator, setLoadingValidator] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [containerWidth, setContainerWidth] = useState(1200);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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

  // Check if a validator matches the search term
  const isValidatorHighlighted = (validator: ValidatorData): boolean => {
    if (!searchTerm.trim()) return false;
    const query = searchTerm.toLowerCase();
    const nameMatch = validator.name?.toLowerCase().includes(query);
    const addressMatch = validator.account.toLowerCase().includes(query);
    return nameMatch || addressMatch;
  };

  // Find the highlighted validator for displaying info
  const highlightedValidator = useMemo(() => {
    if (!searchTerm.trim()) return null;
    return validators.find(v => isValidatorHighlighted(v)) ?? null;
  }, [validators, searchTerm]);

  const groups = useMemo(() => {
    const grouped = new Map<string, ValidatorData[]>();

    for (const v of validators) {
      const existing = grouped.get(v.softwareClient) ?? [];
      existing.push(v);
      grouped.set(v.softwareClient, existing);
    }

    return Array.from(grouped.entries())
      .map(([softwareClient, validators]) => ({
        softwareClient,
        validators,
        totalStake: validators.reduce((sum, v) => sum + v.activeStake, 0),
      }))
      .sort((a, b) => b.totalStake - a.totalStake);
  }, [validators]);

  const groupNodes = useMemo(
    () => layoutGroups(groups, width, height),
    [groups, width, height]
  );

  const totalStake = useMemo(
    () => validators.reduce((sum, v) => sum + v.activeStake, 0),
    [validators]
  );

  const handleValidatorClick = async (address: string) => {
    setLoadingValidator(address);
    try {
      const res = await fetch(`/api/validator-slots/${address}`);
      if (res.ok) {
        const data = await res.json();
        const slots = data.slots ?? [];
        // Use 5th most recent slot (index 4) to ensure Jito data is populated
        const slotIndex = Math.min(4, slots.length - 1);
        if (slots.length > 0 && slotIndex >= 0) {
          router.push(`/slot/${slots[slotIndex].slot}`);
          return;
        }
      }
    } catch {
      // ignore errors
    }
    setLoadingValidator(null);
  };

  if (validators.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center">
        <p className="text-slate-400">
          No validator data available. Run the fetch script with VALIDATORS_APP_API_TOKEN to populate data.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-6">
      {/* Search */}
      <div className="flex flex-col gap-2">
        <input
          type="text"
          placeholder="Search by validator name or address..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
        {highlightedValidator && (
          <div className="text-sm">
            <span className="text-slate-400">Found: </span>
            <span className="font-medium text-sky-400">
              {highlightedValidator.name || highlightedValidator.account}
            </span>
            <span className="text-slate-400"> — </span>
            <span className="text-slate-300">{formatStake(highlightedValidator.activeStake)}</span>
            <span className="text-slate-400"> — </span>
            <span className="text-slate-300">{getDisplayName(highlightedValidator.softwareClient)}</span>
          </div>
        )}
      </div>

      {/* Battle Bar */}
      {(() => {
        // Look for Harmonic validators (may be labeled as "Harmonic" in gossip data)
        const harmonicStake = groups.find(g => g.softwareClient === "Harmonic")?.totalStake ?? 0;
        const bamStake = groups.find(g => g.softwareClient === "AgaveBam")?.totalStake ?? 0;
        const battleTotal = harmonicStake + bamStake;
        const harmonicPercent = battleTotal > 0 ? (harmonicStake / battleTotal) * 100 : 50;
        const bamPercent = battleTotal > 0 ? (bamStake / battleTotal) * 100 : 50;

        return (
          <div className="relative overflow-hidden rounded-xl border border-slate-700 bg-slate-900/80 p-4">
            {/* Animated background glow */}
            <div className="absolute inset-0 opacity-30">
              <div
                className="absolute left-0 top-0 h-full animate-pulse"
                style={{
                  width: `${bamPercent}%`,
                  background: "linear-gradient(90deg, #7C3AED 0%, #9333ea 50%, transparent 100%)",
                  filter: "blur(20px)"
                }}
              />
              <div
                className="absolute right-0 top-0 h-full animate-pulse"
                style={{
                  width: `${harmonicPercent}%`,
                  background: "linear-gradient(270deg, #F5F2EB 0%, #e8e4d9 50%, transparent 100%)",
                  filter: "blur(20px)",
                  animationDelay: "0.5s"
                }}
              />
            </div>

            {/* Title */}
            <div className="relative mb-3 text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                ⚔️ Scheduler War ⚔️
              </span>
            </div>

            {/* Battle bar */}
            <div className="relative">
              {/* Labels */}
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-violet-400" style={{ textShadow: "0 0 10px #7C3AED" }}>
                    BAM
                  </span>
                  <span className="text-sm text-violet-400/80">
                    {formatStake(bamStake)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: "rgba(245,242,235,0.8)" }}>
                    {formatStake(harmonicStake)}
                  </span>
                  <span className="text-lg font-bold" style={{ color: "#F5F2EB", textShadow: "0 0 10px rgba(245,242,235,0.5)" }}>
                    Harmonic
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="relative h-8 overflow-hidden rounded-full bg-slate-800">
                {/* BAM side */}
                <div
                  className="absolute left-0 top-0 h-full transition-all duration-1000"
                  style={{
                    width: `${bamPercent}%`,
                    background: "linear-gradient(90deg, #7C3AED 0%, #8b5cf6 70%, #a78bfa 100%)",
                    boxShadow: "0 0 20px rgba(124,58,237,0.6), inset 0 2px 4px rgba(255,255,255,0.2)"
                  }}
                >
                  {/* Shimmer effect */}
                  <div
                    className="absolute inset-0 animate-shimmer"
                    style={{
                      background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)",
                      backgroundSize: "200% 100%"
                    }}
                  />
                </div>

                {/* Harmonic side */}
                <div
                  className="absolute right-0 top-0 h-full transition-all duration-1000"
                  style={{
                    width: `${harmonicPercent}%`,
                    background: "linear-gradient(270deg, #F5F2EB 0%, #e8e4d9 70%, #dbd6c9 100%)",
                    boxShadow: "0 0 20px rgba(245,242,235,0.5), inset 0 2px 4px rgba(255,255,255,0.5)"
                  }}
                >
                  {/* Shimmer effect */}
                  <div
                    className="absolute inset-0 animate-shimmer"
                    style={{
                      background: "linear-gradient(270deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
                      backgroundSize: "200% 100%",
                      animationDelay: "0.5s"
                    }}
                  />
                </div>

                {/* VS badge at meeting point */}
                <div
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 transition-all duration-1000"
                  style={{ left: `${bamPercent}%` }}
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-xs font-black text-white"
                    style={{ boxShadow: "0 0 15px rgba(255,255,255,0.5)" }}
                  >
                    VS
                  </div>
                </div>
              </div>

              {/* Percentage labels */}
              <div className="mt-2 flex items-center justify-between text-sm font-bold">
                <span className="text-violet-400">{bamPercent.toFixed(1)}%</span>
                <span style={{ color: "#F5F2EB" }}>{harmonicPercent.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Treemap */}
      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40">
        <svg width={width} height={height} className="block">
          {groupNodes.map((group) => (
            <g key={group.softwareClient}>
              {/* Group background */}
              <rect
                x={group.x}
                y={group.y}
                width={group.width}
                height={group.height}
                fill={getColor(group.softwareClient)}
                fillOpacity={0.15}
                stroke={getColor(group.softwareClient)}
                strokeWidth={2}
              />

              {/* Validator nodes */}
              {group.nodes.map((node) => {
                const isHovered = hoveredValidator === node.validator.account;
                const isLoading = loadingValidator === node.validator.account;
                const isHighlighted = isValidatorHighlighted(node.validator);
                const minDimension = Math.min(node.width, node.height);
                const showLabel = minDimension > 30;

                return (
                  <g
                    key={node.validator.account}
                    onClick={() => handleValidatorClick(node.validator.account)}
                    onMouseEnter={() => setHoveredValidator(node.validator.account)}
                    onMouseLeave={() => setHoveredValidator(null)}
                    style={{ cursor: isLoading ? "wait" : "pointer" }}
                  >
                    <rect
                      x={node.x}
                      y={node.y}
                      width={node.width}
                      height={node.height}
                      fill={isHighlighted ? "#38bdf8" : getColor(group.softwareClient)}
                      fillOpacity={isHighlighted ? 1 : isHovered ? 0.9 : 0.7}
                      stroke={isHighlighted ? "#fff" : isHovered ? "#fff" : getColor(group.softwareClient)}
                      strokeWidth={isHighlighted ? 3 : isHovered ? 2 : 0.5}
                    />
                    {showLabel && (
                      <text
                        x={node.x + node.width / 2}
                        y={node.y + node.height / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-white text-[9px] font-medium pointer-events-none"
                        style={{
                          textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                        }}
                      >
                        {isLoading
                          ? "..."
                          : node.validator.name
                          ? node.validator.name.slice(0, Math.floor(node.width / 6))
                          : node.validator.account.slice(0, 4)}
                      </text>
                    )}
                    <title>{`${node.validator.name || node.validator.account}\nStake: ${formatStake(node.validator.activeStake)}\nClient: ${getDisplayName(group.softwareClient)}\nClick to view slot detail`}</title>
                  </g>
                );
              })}

              {/* Group label */}
              {group.width > 100 && group.height > 40 && (
                <text
                  x={group.x + 8}
                  y={group.y + 20}
                  className="fill-white text-sm font-bold pointer-events-none"
                  style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}
                >
                  {getDisplayName(group.softwareClient)}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-sm text-slate-400">Total Validators</p>
          <p className="text-2xl font-semibold">{validators.length.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-sm text-slate-400">Total Stake</p>
          <p className="text-2xl font-semibold">{formatStake(totalStake)}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-sm text-slate-400">Scheduler Types</p>
          <p className="text-2xl font-semibold">{groups.length}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-sm text-slate-400">Largest Type</p>
          <p className="text-2xl font-semibold">{groups[0] ? getDisplayName(groups[0].softwareClient) : "—"}</p>
        </div>
      </div>
    </div>
  );
}
