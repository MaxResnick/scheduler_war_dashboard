import { schedulerApiGet } from "@/lib/backend-api";
import Link from "next/link";

type LeaderboardEntry = {
  rank: number;
  validator: string;
  validatorName: string | null;
  softwareClient: string;
  blockCount: number;
  totalValidatorRewardSol: number;
  totalTipsSol: number;
  totalFeeSol: number;
  totalTxCount: number;
  totalNonVoteTxCount: number;
  totalCuConsumed: number;
};

type RewardsResponse = {
  data: {
    epoch: number;
    page: number;
    pageSize: number;
    totalValidators: number;
    totalPages: number;
    generatedAt: string;
    leaderboard: LeaderboardEntry[];
  };
  meta: { stale: boolean };
};

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function formatSol(sol: number): string {
  return sol.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

function buildLeaderboardHref({
  epoch,
  page,
  pageSize,
}: {
  epoch: number;
  page: number;
  pageSize: number;
}) {
  return {
    pathname: "/rewards-leaderboard",
    query: {
      epoch: String(epoch),
      page: String(page),
      pageSize: String(pageSize),
    },
  } as const;
}

export default async function RewardsLeaderboardPage({ searchParams }: PageProps) {
  const params = searchParams ?? {};
  const epochParam =
    typeof params.epoch === "string" ? parseInt(params.epoch, 10) : NaN;
  const pageParam =
    typeof params.page === "string" ? parseInt(params.page, 10) : NaN;
  const pageSizeParam =
    typeof params.pageSize === "string" ? parseInt(params.pageSize, 10) : NaN;
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const pageSize =
    Number.isFinite(pageSizeParam) && pageSizeParam > 0
      ? Math.min(pageSizeParam, 200)
      : 50;

  let data: RewardsResponse["data"] | null = null;
  let stale = false;
  let error: string | null = null;

  try {
    const result = await schedulerApiGet<RewardsResponse>(
      "/rewards/leaderboard",
      {
        ...(Number.isFinite(epochParam) ? { epoch: epochParam } : {}),
        page,
        pageSize,
      }
    );
    data = result.data;
    stale = result.meta?.stale ?? false;
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load rewards data";
  }

  const totalRewards = data?.leaderboard.reduce((sum, e) => sum + e.totalValidatorRewardSol, 0) ?? 0;
  const totalBlocks = data?.leaderboard.reduce((sum, e) => sum + e.blockCount, 0) ?? 0;
  const pageStart = data ? (data.page - 1) * data.pageSize + 1 : 0;
  const pageEnd = data
    ? Math.min(data.page * data.pageSize, data.totalValidators)
    : 0;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-slate-400">
          Solana Scheduler War
        </p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold">Rewards Leaderboard</h1>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700"
            >
              &larr; Home
            </Link>
          </div>
        </div>
        <p className="max-w-2xl text-sm text-slate-300">
          Validators ranked by total rewards earned as block leader in a given epoch.
          Rewards include base fees and tips.
        </p>
      </header>

      {/* Epoch selector */}
      <form
        className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
        method="get"
      >
        <label className="flex flex-col text-sm text-slate-200">
          <span className="text-xs uppercase tracking-wide text-slate-400">Epoch</span>
          <input
            type="number"
            name="epoch"
            defaultValue={Number.isFinite(epochParam) ? epochParam : data?.epoch ?? ""}
            className="mt-1 w-40 rounded border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm focus:border-slate-500 focus:outline-none"
            placeholder="e.g. 750"
          />
        </label>
        <label className="flex flex-col text-sm text-slate-200">
          <span className="text-xs uppercase tracking-wide text-slate-400">Page Size</span>
          <input
            type="number"
            name="pageSize"
            min={1}
            max={200}
            defaultValue={data?.pageSize ?? pageSize}
            className="mt-1 w-32 rounded border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm focus:border-slate-500 focus:outline-none"
            placeholder="50"
          />
        </label>
        <input type="hidden" name="page" value="1" />
        <button
          type="submit"
          className="inline-flex items-center rounded bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white"
        >
          Search
        </button>
      </form>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {data && !error && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">Epoch</div>
              <div className="mt-1 text-2xl font-semibold text-slate-100">
                {data.epoch.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">Total Rewards</div>
              <div className="mt-1 text-2xl font-semibold text-slate-100">
                {formatSol(totalRewards)} SOL
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">Total Blocks</div>
              <div className="mt-1 text-2xl font-semibold text-slate-100">
                {totalBlocks.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">Validators</div>
              <div className="mt-1 text-2xl font-semibold text-slate-100">
                {data.totalValidators.toLocaleString()}
              </div>
            </div>
          </div>

          {stale && (
            <div className="rounded-lg border border-amber-800 bg-amber-900/20 p-3 text-xs text-amber-200">
              This data may be stale. Generated at{" "}
              {new Date(data.generatedAt).toLocaleString()}.
            </div>
          )}

          {/* Leaderboard table */}
          <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40">
            <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-slate-100">
              Leaderboard &mdash; Epoch {data.epoch}
            </div>
            <div className="max-h-[40rem] overflow-auto">
              <table className="w-full text-left text-sm text-slate-200">
                <thead className="sticky top-0 bg-slate-900/90 text-xs text-slate-400 backdrop-blur">
                  <tr>
                    <th className="px-4 py-3 text-right w-16">Rank</th>
                    <th className="px-4 py-3">Validator</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3 text-right">Validator Rewards</th>
                    <th className="px-4 py-3 text-right">Tips</th>
                    <th className="px-4 py-3 text-right">Fees</th>
                    <th className="px-4 py-3 text-right">Blocks</th>
                    <th className="px-4 py-3 text-right">Avg / Block</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leaderboard.map((entry) => (
                    <tr key={entry.validator} className="border-t border-slate-800 hover:bg-slate-800/40">
                      <td className="px-4 py-3 text-right font-mono text-slate-400">
                        {entry.rank}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-100">
                            {entry.validatorName || truncateAddress(entry.validator)}
                          </span>
                          {entry.validatorName && (
                            <span className="font-mono text-xs text-slate-500">
                              {truncateAddress(entry.validator)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{entry.softwareClient}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatSol(entry.totalValidatorRewardSol)} SOL
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatSol(entry.totalTipsSol)} SOL
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatSol(entry.totalFeeSol)} SOL
                      </td>
                      <td className="px-4 py-3 text-right">
                        {entry.blockCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-400">
                        {entry.blockCount > 0
                          ? formatSol(entry.totalValidatorRewardSol / entry.blockCount)
                          : "\u2014"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm text-slate-300">
            <span>
              Showing {pageStart.toLocaleString()}-{pageEnd.toLocaleString()} of{" "}
              {data.totalValidators.toLocaleString()} validators
            </span>
            <div className="flex items-center gap-2">
              {data.page > 1 ? (
                <Link
                  href={buildLeaderboardHref({
                    epoch: data.epoch,
                    page: data.page - 1,
                    pageSize: data.pageSize,
                  })}
                  className="rounded border border-slate-700 px-3 py-1.5 text-slate-200 hover:bg-slate-800"
                >
                  Previous
                </Link>
              ) : (
                <span className="rounded border border-slate-800 px-3 py-1.5 text-slate-500">
                  Previous
                </span>
              )}
              <span className="px-1 text-slate-400">
                Page {data.page.toLocaleString()} of {Math.max(data.totalPages, 1).toLocaleString()}
              </span>
              {data.page < data.totalPages ? (
                <Link
                  href={buildLeaderboardHref({
                    epoch: data.epoch,
                    page: data.page + 1,
                    pageSize: data.pageSize,
                  })}
                  className="rounded border border-slate-700 px-3 py-1.5 text-slate-200 hover:bg-slate-800"
                >
                  Next
                </Link>
              ) : (
                <span className="rounded border border-slate-800 px-3 py-1.5 text-slate-500">
                  Next
                </span>
              )}
            </div>
          </div>
        </>
      )}

      {data && !error && data.leaderboard.length === 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-300">
          No rewards data found for this epoch.
        </div>
      )}
    </div>
  );
}
