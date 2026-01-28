"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import { AggregateTransitionChart } from "@/components/axiom-routing/slot-sequence-chart";
import type { AxiomRoutingPayload, LeaderTransition } from "@/lib/types";

const RANGE_OPTIONS = [
  { label: "1h", hours: 1 },
  { label: "2h", hours: 2 },
  { label: "4h", hours: 4 },
  { label: "6h", hours: 6 }
];

// The 4 scheduler types we care about
const TYPES = ["AgaveBam", "Frankendancer", "JitoLabs", "Harmonic"] as const;

// Display names
const TYPE_LABELS: Record<string, string> = {
  AgaveBam: "BAM",
  Frankendancer: "FD",
  JitoLabs: "Jito",
  Harmonic: "Harmonic"
};

// Colors matching landing page
const TYPE_COLORS: Record<string, string> = {
  AgaveBam: "#7C3AED",
  Frankendancer: "#fb923c",
  JitoLabs: "#5F288D",
  Harmonic: "#F5F2EB"
};

// Nozomi tip accounts
const NOZOMI_ACCOUNTS = [
  "noz6uoYCDijhu1V7cutCpwxNiSovEwLdRHPwmgCGDNo",
  "nozUacTVWub3cL4mJmGCYjKZTnE9RbdY5AP46iQgbPJ",
  "nozrwQtWhEdrA6W8dkbt9gnUaMs52PdAv5byipnadq3",
  "nozFrhfnNGoyqwVuwPAW4aaGqempx4PU6g6D9CJMv7Z",
  "nozWCyTPppJjRuw2fpzDhhWbW355fzosWSzrrMYB1Qk",
  "noz9EPNcT7WH6Sou3sr3GGjHQYVkN3DNirpbvDkv9YJ",
  "noznbgwYnBLDHu8wcQVCEw6kDrXkPdKkydGJGNXGvL7",
  "nozNVWs5N8mgzuD3qigrCG2UoKxZttxzZ85pvAQVrbP",
  "nozievPk7HyK1Rqy1MPJwVQ7qQg2QoJGyP71oeDwbsu",
  "nozrhjhkCr3zXT3BiT4WCodYCUFeQvcdUkM7MqhKqge",
  "nozpEGbwx4BcGp6pvEdAh1JoC2CQGZdU6HbNP1v2p6P"
];

// Fee spoofer accounts
const FEE_SPOOFER_ACCOUNTS = [
  "HgJHG9FJfkvnwEuUT9AeoH5y6DWDVe6w5dMFz6oUVDpF",
  "5cfsiKeymyf677VG1dctX2XzGxq4nshpX66SVoZQTDSJ",
  "DX5rUqjNksR7amvBazRj6QFgVVfSK65bfCJnmkEyiQUN"
];

type AxiomRoutingClientProps = {
  initialData: AxiomRoutingPayload;
  defaultAccounts: string[];
};

type ViewMode = "histogram" | "multiplier";

