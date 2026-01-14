import GeyserEntryPlot from "@/components/methodology/geyser-entry-plot";
import { fetchRecentSlotRange, fetchSlotDetail } from "@/lib/queries";
import type { SlotDetail } from "@/lib/types";
import Link from "next/link";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

async function loadSlotDetailForPage(slotParam?: string): Promise<{
  slotNumber: number | null;
  detail: SlotDetail | null;
  error: string | null;
  usedFallback: boolean;
}> {
  let requestedSlot =
    typeof slotParam === "string" ? parseInt(slotParam, 10) : NaN;
  if (!Number.isFinite(requestedSlot) || requestedSlot <= 0) {
    requestedSlot = NaN;
  }

  let slotNumber: number | null = Number.isFinite(requestedSlot)
    ? requestedSlot
    : null;
  let detail: SlotDetail | null = null;
  let error: string | null = null;
  let usedFallback = false;

  if (slotNumber) {
    try {
      detail = await fetchSlotDetail(slotNumber);
    } catch (err) {
      error =
        err instanceof Error
          ? err.message
          : "Unable to load the requested slot.";
    }
  }

  if (!detail) {
    try {
      const range = await fetchRecentSlotRange(1);
      const fallbackSlot = range?.maxSlot ?? null;
      if (fallbackSlot) {
        detail = await fetchSlotDetail(fallbackSlot);
        slotNumber = fallbackSlot;
        usedFallback = true;
      }
    } catch (err) {
      error =
        error ??
        (err instanceof Error
          ? err.message
          : "Unable to load the latest slot.");
    }
  }

  return { slotNumber, detail, error, usedFallback };
}

