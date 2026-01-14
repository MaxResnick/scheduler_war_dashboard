import PropAmmWinrateScatter, {
  ValidatorWinRate
} from "@/components/prop-amm-winrate-scatter";
import { fetchPropAmmFirstWins } from "@/lib/queries";
import { getEpochPropAmmWinData, getRecentPropAmmWinData } from "@/lib/prop-amm-cache";
import { PROP_AMM_GROUPS, PROP_AMM_GROUP_COLORS, PropAmmGroup } from "@/lib/prop-amm";
import type { PropAmmFirstWin } from "@/lib/types";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function buildSummary(wins: PropAmmFirstWin[]) {
  const summaryMap = new Map<
    string,
    {
      validator: string;
      totalSlots: number;
      groupWins: Record<string, number>;
    }
  >();

  wins.forEach((win) => {
    const entry =
      summaryMap.get(win.validator) ??
      {
        validator: win.validator,
        totalSlots: 0,
        groupWins: {}
      };
    entry.totalSlots += 1;
    const groupKey = win.group ?? "Unknown";
    entry.groupWins[groupKey] = (entry.groupWins[groupKey] ?? 0) + 1;
    summaryMap.set(win.validator, entry);
  });

  return Array.from(summaryMap.values());
}

function buildChartData(summary: ReturnType<typeof buildSummary>): ValidatorWinRate[] {
  return summary.map((entry) => {
    const winRates: Record<string, number> = {};
    PROP_AMM_GROUPS.forEach((group) => {
      const wins = entry.groupWins[group] ?? 0;
      winRates[group] = entry.totalSlots > 0 ? wins / entry.totalSlots : 0;
    });
    return {
      validator: entry.validator,
      totalSlots: entry.totalSlots,
      winRates
    };
  });
}

type WinrateSortField = "slots" | (typeof PROP_AMM_GROUPS)[number];

function sortSummary(
  summary: ReturnType<typeof buildSummary>,
  sortBy: WinrateSortField,
  sortDir: "asc" | "desc"
) {
  const multiplier = sortDir === "asc" ? 1 : -1;
  return [...summary].sort((a, b) => {
    let aVal: number;
    let bVal: number;
    if (sortBy === "slots") {
      aVal = a.totalSlots;
      bVal = b.totalSlots;
    } else {
      const aWins = a.groupWins[sortBy] ?? 0;
      const bWins = b.groupWins[sortBy] ?? 0;
      aVal = a.totalSlots > 0 ? aWins / a.totalSlots : 0;
      bVal = b.totalSlots > 0 ? bWins / b.totalSlots : 0;
    }
    return (aVal - bVal) * multiplier;
  });
}

