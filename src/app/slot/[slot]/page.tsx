import { fetchSlotDetail } from "@/lib/queries";
import SlotSearch from "@/components/slot-detail/slot-search";
import TransactionSequencingChart from "@/components/slot-detail/transaction-sequencing-chart";
import TransactionSequencingTimeline from "@/components/slot-detail/transaction-sequencing-timeline";
import TransactionProportionalBars from "@/components/slot-detail/transaction-proportional-bars";
import PropAmmActivityChart from "@/components/slot-detail/prop-amm-activity-chart";
import PropAmmTransactionsTable from "@/components/slot-detail/prop-amm-transactions-table";

type SlotPageProps = {
  params: { slot: string };
};

export default async function SlotPage({ params }: SlotPageProps) {
  const slot = parseInt(params.slot, 10);

  if (isNaN(slot) || slot <= 0) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-slate-400">
            Slot Detail
          </p>
          <h1 className="text-3xl font-semibold">Invalid Slot Number</h1>
        </header>
        <SlotSearch />
      </div>
    );
  }

  let slotData;
  try {
    slotData = await fetchSlotDetail(slot);
  } catch (error) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-slate-400">
            Slot Detail
          </p>
          <h1 className="text-3xl font-semibold">Error Loading Slot</h1>
          <p className="text-sm text-red-400">
            {error instanceof Error ? error.message : "Failed to fetch slot data"}
          </p>
        </header>
        <SlotSearch currentSlot={slot} />
      </div>
    );
  }

  const { metadata, entries, transactions } = slotData;

  // Calculate slot time as difference between FirstShredReceived of current and previous slot
  let slotTimeMs: number | null = null;
  if (metadata.prevSlotFirstShredTime && metadata.firstShredTime) {
    const prevSlotDate = new Date(metadata.prevSlotFirstShredTime);
    const currentSlotDate = new Date(metadata.firstShredTime);
    slotTimeMs = currentSlotDate.getTime() - prevSlotDate.getTime();
  }

  // (debug-only computations removed)

  // Aggregates for header cards
  const totalTipsLamports = transactions.reduce((sum, t) => sum + (t.allocatedTipLamports ?? 0), 0);
  const totalCuUsed = transactions
    .filter((t) => !t.isVote)
    .reduce((sum, t) => sum + (t.computeUnitsConsumed ?? 0), 0);
  // Sum of per-tx leader fee share + allocated tips computed server-side
  const blockRewardsLamports = transactions.reduce(
    (sum, t) => sum + (t.rewardLamports ?? ((t.feeLamports ?? 0))),
    0
  );
  const toSol = (lamports: number) => (lamports / 1_000_000_000).toFixed(4);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8">
      <header className="space-y-2">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-400">
              Solana Scheduler War
            </p>
            <h1 className="text-3xl font-semibold">Slot {slot}</h1>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Leader Validator</div>
            <div className="mt-1 max-w-[420px] truncate font-mono text-sm text-slate-200">
              {metadata.leaderValidator}
            </div>
          </div>
        </div>
      </header>

      <SlotSearch currentSlot={slot} />

      {/* Slot Highlights */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs text-slate-400">Slot Time</div>
          <div className="mt-1 text-2xl font-semibold">
            {slotTimeMs !== null ? `${slotTimeMs}ms` : "—"}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs text-slate-400">Jito Tips</div>
          <div className="mt-1 text-2xl font-semibold">{toSol(totalTipsLamports)} SOL</div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs text-slate-400">Block Rewards</div>
          <div className="mt-1 text-2xl font-semibold">{toSol(blockRewardsLamports)} SOL</div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs text-slate-400">Compute Units Used</div>
          <div className="mt-1 text-2xl font-semibold">{totalCuUsed.toLocaleString()}</div>
        </div>
      </div>

      {/* Transaction Sequencing Charts */}
      <TransactionProportionalBars
        transactions={transactions}
        slotNumber={slot}
        validatorIdentity={metadata.leaderValidator}
      />
      <TransactionSequencingTimeline
        entries={entries}
        transactions={transactions}
        slotNumber={slot}
        validatorIdentity={metadata.leaderValidator}
      />
      <TransactionSequencingChart
        entries={entries}
        transactions={transactions}
        slotNumber={slot}
        validatorIdentity={metadata.leaderValidator}
      />
      <PropAmmActivityChart
        transactions={transactions}
        slotNumber={slot}
        validatorIdentity={metadata.leaderValidator}
      />
      <PropAmmTransactionsTable transactions={transactions} />

      {/* Debug sections removed: bundles, entries, block metadata */}

      {/* Transactions (merged) */}
      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Transactions</h3>
          <div className="text-xs text-slate-400">
            Count: {transactions.length.toLocaleString()}
          </div>
        </div>
        <div className="max-h-[28rem] overflow-auto rounded">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-900/70 text-slate-400">
              <tr>
                <th className="px-2 py-1">Idx</th>
                <th className="px-2 py-1">Signature</th>
                <th className="px-2 py-1">Type</th>
                <th className="px-2 py-1">CU Used</th>
                <th className="px-2 py-1">CU Requested</th>
                <th className="px-2 py-1">Allocated Tip</th>
                <th className="px-2 py-1">Fee</th>
                <th className="px-2 py-1">PoH Tick #</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={`${t.signature}-${t.index}`} className="border-t border-slate-800 text-slate-200">
                  <td className="px-2 py-1 font-mono">{t.index}</td>
                  <td className="px-2 py-1 font-mono">
                    {t.signature.slice(0, 8)}…{t.signature.slice(-8)}
                  </td>
                  <td className="px-2 py-1">
                    {t.isVote ? "Vote" : t.isJitoBundle ? "Jito" : "TPU"}
                  </td>
                  <td className="px-2 py-1">{t.computeUnitsConsumed?.toLocaleString() ?? "—"}</td>
                  <td className="px-2 py-1">{t.computeUnitsRequested?.toLocaleString() ?? "—"}</td>
                  <td className="px-2 py-1">{(t.allocatedTipLamports ?? 0).toLocaleString()}</td>
                  <td className="px-2 py-1">{(t.feeLamports ?? 0).toLocaleString()}</td>
                  <td className="px-2 py-1">{typeof t.pohTickNumber === 'number' ? t.pohTickNumber + 1 : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs text-slate-400">Total Entries</div>
          <div className="mt-1 text-2xl font-semibold">{entries.length}</div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs text-slate-400">Total Transactions</div>
          <div className="mt-1 text-2xl font-semibold">{transactions.length}</div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs text-slate-400">Vote Transactions</div>
          <div className="mt-1 text-2xl font-semibold">
            {transactions.filter((t) => t.isVote).length}
          </div>
        </div>
      </div>
    </div>
  );
}