export default async function MethodologyPage({ searchParams }: PageProps) {
  const slotParam =
    typeof searchParams?.slot === "string" ? searchParams.slot : undefined;
  const { slotNumber, detail, error, usedFallback } =
    await loadSlotDetailForPage(slotParam);

  const metadata = detail?.metadata ?? null;
  const entries = detail?.entries ?? [];
  const zeroEntryCount =
    entries.filter((e) => e.executedTransactionCount === 0).length ??
    0;
  const totalTx = detail?.transactions.length ?? 0;
  const avgTxPerEntry =
    detail && entries.length
      ? (totalTx / entries.length).toFixed(2)
      : "0.00";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-slate-400">
          Solana Scheduler War
        </p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold">Methodology</h1>
          <Link
            href="/"
            className="text-sm font-medium text-sky-400 transition-colors hover:text-sky-300"
          >
            ← Back to dashboard
          </Link>
        </div>
        <p className="max-w-3xl text-sm text-slate-300">
          How we turn geyser streams into slot-by-slot sequencing views. Explore
          the raw entry trace below; dotted lines mark PoH ticks (entries with
          no executed transactions).
        </p>
      </header>

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Sample Slot
            </div>
            <div className="text-2xl font-semibold text-slate-50">
              {slotNumber ? slotNumber.toLocaleString() : "Not available"}
            </div>
          </div>
          <form className="flex flex-wrap items-end gap-3" method="get">
            <label className="flex flex-col text-xs uppercase tracking-wide text-slate-400">
              Slot number
              <input
                type="number"
                name="slot"
                defaultValue={slotParam ?? slotNumber ?? ""}
                placeholder="e.g. 377496174"
                className="mt-1 w-44 rounded border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100 focus:border-slate-500 focus:outline-none"
              />
            </label>
            <button
              type="submit"
              className="rounded bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-white"
            >
              Load slot
            </button>
          </form>
        </div>
        {usedFallback && (
          <p className="mt-3 text-xs text-amber-300">
            Requested slot could not be loaded; showing the latest slot from the
            past hour instead.
          </p>
        )}
        {error && (
          <p className="mt-3 text-xs text-red-300">
            {error}
          </p>
        )}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-xs text-slate-400">Entries observed</div>
            <div className="mt-1 text-xl font-semibold text-slate-50">
              {detail?.entries.length.toLocaleString() ?? "—"}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-xs text-slate-400">Zero-tx entries (ticks)</div>
            <div className="mt-1 text-xl font-semibold text-slate-50">
              {zeroEntryCount.toLocaleString()}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-xs text-slate-400">Avg tx per entry</div>
            <div className="mt-1 text-xl font-semibold text-slate-50">
              {avgTxPerEntry}
            </div>
          </div>
        </div>
      </div>

      <GeyserEntryPlot entries={detail?.entries ?? []} slotNumber={slotNumber} />

      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">Geyser entries table</div>
            <p className="text-xs text-slate-400">
              Full list of entries for the slot; zero-tx entries are PoH ticks.
            </p>
          </div>
          <div className="text-xs text-slate-400">
            Total entries: {entries.length.toLocaleString()}
          </div>
        </div>
        {entries.length === 0 ? (
          <div className="p-4 text-sm text-slate-400">No entries to display.</div>
        ) : (
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-slate-900/80 text-slate-400">
                <tr>
                  <th className="px-3 py-2">Entry idx</th>
                  <th className="px-3 py-2">Executed tx</th>
                  <th className="px-3 py-2">PoH tick?</th>
                  <th className="px-3 py-2">num_hashes</th>
                  <th className="px-3 py-2">Time (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {entries
                  .slice()
                  .sort((a, b) => a.index - b.index)
                  .map((entry) => {
                    const isTick = entry.executedTransactionCount === 0;
                    const timeIso = new Date(entry.time).toISOString();
                    return (
                      <tr key={entry.index} className="border-t border-slate-800 text-slate-200">
                        <td className="px-3 py-2 font-mono text-[11px]">{entry.index}</td>
                        <td className="px-3 py-2 font-mono text-[11px]">
                          {entry.executedTransactionCount.toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          {isTick ? (
                            <span className="rounded-full bg-slate-800 px-2 py-1 text-[11px] text-slate-100">
                              Yes
                            </span>
                          ) : (
                            <span className="text-slate-500">No</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px]">
                          {typeof entry.numHashes === "number" ? entry.numHashes.toLocaleString() : "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-300">{timeIso}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
          <div className="mb-3 text-sm font-semibold text-slate-100">
            Data inputs
          </div>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>
              <span className="font-semibold text-slate-100">Entries</span> from{" "}
              <code className="rounded bg-slate-800 px-1 py-0.5">bam.geyser_entries</code>{" "}
              with executed transaction counts and timestamps.
            </li>
            <li>
              <span className="font-semibold text-slate-100">Transactions</span>{" "}
              from{" "}
              <code className="rounded bg-slate-800 px-1 py-0.5">bam.geyser_transactions</code>{" "}
              including vote bits, CU used/requested, and fees.
            </li>
            <li>
              <span className="font-semibold text-slate-100">Slot metadata</span>{" "}
              from{" "}
              <code className="rounded bg-slate-800 px-1 py-0.5">bam.geyser_block_metadata</code>{" "}
              to identify the leader and align FirstShred timestamps.
            </li>
          </ul>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
        <div className="mb-3 text-sm font-semibold text-slate-100">
          Processing steps
          </div>
          <ol className="space-y-2 text-sm text-slate-300">
            <li>
              <span className="font-semibold text-slate-100">Map entries to ticks.</span>{" "}
              Any entry with zero executed transactions is treated as a PoH tick.
              We drop dotted guides at those indices on the chart.
            </li>
            <li>
              <span className="font-semibold text-slate-100">Accumulate transaction ranges.</span>{" "}
              Entry indices are used to build cumulative transaction offsets so
              each transaction can be tied back to the tick that preceded it.
            </li>
            <li>
              <span className="font-semibold text-slate-100">Compute slot metrics.</span>{" "}
              Slot time uses FirstShredReceived deltas; leader rewards sum fee
              share plus bundle tips; sequencing charts reuse the same entry ↔ tick map.
            </li>
          </ol>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
        <div className="mb-2 text-sm font-semibold text-slate-100">
          Slot duration methodology
        </div>
        <p className="text-sm text-slate-300">
          For each slot, we compute duration as{" "}
          <span className="font-mono text-xs text-slate-100">FirstShredReceived(slot) - FirstShredReceived(slot-1)</span>.
          If either timestamp is missing, the duration is left blank. This keeps slot time grounded
          in the actual onset of block production rather than block completion or vote landing.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">Last shred received (sample slot)</div>
            <p className="text-xs text-slate-400">
              Pulls FirstShredReceived and LastShredReceived from the geyser slot status stream for the loaded slot.
            </p>
          </div>
          <div className="text-xs text-slate-400">
            Slot: {slotNumber ? slotNumber.toLocaleString() : "—"}
          </div>
        </div>
        {!metadata ? (
          <div className="p-4 text-sm text-slate-400">No slot metadata available.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-slate-900/80 text-slate-400">
                <tr>
                  <th className="px-3 py-2">Slot</th>
                  <th className="px-3 py-2">Validator identity</th>
                  <th className="px-3 py-2">FirstShredReceived</th>
                  <th className="px-3 py-2">LastShredReceived</th>
                  <th className="px-3 py-2">Span (ms)</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const firstMs = metadata.firstShredTime ? new Date(metadata.firstShredTime).getTime() : null;
                  const lastMs = metadata.lastShredTime ? new Date(metadata.lastShredTime).getTime() : null;
                  const span = firstMs !== null && lastMs !== null ? Math.max(0, lastMs - firstMs) : null;
                  return (
                    <tr className="border-t border-slate-800 text-slate-200">
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {metadata.slot.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {metadata.leaderValidator}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {metadata.firstShredTime ? new Date(metadata.firstShredTime).toISOString() : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {metadata.lastShredTime ? new Date(metadata.lastShredTime).toISOString() : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {span !== null ? span.toLocaleString() : "—"}
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
        <div className="mb-2 text-sm font-semibold text-slate-100">
          How to read the entry plot
        </div>
        <p className="text-sm text-slate-300">
          The x-axis is the geyser entry index for the slot. Blue bars show how
          many executed transactions landed in each entry. Vertical dotted
          strokes mark PoH tick entries (zero transactions) that pace leader
          sequencing. Dense clusters of bars between dotted lines indicate
          aggressive packing between ticks; gaps or tall runs of dotted lines
          reveal idle PoH periods.
        </p>
      </div>
    </div>
  );
}
