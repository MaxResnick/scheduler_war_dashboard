import ValidatorSlotsChart from "@/components/validator-slots-chart";
import { schedulerApiGet } from "@/lib/backend-api";
import Link from "next/link";

export default async function SlotLaggingPage() {
  const [laggingResult, allValidatorsResult, namesResult] = await Promise.all([
    schedulerApiGet<{
      data: Array<{
        validatorAddress: string;
        avgSlotTimeMs: number;
        slotCount: number;
        blockCount: number;
      }>;
    }>("/slot-lagging", { hours: 4 }),
    schedulerApiGet<{
      validators: Array<{ account: string; softwareClient: string }>;
    }>("/validators", { includeStake: "true" }),
    schedulerApiGet<{ names: Record<string, string> }>("/validators/names", { all: "true" })
  ]);
  const validators = laggingResult.data.map((r) => ({
    validator_address: r.validatorAddress,
    avg_slot_time_ms: r.avgSlotTimeMs,
    slot_count: r.slotCount,
    block_count: r.blockCount,
  }));
  const validatorNames = namesResult.names;

  // Build a map of validator address -> softwareClient for coloring
  const validatorClients: Record<string, string> = {};
  for (const v of allValidatorsResult.validators) {
    validatorClients[v.account] = v.softwareClient;
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-slate-400">
          Solana Scheduler War
        </p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold">Slot Lagging</h1>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700"
            >
              ← Home
            </Link>
            <Link
              href="/slot"
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700"
            >
              Slot Detail →
            </Link>
          </div>
        </div>
        <p className="max-w-2xl text-sm text-slate-300">
          Validators ranked by average time between consecutive leader slots (FirstShredReceived).
          Slower validators at the top. Uses 4-hour window. Colored by scheduler type.
          Excludes transition slots (first slot of each 4-slot leader window) to avoid cross-validator timing variance.
        </p>
      </header>

      <ValidatorSlotsChart
        validators={validators}
        validatorNames={validatorNames}
        validatorClients={validatorClients}
      />
    </div>
  );
}
