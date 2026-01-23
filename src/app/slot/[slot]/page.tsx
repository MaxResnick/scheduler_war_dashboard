import { fetchSlotDetail } from "@/lib/queries";
import type { SlotDetail } from "@/lib/types";
import { getValidatorName, getAllValidators } from "@/lib/validators-app";
import SlotSearch from "@/components/slot-detail/slot-search";
import TransactionSequencingChart from "@/components/slot-detail/transaction-sequencing-chart";
import TransactionSequencingTimeline from "@/components/slot-detail/transaction-sequencing-timeline";
import TransactionProportionalBars from "@/components/slot-detail/transaction-proportional-bars";
import PropAmmActivityChart from "@/components/slot-detail/prop-amm-activity-chart";

type SlotPageProps = {
  params: { slot: string };
};

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

  let slotData: SlotDetail;
  let leaderValidatorName: string | null = null;
  let leaderValidatorClient: string | null = null;
  try {
    const [fetchedSlotData, allValidators] = await Promise.all([
      fetchSlotDetail(slot),
      getAllValidators(),
    ]);
    slotData = fetchedSlotData;
    // Get validator name and client from cached data
    leaderValidatorName = getValidatorName(slotData.metadata.leaderValidator);
    const leaderValidator = allValidators.find(v => v.account === slotData.metadata.leaderValidator);
    leaderValidatorClient = leaderValidator?.softwareClient ?? null;
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

  // Transition slot is the first slot of each 4-slot leader window
  const isTransitionSlot = slot % 4 === 0;

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
            {leaderValidatorName && (
              <div className="mt-1 text-sm font-medium text-sky-400">
                {leaderValidatorName}
              </div>
            )}
            <div className={`${leaderValidatorName ? 'mt-0.5' : 'mt-1'} max-w-[420px] truncate font-mono text-xs text-slate-400`}>
              {metadata.leaderValidator}
            </div>
            {leaderValidatorClient && (
              <div className="mt-1 flex items-center justify-end gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: getClientColor(leaderValidatorClient) }}
                />
                <span className="text-xs font-medium" style={{ color: getClientColor(leaderValidatorClient) }}>
                  {getClientDisplayName(leaderValidatorClient)}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {isTransitionSlot && (
        <div className="rounded-lg border border-amber-600/50 bg-amber-900/20 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-amber-400">⚠</span>
            <span className="text-sm font-medium text-amber-300">Transition Slot</span>
          </div>
          <p className="mt-1 text-xs text-amber-200/80">
            This is the first slot of a 4-slot leader window. Slot time measurements may include
            cross-validator timing variance and should be interpreted with caution.
          </p>
        </div>
      )}

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
        validatorName={leaderValidatorName}
        validatorClient={leaderValidatorClient}
      />
      <TransactionSequencingTimeline
        entries={entries}
        transactions={transactions}
        slotNumber={slot}
        validatorIdentity={metadata.leaderValidator}
        validatorName={leaderValidatorName}
        validatorClient={leaderValidatorClient}
      />
      <TransactionSequencingChart
        entries={entries}
        transactions={transactions}
        slotNumber={slot}
        validatorIdentity={metadata.leaderValidator}
        validatorName={leaderValidatorName}
        validatorClient={leaderValidatorClient}
      />
      <PropAmmActivityChart
        transactions={transactions}
        slotNumber={slot}
        validatorName={leaderValidatorName}
        validatorIdentity={metadata.leaderValidator}
        validatorClient={leaderValidatorClient}
      />
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
