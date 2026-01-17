"use client";

import { useMemo, useState } from "react";
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
  validatorName?: string | null;
  validatorClient?: string | null;
};

const DEFAULT_COLORS = [
  "#38bdf8",
  "#f472b6",
  "#facc15",
  "#a78bfa",
  "#34d399",
  "#fb7185",
  "#f97316",
  "#c084fc"
];

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

type TrackedAccount = {
  account: string;
  label: string;
  color: string;
  isDefault: boolean;
};

export default function PropAmmActivityChart({
  transactions,
  width,
  height,
  containerClassName,
  title,
  subtitle,
  hideHeader = false,
  slotNumber,
  validatorIdentity,
  validatorName,
  validatorClient
}: Props) {
  const [trackedAccounts, setTrackedAccounts] = useState<TrackedAccount[]>(() =>
    PROP_AMM_ACCOUNTS.map((a, idx) => ({
      account: a.account,
      label: a.label,
      color: DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
      isDefault: true
    }))
  );
  const [newAddress, setNewAddress] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#34d399");

  const propTransactions = useMemo(
    () => {
      const accountSet = new Set(trackedAccounts.map((a) => a.account));
      return transactions.filter((t) => {
        if (t.isVote) return false;
        if (t.propAmmAccount && accountSet.has(t.propAmmAccount)) return true;
        const txAccounts = [
          ...(t.staticSignedWritableAccounts ?? []),
          ...(t.staticSignedReadonlyAccounts ?? []),
          ...(t.staticUnsignedWritableAccounts ?? []),
          ...(t.staticUnsignedReadonlyAccounts ?? [])
        ];
        return txAccounts.some((addr) => accountSet.has(addr));
      });
    },
    [transactions, trackedAccounts]
  );

  const accountLines = useMemo(() => {
    const count = trackedAccounts.length || 1;
    const pointSpacing = 1 / (count + 1);
    return trackedAccounts.map((acct, idx) => ({
      ...acct,
      yFraction: pointSpacing * (idx + 1)
    }));
  }, [trackedAccounts]);

  const handleAddAccount = () => {
    const address = newAddress.trim();
    const label = newLabel.trim() || `Custom ${trackedAccounts.filter((a) => !a.isDefault).length + 1}`;

    if (!address) return;
    if (trackedAccounts.some((a) => a.account === address)) return;

    setTrackedAccounts((prev) => [...prev, { account: address, label, color: newColor, isDefault: false }]);
    setNewAddress("");
    setNewLabel("");
    setNewColor(DEFAULT_COLORS[(trackedAccounts.length + 1) % DEFAULT_COLORS.length]);
  };

  const handleRemoveAccount = (address: string) => {
    setTrackedAccounts((prev) => prev.filter((a) => a.account !== address));
  };

  const handleColorChange = (address: string, color: string) => {
    setTrackedAccounts((prev) =>
      prev.map((a) => (a.account === address ? { ...a, color } : a))
    );
  };

  const handleLabelChange = (address: string, label: string) => {
    setTrackedAccounts((prev) =>
      prev.map((a) => (a.account === address ? { ...a, label } : a))
    );
  };

  // Find most common accounts not already tracked
  const suggestedAccounts = useMemo(() => {
    const trackedSet = new Set(trackedAccounts.map((a) => a.account));
    const accountCounts = new Map<string, number>();

    // Count occurrences of each account across all non-vote transactions
    for (const tx of transactions) {
      if (tx.isVote) continue;
      const allAccounts = [
        ...(tx.staticSignedWritableAccounts ?? []),
        ...(tx.staticSignedReadonlyAccounts ?? []),
        ...(tx.staticUnsignedWritableAccounts ?? []),
        ...(tx.staticUnsignedReadonlyAccounts ?? [])
      ];
      for (const addr of allAccounts) {
        if (!trackedSet.has(addr)) {
          accountCounts.set(addr, (accountCounts.get(addr) || 0) + 1);
        }
      }
    }

    // Sort by count and return top suggestions
    return Array.from(accountCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([account, count]) => ({ account, count }));
  }, [transactions, trackedAccounts]);

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
  const headerSubtitleBase =
    subtitle ??
    `PoH ticks with compute-weighted arrivals per prop AMM signer (max tick #${tickValues})${
      slotNumber ? ` • Slot ${slotNumber.toLocaleString()}` : ""
    }${validatorIdentity ? ` • ${validatorName || validatorIdentity}` : ""}`;

  return (
    <div className={`overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40 p-6 ${containerClassName ?? ""}`}>
      {!hideHeader && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold">{headerTitle}</h3>
          <p className="text-sm text-slate-400">
            {headerSubtitleBase}
            {validatorClient && (
              <>
                {" • "}
                <span style={{ color: getClientColor(validatorClient) }}>{getClientDisplayName(validatorClient)}</span>
              </>
            )}
          </p>
        </div>
      )}

      {/* Tracked Accounts Table */}
      <div className="mb-6 overflow-hidden rounded-lg border border-slate-700 bg-slate-800/50">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/80 text-xs text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">Color</th>
              <th className="px-3 py-2 text-left">Label</th>
              <th className="px-3 py-2 text-left">Account</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {trackedAccounts.map((acct) => (
              <tr key={acct.account} className="border-t border-slate-700">
                <td className="px-3 py-2">
                  <input
                    type="color"
                    value={acct.color}
                    onChange={(e) => handleColorChange(acct.account, e.target.value)}
                    className="h-6 w-8 cursor-pointer rounded border border-slate-600 bg-transparent"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={acct.label}
                    onChange={(e) => handleLabelChange(acct.account, e.target.value)}
                    className="w-full rounded border border-slate-600 bg-slate-900/50 px-2 py-1 text-sm text-slate-200 focus:border-sky-500 focus:outline-none"
                  />
                </td>
                <td className="px-3 py-2">
                  <code className="text-xs text-slate-400">
                    {acct.account.slice(0, 8)}...{acct.account.slice(-8)}
                  </code>
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => handleRemoveAccount(acct.account)}
                    className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 hover:text-red-400"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {/* Add new account row */}
            <tr className="border-t border-slate-700 bg-slate-800/30">
              <td className="px-3 py-2">
                <input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="h-6 w-8 cursor-pointer rounded border border-slate-600 bg-transparent"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Label (optional)"
                  className="w-full rounded border border-slate-600 bg-slate-900/50 px-2 py-1 text-sm text-slate-200 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="Account address..."
                  className="w-full rounded border border-slate-600 bg-slate-900/50 px-2 py-1 font-mono text-xs text-slate-200 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                />
              </td>
              <td className="px-3 py-2 text-right">
                <button
                  onClick={handleAddAccount}
                  disabled={!newAddress.trim()}
                  className="rounded bg-sky-600 px-3 py-1 text-xs text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Quick suggestions */}
        {suggestedAccounts.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2 px-1 text-xs">
            <span className="text-slate-500">Quick add:</span>
            {suggestedAccounts.slice(0, 3).map((s) => (
              <button
                key={s.account}
                onClick={() => {
                  setTrackedAccounts((prev) => [
                    ...prev,
                    {
                      account: s.account,
                      label: `Account ${prev.filter((a) => !a.isDefault).length + 1}`,
                      color: DEFAULT_COLORS[(prev.length) % DEFAULT_COLORS.length],
                      isDefault: false
                    }
                  ]);
                }}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1 font-mono text-slate-400 hover:border-sky-500 hover:text-sky-400"
              >
                {s.account.slice(0, 4)}...{s.account.slice(-4)} <span className="text-slate-600">({s.count})</span>
              </button>
            ))}
          </div>
        )}
      </div>

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
            if (typeof tx.pohTickNumber !== "number") return null;

            // Find matching account - either from propAmmAccount or from transaction accounts
            let acct = tx.propAmmAccount
              ? accountLines.find((a) => a.account === tx.propAmmAccount)
              : null;

            // If no propAmmAccount match, check transaction accounts for custom accounts
            if (!acct) {
              const txAccounts = [
                ...(tx.staticSignedWritableAccounts ?? []),
                ...(tx.staticSignedReadonlyAccounts ?? []),
                ...(tx.staticUnsignedWritableAccounts ?? []),
                ...(tx.staticUnsignedReadonlyAccounts ?? [])
              ];
              acct = accountLines.find((a) => txAccounts.includes(a.account));
            }

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
          No matching transactions landed in this slot.
        </p>
      )}
    </div>
  );
}