export default function AxiomRoutingClient({ initialData, defaultAccounts }: AxiomRoutingClientProps) {
  const [data, setData] = useState<AxiomRoutingPayload>(initialData);
  const [selectedHours, setSelectedHours] = useState<number>(2);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("histogram");
  const [accountsInput, setAccountsInput] = useState<string>(defaultAccounts.join("\n"));
  const [showAccountsInput, setShowAccountsInput] = useState<boolean>(false);
  const [filterFullBlocks, setFilterFullBlocks] = useState<boolean>(false);
  const [fullBlockThreshold, setFullBlockThreshold] = useState<number>(55_000_000); // 55M CU

  const refreshData = useCallback(
    (hours: number, customAccounts?: string[]) => {
      const previous = selectedHours;
      setSelectedHours(hours);

      startTransition(async () => {
        try {
          setError(null);
          const to = new Date();
          const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
          const url = new URL("/api/axiom-routing", window.location.origin);
          url.searchParams.set("from", from.toISOString());
          url.searchParams.set("to", to.toISOString());

          // Parse accounts from input if provided
          const accounts = customAccounts ?? accountsInput
            .split(/[\n,]/)
            .map((a) => a.trim())
            .filter((a) => a.length > 0);

          if (accounts.length > 0) {
            url.searchParams.set("accounts", accounts.join(","));
          }

          const response = await fetch(url.toString(), {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-store"
          });

          if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
          }

          const next = (await response.json()) as AxiomRoutingPayload;
          setData(next);
        } catch (err: unknown) {
          console.error("[axiom-routing-client] Failed to refresh data", err);
          setSelectedHours(previous);
          setError("Unable to refresh data.");
        }
      });
    },
    [selectedHours, accountsInput]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "r" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        refreshData(selectedHours);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [refreshData, selectedHours]);

  // Filter transitions if filterFullBlocks is enabled
  const filteredTransitions = filterFullBlocks
    ? data.transitions.filter((t) => {
        if (!t.slotSequence || t.slotSequence.length < 4) return true;
        // Only check the "from" slot (position 3) - exclude if it's above threshold
        const fromSlot = t.slotSequence[3];
        return fromSlot.totalComputeUnits < fullBlockThreshold;
      })
    : data.transitions;

  // Group transitions by from→to type
  const transitionMap = new Map<string, LeaderTransition[]>();
  for (const t of filteredTransitions) {
    const key = `${t.fromValidatorType}→${t.toValidatorType}`;
    const existing = transitionMap.get(key) ?? [];
    existing.push(t);
    transitionMap.set(key, existing);
  }

  // Get transitions for a specific from→to pair
  const getTransitions = (from: string, to: string): LeaderTransition[] => {
    return transitionMap.get(`${from}→${to}`) ?? [];
  };

  // Calculate multiplier: avg tx after transition / avg tx before transition
  const calculateMultiplier = (from: string, to: string, showAxiom: boolean): { multiplier: number; count: number } => {
    const transitions = getTransitions(from, to);
    if (transitions.length === 0) return { multiplier: 0, count: 0 };

    let totalBefore = 0;
    let totalAfter = 0;
    let validCount = 0;

    for (const t of transitions) {
      if (!t.slotSequence || t.slotSequence.length < 6) continue;

      // Positions 0-3 are "before" (from scheduler), positions 4-7 are "after" (to scheduler)
      const transitionIdx = 3; // last slot of "from" scheduler
      let beforeSum = 0;
      let afterSum = 0;
      let beforeCount = 0;
      let afterCount = 0;

      for (let i = 0; i < t.slotSequence.length; i++) {
        const val = showAxiom ? t.slotSequence[i].axiomTxCount : t.slotSequence[i].totalTxCount;
        if (i <= transitionIdx) {
          beforeSum += val;
          beforeCount++;
        } else {
          afterSum += val;
          afterCount++;
        }
      }

      if (beforeCount > 0 && afterCount > 0) {
        totalBefore += beforeSum / beforeCount;
        totalAfter += afterSum / afterCount;
        validCount++;
      }
    }

    if (validCount === 0 || totalBefore === 0) {
      return { multiplier: totalAfter > 0 ? Infinity : 1, count: transitions.length };
    }

    return { multiplier: totalAfter / totalBefore, count: transitions.length };
  };

  return (
    <section className="flex flex-col gap-6">
      {/* Time range selector */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-1">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.hours}
              type="button"
              onClick={() => refreshData(option.hours)}
              className={`rounded-md px-3 py-1 text-sm transition ${
                selectedHours === option.hours
                  ? "bg-sky-500 text-slate-900"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-400">
            {new Date(data.range.from).toLocaleTimeString()} - {new Date(data.range.to).toLocaleTimeString()}
          </div>
          <button
            type="button"
            onClick={() => refreshData(selectedHours)}
            disabled={isPending}
            className={`rounded-md border px-3 py-1 text-sm ${
              isPending
                ? "cursor-not-allowed border-slate-800 bg-slate-800 text-slate-500"
                : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
            }`}
          >
            {isPending ? "..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Custom accounts input */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-slate-300">Accounts to Track</h3>
          <button
            type="button"
            onClick={() => setShowAccountsInput(!showAccountsInput)}
            className="text-xs text-sky-400 hover:text-sky-300"
          >
            {showAccountsInput ? "Hide" : "Edit"}
          </button>
        </div>
        {showAccountsInput ? (
          <div className="space-y-3">
            <textarea
              value={accountsInput}
              onChange={(e) => setAccountsInput(e.target.value)}
              placeholder="Enter accounts (one per line or comma-separated)"
              className="w-full h-32 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => refreshData(selectedHours)}
                disabled={isPending}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  isPending
                    ? "cursor-not-allowed bg-slate-700 text-slate-500"
                    : "bg-sky-500 text-slate-900 hover:bg-sky-400"
                }`}
              >
                {isPending ? "Loading..." : "Run Analysis"}
              </button>
              <span className="text-xs text-slate-500">Presets:</span>
              <button
                type="button"
                onClick={() => setAccountsInput(defaultAccounts.join("\n"))}
                className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                Axiom
              </button>
              <button
                type="button"
                onClick={() => setAccountsInput(NOZOMI_ACCOUNTS.join("\n"))}
                className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                Nozomi
              </button>
              <button
                type="button"
                onClick={() => setAccountsInput(FEE_SPOOFER_ACCOUNTS.join("\n"))}
                className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                Fee Spoofers
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-500">
            {accountsInput.split(/[\n,]/).filter((a) => a.trim()).length} accounts configured
          </div>
        )}
      </div>

      {/* Legend and view toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6 text-sm">
          <span className="text-slate-400">Scheduler Types:</span>
          {TYPES.map((type) => (
            <div key={type} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: TYPE_COLORS[type] }}
              />
              <span className="text-slate-300">{TYPE_LABELS[type]}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-1">
          <button
            type="button"
            onClick={() => setViewMode("histogram")}
            className={`rounded-md px-3 py-1 text-sm transition ${
              viewMode === "histogram"
                ? "bg-sky-500 text-slate-900"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            Histogram
          </button>
          <button
            type="button"
            onClick={() => setViewMode("multiplier")}
            className={`rounded-md px-3 py-1 text-sm transition ${
              viewMode === "multiplier"
                ? "bg-sky-500 text-slate-900"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            Multiplier
          </button>
        </div>
      </div>

      {/* Filter controls */}
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filterFullBlocks}
            onChange={(e) => setFilterFullBlocks(e.target.checked)}
            className="rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500"
          />
          <span className="text-slate-300">Exclude full blocks</span>
        </label>
        {filterFullBlocks && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Threshold:</span>
            <input
              type="number"
              value={fullBlockThreshold / 1_000_000}
              onChange={(e) => setFullBlockThreshold((Number(e.target.value) || 55) * 1_000_000)}
              className="w-16 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
            />
            <span className="text-xs text-slate-500">M CU</span>
          </div>
        )}
        {filterFullBlocks && (
          <span className="text-xs text-slate-500">
            ({filteredTransitions.length} / {data.transitions.length} transitions)
          </span>
        )}
      </div>

      {/* AXIOM TX MATRIX */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-lg font-semibold mb-4">Axiom Transactions - Transition Matrix</h2>
        <p className="text-xs text-slate-400 mb-4">
          Average Axiom tx count across 8-slot windows. Rows = &quot;from&quot; scheduler, Columns = &quot;to&quot; scheduler.
          Yellow line marks transition point.
        </p>

        {/* Column headers */}
        <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: "28px repeat(4, 1fr)" }}>
          <div className="text-xs text-slate-500 text-center"></div>
          {TYPES.map((type) => (
            <div
              key={type}
              className="text-xs font-medium text-center py-1 rounded"
              style={{ backgroundColor: `${TYPE_COLORS[type]}30`, color: TYPE_COLORS[type] }}
            >
              {TYPE_LABELS[type]}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {TYPES.map((fromType) => (
          <div key={fromType} className="grid gap-2 mb-2" style={{ gridTemplateColumns: "28px repeat(4, 1fr)" }}>
            {/* Row header */}
            <div
              className="text-xs font-medium flex items-center justify-center rounded"
              style={{
                backgroundColor: `${TYPE_COLORS[fromType]}30`,
                color: TYPE_COLORS[fromType],
                writingMode: "vertical-rl",
                textOrientation: "mixed",
                transform: "rotate(180deg)"
              }}
            >
              {TYPE_LABELS[fromType]}
            </div>

            {/* Cells */}
            {TYPES.map((toType) => {
              if (fromType === toType) {
                return (
                  <div
                    key={toType}
                    className="h-28 rounded bg-slate-800/50 flex items-center justify-center text-slate-600 text-xs"
                  >
                    —
                  </div>
                );
              }

              const transitions = getTransitions(fromType, toType);

              if (viewMode === "multiplier") {
                const { multiplier, count } = calculateMultiplier(fromType, toType, true);
                const displayVal = multiplier === Infinity ? "∞" : multiplier.toFixed(2);
                const color = multiplier > 1 ? "#22c55e" : multiplier < 1 ? "#ef4444" : "#94a3b8";

                return (
                  <div
                    key={toType}
                    className="h-28 rounded border border-slate-800 bg-slate-900/60 p-2 flex flex-col items-center justify-center"
                  >
                    <div className="text-2xl font-bold" style={{ color }}>
                      {displayVal}x
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">n={count}</div>
                  </div>
                );
              }

              const sequences = transitions
                .filter((t) => t.slotSequence && t.slotSequence.length >= 6)
                .map((t) => t.slotSequence);

              return (
                <div
                  key={toType}
                  className="h-28 rounded border border-slate-800 bg-slate-900/60 p-2"
                >
                  <AggregateTransitionChart
                    sequences={sequences}
                    title={`${TYPE_LABELS[fromType]}→${TYPE_LABELS[toType]}`}
                    showAxiom={true}
                    height={70}
                    count={transitions.length}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* TOTAL TX MATRIX */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-lg font-semibold mb-4">All Transactions - Transition Matrix</h2>
        <p className="text-xs text-slate-400 mb-4">
          Average total tx count (all transactions, not just Axiom) across 8-slot windows.
        </p>

        {/* Column headers */}
        <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: "28px repeat(4, 1fr)" }}>
          <div className="text-xs text-slate-500 text-center"></div>
          {TYPES.map((type) => (
            <div
              key={type}
              className="text-xs font-medium text-center py-1 rounded"
              style={{ backgroundColor: `${TYPE_COLORS[type]}30`, color: TYPE_COLORS[type] }}
            >
              {TYPE_LABELS[type]}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {TYPES.map((fromType) => (
          <div key={fromType} className="grid gap-2 mb-2" style={{ gridTemplateColumns: "28px repeat(4, 1fr)" }}>
            {/* Row header */}
            <div
              className="text-xs font-medium flex items-center justify-center rounded"
              style={{
                backgroundColor: `${TYPE_COLORS[fromType]}30`,
                color: TYPE_COLORS[fromType],
                writingMode: "vertical-rl",
                textOrientation: "mixed",
                transform: "rotate(180deg)"
              }}
            >
              {TYPE_LABELS[fromType]}
            </div>

            {/* Cells */}
            {TYPES.map((toType) => {
              if (fromType === toType) {
                return (
                  <div
                    key={toType}
                    className="h-28 rounded bg-slate-800/50 flex items-center justify-center text-slate-600 text-xs"
                  >
                    —
                  </div>
                );
              }

              const transitions = getTransitions(fromType, toType);

              if (viewMode === "multiplier") {
                const { multiplier, count } = calculateMultiplier(fromType, toType, false);
                const displayVal = multiplier === Infinity ? "∞" : multiplier.toFixed(2);
                const color = multiplier > 1 ? "#22c55e" : multiplier < 1 ? "#ef4444" : "#94a3b8";

                return (
                  <div
                    key={toType}
                    className="h-28 rounded border border-slate-800 bg-slate-900/60 p-2 flex flex-col items-center justify-center"
                  >
                    <div className="text-2xl font-bold" style={{ color }}>
                      {displayVal}x
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">n={count}</div>
                  </div>
                );
              }

              const sequences = transitions
                .filter((t) => t.slotSequence && t.slotSequence.length >= 6)
                .map((t) => t.slotSequence);

              return (
                <div
                  key={toType}
                  className="h-28 rounded border border-slate-800 bg-slate-900/60 p-2"
                >
                  <AggregateTransitionChart
                    sequences={sequences}
                    title={`${TYPE_LABELS[fromType]}→${TYPE_LABELS[toType]}`}
                    showAxiom={false}
                    height={70}
                    count={transitions.length}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Summary stats */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-lg font-semibold mb-4">Transition Counts</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {data.transitionStats.slice(0, 12).map((stat) => (
            <div
              key={stat.transitionType}
              className="rounded border border-slate-800 bg-slate-900/60 p-3"
            >
              <div className="text-sm font-medium text-slate-200">{stat.transitionType}</div>
              <div className="text-2xl font-bold text-slate-100">{stat.count}</div>
              <div className="text-xs text-slate-500">
                Axiom ratio: {stat.axiomTxRatio == null ? "—" : stat.axiomTxRatio === Infinity ? "∞" : stat.axiomTxRatio.toFixed(2)}x
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Validators with non-zero tx counts */}
      <ValidatorTxList transitions={filteredTransitions} />
    </section>
  );
}

// Component to show validators with non-zero transaction counts
function ValidatorTxList({ transitions }: { transitions: LeaderTransition[] }) {
  const [showList, setShowList] = useState(false);
  const [expandedValidator, setExpandedValidator] = useState<string | null>(null);

  // Aggregate tx counts by validator, tracking individual slots
  const validatorStats = new Map<string, {
    name: string | null;
    type: string;
    txCount: number;
    slotDetails: { slot: number; txCount: number }[]
  }>();

  for (const t of transitions) {
    if (!t.slotSequence) continue;
    for (const slotData of t.slotSequence) {
      if (slotData.axiomTxCount > 0) {
        const existing = validatorStats.get(slotData.validator);
        if (existing) {
          existing.txCount += slotData.axiomTxCount;
          // Check if slot already tracked
          const existingSlot = existing.slotDetails.find(s => s.slot === slotData.slot);
          if (!existingSlot) {
            existing.slotDetails.push({ slot: slotData.slot, txCount: slotData.axiomTxCount });
          }
        } else {
          validatorStats.set(slotData.validator, {
            name: slotData.validatorName,
            type: slotData.validatorType,
            txCount: slotData.axiomTxCount,
            slotDetails: [{ slot: slotData.slot, txCount: slotData.axiomTxCount }]
          });
        }
      }
    }
  }

  // Sort by tx count descending
  const sortedValidators = Array.from(validatorStats.entries())
    .map(([account, stats]) => ({
      account,
      ...stats,
      slotDetails: stats.slotDetails.sort((a, b) => b.slot - a.slot) // Sort slots descending
    }))
    .sort((a, b) => b.txCount - a.txCount);

  if (sortedValidators.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Validators with Tracked Transactions</h2>
        <button
          type="button"
          onClick={() => setShowList(!showList)}
          className="text-xs text-sky-400 hover:text-sky-300"
        >
          {showList ? "Hide" : `Show (${sortedValidators.length})`}
        </button>
      </div>
      {showList && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-xs text-slate-400">
                <th className="pb-2 pr-4">Validator</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4 text-right">Tx Count</th>
                <th className="pb-2 text-right">Slots</th>
              </tr>
            </thead>
            <tbody>
              {sortedValidators.map((v) => (
                <React.Fragment key={v.account}>
                  <tr
                    className="border-b border-slate-800 cursor-pointer hover:bg-slate-800/50"
                    onClick={() => setExpandedValidator(expandedValidator === v.account ? null : v.account)}
                  >
                    <td className="py-2 pr-4">
                      <div className="font-medium text-slate-200">{v.name || "Unknown"}</div>
                      <div className="text-xs text-slate-500 font-mono">{v.account.slice(0, 8)}...</div>
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: `${TYPE_COLORS[v.type] || "#64748b"}30`,
                          color: TYPE_COLORS[v.type] || "#64748b"
                        }}
                      >
                        {TYPE_LABELS[v.type] || v.type}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right font-mono text-slate-200">{v.txCount}</td>
                    <td className="py-2 text-right font-mono text-slate-400">
                      {v.slotDetails.length}
                      <span className="ml-1 text-sky-400">{expandedValidator === v.account ? "▲" : "▼"}</span>
                    </td>
                  </tr>
                  {expandedValidator === v.account && (
                    <tr>
                      <td colSpan={4} className="bg-slate-800/30 px-4 py-2">
                        <div className="flex flex-wrap gap-2">
                          {v.slotDetails.slice(0, 20).map((s) => (
                            <a
                              key={s.slot}
                              href={`/slot/${s.slot}`}
                              className="text-xs font-mono px-2 py-1 rounded bg-slate-700 text-sky-400 hover:bg-slate-600"
                            >
                              {s.slot} ({s.txCount} tx)
                            </a>
                          ))}
                          {v.slotDetails.length > 20 && (
                            <span className="text-xs text-slate-500 py-1">
                              +{v.slotDetails.length - 20} more
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