export default async function PropAmmWinratesPage({ searchParams }: PageProps) {
  const params = searchParams ?? {};
  const startSlotParam =
    typeof params.startSlot === "string" ? parseInt(params.startSlot, 10) : NaN;
  const endSlotParam =
    typeof params.endSlot === "string" ? parseInt(params.endSlot, 10) : NaN;

  const useCustomRange = Number.isFinite(startSlotParam) && Number.isFinite(endSlotParam);

  const sortByParamRaw =
    typeof params.sortBy === "string" ? params.sortBy : "slots";
  const sortDirParam =
    typeof params.sortDir === "string" && params.sortDir === "asc" ? "asc" : "desc";
  const allowableSortFields = ["slots", ...PROP_AMM_GROUPS] as const;
  const sortByParam = allowableSortFields.includes(
    sortByParamRaw as WinrateSortField
  )
    ? (sortByParamRaw as WinrateSortField)
    : "slots";

  let wins: PropAmmFirstWin[] = [];
  let error: string | null = null;
  let normalizedStart = Number.isFinite(startSlotParam) ? startSlotParam : null;
  let normalizedEnd = Number.isFinite(endSlotParam) ? endSlotParam : null;
  let cacheGeneratedAt: string | null = null;
  let cacheLabel: string | null = null;
  let epochNumber: number | null = null;
  let defaultSource: "epoch" | "recent" | "custom" = useCustomRange ? "custom" : "epoch";

  if (useCustomRange) {
    try {
      wins = await fetchPropAmmFirstWins(startSlotParam, endSlotParam);
      const [fromSlot, toSlot] =
        startSlotParam <= endSlotParam
          ? [startSlotParam, endSlotParam]
          : [endSlotParam, startSlotParam];
      normalizedStart = fromSlot;
      normalizedEnd = toSlot;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load win data";
    }
  } else {
    try {
      const cache = await getEpochPropAmmWinData();
      wins = cache.wins;
      normalizedStart = cache.startSlot;
      normalizedEnd = cache.endSlot;
      cacheGeneratedAt = cache.generatedAt;
      cacheLabel = cache.label ?? null;
      epochNumber = cache.epoch ?? null;
    } catch (err) {
      try {
        const fallback = await getRecentPropAmmWinData();
        wins = fallback.wins;
        normalizedStart = fallback.startSlot;
        normalizedEnd = fallback.endSlot;
        cacheGeneratedAt = fallback.generatedAt;
        cacheLabel = fallback.label ?? null;
        defaultSource = "recent";
      } catch (fallbackErr) {
        error =
          fallbackErr instanceof Error
            ? fallbackErr.message
            : "Failed to load cached win data";
      }
    }
  }

  const baseSummary = buildSummary(wins).sort((a, b) => b.totalSlots - a.totalSlots);
  const topBySlots = baseSummary.slice(0, 200);
  const sortedSummary = sortSummary(topBySlots, sortByParam, sortDirParam);
  const chartData = buildChartData(sortedSummary);
  const totalValidators = baseSummary.length;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-slate-400">
          Prop AMM analysis
        </p>
        <h1 className="text-3xl font-semibold">First Oracle Update Win Rates</h1>
        <p className="text-sm text-slate-400">
          Compare how often each prop AMM oracle (Humi, Tess, Sv2) lands the first update
          in a slot, segmented by leader validator. By default, the dashboard loads the most recent completed epoch snapshot; provide a slot range to analyze a custom window.
        </p>
      </header>

      <form className="grid gap-4 rounded-lg border border-slate-800 bg-slate-900/40 p-4 sm:grid-cols-2" method="get">
        <label className="flex flex-col text-sm text-slate-200">
          <span className="text-xs uppercase tracking-wide text-slate-400">Start slot</span>
          <input
            type="number"
            name="startSlot"
            defaultValue={Number.isFinite(startSlotParam) ? startSlotParam : ""}
            className="mt-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm focus:border-slate-500 focus:outline-none"
            placeholder="e.g. 377496100"
          />
        </label>
        <label className="flex flex-col text-sm text-slate-200">
          <span className="text-xs uppercase tracking-wide text-slate-400">End slot</span>
          <input
            type="number"
            name="endSlot"
            defaultValue={Number.isFinite(endSlotParam) ? endSlotParam : ""}
            className="mt-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm focus:border-slate-500 focus:outline-none"
            placeholder="e.g. 377496300"
          />
        </label>
        <label className="flex flex-col text-sm text-slate-200">
          <span className="text-xs uppercase tracking-wide text-slate-400">Sort by</span>
          <select
            name="sortBy"
            defaultValue={sortByParam}
            className="mt-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            <option value="slots">Slots counted</option>
            {PROP_AMM_GROUPS.map((group) => (
              <option key={`sort-${group}`} value={group}>
                {group} win %
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm text-slate-200">
          <span className="text-xs uppercase tracking-wide text-slate-400">Sort direction</span>
          <select
            name="sortDir"
            defaultValue={sortDirParam}
            className="mt-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="mt-2 inline-flex items-center rounded bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white"
          >
            Analyze range
          </button>
          <p className="mt-2 text-xs text-slate-500">
            Large ranges can take a while to compute; only slots with tracked prop AMM oracle updates are counted.
          </p>
        </div>
      </form>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {!error && wins.length > 0 && (
        <>
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-300">
            <div>
              <span className="font-semibold text-slate-100">{wins.length.toLocaleString()}</span>{" "}
              slots had at least one tracked prop AMM oracle update between{" "}
              <span className="font-mono text-slate-100">{normalizedStart?.toLocaleString()}</span>{" "}
              and{" "}
              <span className="font-mono text-slate-100">{normalizedEnd?.toLocaleString()}</span>.
            </div>
            {!useCustomRange && cacheGeneratedAt && (
              <div className="mt-1 text-xs text-slate-500">
                {(cacheLabel ?? (defaultSource === "epoch" ? "Epoch snapshot" : "Recent cache"))} refreshed at{" "}
                {new Date(cacheGeneratedAt).toLocaleString()}.
                {defaultSource === "epoch" && epochNumber !== null && (
                  <> (Epoch {epochNumber})</>
                )}
              </div>
            )}
            <div className="mt-1 text-xs text-slate-500">
              Each slot contributes exactly one win: the earliest oracle update among Humi, Tess, and Sv2 signers.
            </div>
          </div>

          {totalValidators > topBySlots.length && (
            <div className="mb-2 text-xs text-slate-500">
              Showing top {topBySlots.length} validators by slots (of {totalValidators.toLocaleString()} total).
            </div>
          )}

          <PropAmmWinrateScatter data={chartData} />

          <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40">
            <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-slate-100">
              Validator win rate summary
            </div>
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full text-left text-xs text-slate-200">
                <thead className="bg-slate-900/60 text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Validator</th>
                    <th className="px-3 py-2">Slots counted</th>
                    {PROP_AMM_GROUPS.map((group) => (
                      <th key={`head-${group}`} className="px-3 py-2">
                        {group} win %
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedSummary.map((entry) => {
                    const winRates = PROP_AMM_GROUPS.map((group) => ({
                      group,
                      rate:
                        entry.totalSlots > 0
                          ? (entry.groupWins[group] ?? 0) / entry.totalSlots
                          : 0
                    }));
                    return (
                      <tr key={entry.validator} className="border-t border-slate-800">
                        <td className="px-3 py-2 font-mono">{entry.validator}</td>
                        <td className="px-3 py-2">{entry.totalSlots.toLocaleString()}</td>
                        {winRates.map(({ group, rate }) => (
                          <td key={`${entry.validator}-${group}`} className="px-3 py-2">
                            {formatPercent(rate)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40">
            <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-slate-100">
              Slot-level winners
            </div>
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full text-left text-xs text-slate-200">
                <thead className="bg-slate-900/60 text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Slot</th>
                    <th className="px-3 py-2">Validator</th>
                    <th className="px-3 py-2">Winner</th>
                    <th className="px-3 py-2">Signature</th>
                    <th className="px-3 py-2">Tx Index</th>
                  </tr>
                </thead>
                <tbody>
                  {wins.map((win) => (
                    <tr key={`slot-${win.slot}`} className="border-t border-slate-800">
                      <td className="px-3 py-2 font-mono">{win.slot.toLocaleString()}</td>
                      <td className="px-3 py-2 font-mono">{win.validator}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{
                              backgroundColor:
                                win.group && (PROP_AMM_GROUPS as readonly string[]).includes(win.group)
                                  ? PROP_AMM_GROUP_COLORS[win.group as PropAmmGroup]
                                  : "#94a3b8"
                            }}
                          />
                          {win.group ?? "Unknown"}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono">
                        <a
                          href={`https://solscan.io/tx/${win.signature}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-400 hover:underline"
                        >
                          {win.signature.slice(0, 8)}…{win.signature.slice(-8)}
                        </a>
                      </td>
                      <td className="px-3 py-2">{win.transactionIndex}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!error && wins.length === 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-300">
          No tracked oracle updates detected in this window.
        </div>
      )}
    </div>
  );
}
