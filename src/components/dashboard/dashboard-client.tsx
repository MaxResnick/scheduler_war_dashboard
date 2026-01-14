"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import MetricCard from "@/components/dashboard/metric-card";
import MiniAreaChart from "@/components/charts/mini-area-chart";
import type { DashboardPayload } from "@/lib/types";

const RANGE_OPTIONS = [
  { label: "2h", hours: 2 },
  { label: "6h", hours: 6 },
  { label: "12h", hours: 12 },
  { label: "24h", hours: 24 }
];

type DashboardClientProps = {
  initialData: DashboardPayload;
};

export default function DashboardClient({
  initialData
}: DashboardClientProps) {
  const [data, setData] = useState<DashboardPayload>(initialData);
  const initialHours = useMemo(() => {
    const from = new Date(initialData.range.from).getTime();
    const to = new Date(initialData.range.to).getTime();
    const hours = Math.max(1, Math.round((to - from) / (60 * 60 * 1000)));
    return hours;
  }, [initialData.range.from, initialData.range.to]);

  const [selectedHours, setSelectedHours] = useState<number>(initialHours);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const derivedMetrics = useMemo(() => {
    const bundleTotals = data.bundles.reduce(
      (acc, point) => {
        acc.count += point.bundleCount;
        acc.profit += point.totalProfit ?? 0;
        return acc;
      },
      { count: 0, profit: 0 }
    );

    const avgBundleProfit = bundleTotals.count
      ? bundleTotals.profit / bundleTotals.count
      : 0;

    const totalTransactions = data.transactions.reduce(
      (sum, point) => sum + point.transactionCount,
      0
    );
    const totalEntries = data.entries.reduce(
      (sum, point) => sum + point.entryCount,
      0
    );

    const durationHours = Math.max(
      1,
      (new Date(data.range.to).getTime() -
        new Date(data.range.from).getTime()) /
        (60 * 60 * 1000)
    );

    const tps = totalTransactions / (durationHours * 3600);
    const entryRate = totalEntries / (durationHours * 3600);

    const slotStatusTotals = data.slotStatus.reduce<Record<string, number>>(
      (acc, point) => {
        acc[point.status] = (acc[point.status] ?? 0) + point.slotCount;
        return acc;
      },
      {}
    );

    const totalSlots = Object.values(slotStatusTotals).reduce(
      (sum, value) => sum + value,
      0
    );

    const slotStatusShare = Object.entries(slotStatusTotals)
      .map(([status, value]) => ({
        status,
        percentage: totalSlots ? (value / totalSlots) * 100 : 0
      }))
      .sort((a, b) => b.percentage - a.percentage);

    const latestBlockMeta = data.blockMetadata[data.blockMetadata.length - 1];

    return {
      bundleTotals,
      avgBundleProfit,
      tps,
      entryRate,
      slotStatusShare,
      latestBlockMeta
    };
  }, [data]);

  const bundleChart = useMemo(
    () =>
      data.bundles.map((point) => ({
        timestamp: point.windowStart,
        value: point.bundleCount
      })),
    [data.bundles]
  );

  const transactionChart = useMemo(
    () =>
      data.transactions.map((point) => ({
        timestamp: point.windowStart,
        value: point.transactionCount
      })),
    [data.transactions]
  );

  const entryChart = useMemo(
    () =>
      data.entries.map((point) => ({
        timestamp: point.windowStart,
        value: point.entryCount
      })),
    [data.entries]
  );

  const refreshData = useCallback(
    (hours: number) => {
      const previous = selectedHours;
      setSelectedHours(hours);

      startTransition(async () => {
        try {
          setError(null);
          const to = new Date();
          const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
          const url = new URL("/api/dashboard", window.location.origin);
          url.searchParams.set("from", from.toISOString());
          url.searchParams.set("to", to.toISOString());

          const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
              "Content-Type": "application/json"
            },
            cache: "no-store"
          });

          if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
          }

          const next = (await response.json()) as DashboardPayload;
          setData(next);
        } catch (err: unknown) {
          console.error("[dashboard-client] Failed to refresh data", err);
          setSelectedHours(previous);
          setError("Unable to refresh data. Check console for details.");
        }
      });
    },
    [selectedHours, startTransition]
  );

  // Keyboard shortcut: press "r" to refresh current range
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

  return (
    <section className="flex flex-col gap-8">
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
            Range: {new Date(data.range.from).toLocaleString()} → {new Date(data.range.to).toLocaleString()}
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
            title="Refresh dashboard"
          >
            {isPending ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Bundles landed"
          value={derivedMetrics.bundleTotals.count.toLocaleString()}
          delta={
            derivedMetrics.avgBundleProfit
              ? `avg profit ${derivedMetrics.avgBundleProfit.toFixed(2)}`
              : undefined
          }
          footer="Aggregated landed bundles for the selected window."
        />
        <MetricCard
          label="Geyser TPS"
          value={derivedMetrics.tps.toFixed(2)}
          delta={`${Math.round(derivedMetrics.tps * 60).toLocaleString()} tx/min`}
          footer="Average transactions per second across geyser stream."
        />
        <MetricCard
          label="Entry ingest rate"
          value={derivedMetrics.entryRate.toFixed(2)}
          delta={`${Math.round(derivedMetrics.entryRate * 60).toLocaleString()} entries/min`}
          footer="Approximate entries per second reaching the scheduler."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-lg border border-slate-800 bg-slate-900/40 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Bundle landings
              </h2>
              <p className="text-xs text-slate-400">
                Aggregated landed bundles and estimated profit.
              </p>
            </div>
            {isPending && (
              <span className="text-xs text-slate-400">Refreshing…</span>
            )}
          </div>
          <MiniAreaChart points={bundleChart} color="#38bdf8" />
          <div className="text-xs text-slate-400">
            Estimated total profit:{" "}
            {derivedMetrics.bundleTotals.profit.toLocaleString(undefined, {
              maximumFractionDigits: 0
            })}{" "}
            ◎
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-lg border border-slate-800 bg-slate-900/40 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Geyser throughput
              </h2>
              <p className="text-xs text-slate-400">
                Transactions entering the scheduler over time.
              </p>
            </div>
            {isPending && (
              <span className="text-xs text-slate-400">Refreshing…</span>
            )}
          </div>
          <MiniAreaChart points={transactionChart} color="#fbbf24" />
          <div className="text-xs text-slate-400">
            Total transactions: {totalTransactions(data.transactions).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-lg border border-slate-800 bg-slate-900/40 p-6">
          <div>
            <h2 className="text-lg font-semibold">
              Slot status distribution
            </h2>
            <p className="text-xs text-slate-400">
              Share of scheduler slots by reported status.
            </p>
          </div>
          <ul className="space-y-2 text-sm">
            {derivedMetrics.slotStatusShare.map((item) => (
              <li
                key={item.status}
                className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2"
              >
                <span className="font-medium capitalize text-slate-200">
                  {item.status}
                </span>
                <span className="text-slate-300">
                  {item.percentage.toFixed(1)}%
                </span>
              </li>
            ))}
            {!derivedMetrics.slotStatusShare.length && (
              <li className="text-xs text-slate-400">
                Slot status metrics unavailable for the selected window.
              </li>
            )}
          </ul>
        </div>

        <div className="flex flex-col gap-4 rounded-lg border border-slate-800 bg-slate-900/40 p-6">
          <div>
            <h2 className="text-lg font-semibold">
              Block metadata snapshot
            </h2>
            <p className="text-xs text-slate-400">
              Latest signal from geyser block metadata stream.
            </p>
          </div>
          {derivedMetrics.latestBlockMeta ? (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs uppercase text-slate-500">
                  Avg tx per block
                </dt>
                <dd className="text-lg font-semibold text-slate-200">
                  {formatNullable(derivedMetrics.latestBlockMeta.avgTxPerBlock)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">
                  Avg successful tx
                </dt>
                <dd className="text-lg font-semibold text-slate-200">
                  {formatNullable(derivedMetrics.latestBlockMeta.avgSuccessTx)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">
                  Avg compute units
                </dt>
                <dd className="text-lg font-semibold text-slate-200">
                  {formatNullable(
                    derivedMetrics.latestBlockMeta.avgComputeUnits
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">
                  Window
                </dt>
                <dd className="text-sm text-slate-300">
                  {new Date(
                    derivedMetrics.latestBlockMeta.windowStart
                  ).toLocaleString()}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-xs text-slate-400">
              Block metadata not available for the selected range yet.
            </p>
          )}
          <div className="text-xs text-slate-400">
            Entry ingest over time:
          </div>
          <MiniAreaChart points={entryChart} color="#34d399" height={120} />
        </div>
      </div>
    </section>
  );
}

function totalTransactions(
  transactions: DashboardPayload["transactions"]
): number {
  return transactions.reduce(
    (sum, point) => sum + point.transactionCount,
    0
  );
}

function formatNullable(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "—";
  }
  if (Math.abs(value) >= 100) {
    return Math.round(value).toLocaleString();
  }
  return value.toFixed(2);
}
