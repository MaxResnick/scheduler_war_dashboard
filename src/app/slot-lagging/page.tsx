import ValidatorSlotsChart from "@/components/validator-slots-chart";
import { getClickHouseClient } from "@/lib/clickhouse";
import { getAllValidatorNames, getAllValidators } from "@/lib/validators-app";
import Link from "next/link";

async function fetchValidatorSlots() {
  const client = getClickHouseClient();

  const query = `
    WITH first_shred_events AS (
      SELECT
        ss.slot,
        ss.time,
        bm.validator_identity
      FROM bam.geyser_slot_status ss
      JOIN bam.geyser_block_metadata bm ON ss.slot = bm.slot
      WHERE ss.status = 'FirstShredReceived'
        AND ss.time >= now() - INTERVAL 4 HOUR
        AND bm.time >= now() - INTERVAL 4 HOUR
    ),
    with_prev AS (
      SELECT
        validator_identity,
        slot,
        time,
        lagInFrame(slot, 1) OVER (PARTITION BY validator_identity ORDER BY slot) AS prev_slot,
        lagInFrame(time, 1) OVER (PARTITION BY validator_identity ORDER BY slot) AS prev_time
      FROM first_shred_events
    )
    SELECT
      base58Encode(validator_identity) AS validator_address,
      avg(dateDiff('millisecond', prev_time, time)) AS avg_slot_time_ms,
      count(DISTINCT slot) AS slot_count,
      count() AS block_count
    FROM with_prev
    WHERE prev_time IS NOT NULL
      AND prev_slot IS NOT NULL
      AND (slot - prev_slot) = 1
      AND slot % 4 != 0  -- Exclude transition slots (first slot of each 4-slot leader window)
    GROUP BY validator_identity
    ORDER BY avg_slot_time_ms DESC
    FORMAT JSON
  `;

  const result = await client.query(query).toPromise();
  return result as Array<{
    validator_address: string;
    avg_slot_time_ms: number;
    slot_count: number;
    block_count: number;
  }>;
}

export default async function SlotLaggingPage() {
  const validators = await fetchValidatorSlots();
  const validatorNames = getAllValidatorNames();

  // Build a map of validator address -> softwareClient for coloring
  const allValidators = getAllValidators();
  const validatorClients: Record<string, string> = {};
  for (const v of allValidators) {
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
