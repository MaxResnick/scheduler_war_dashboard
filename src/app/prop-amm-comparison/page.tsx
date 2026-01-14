import PropAmmActivityChart from "@/components/slot-detail/prop-amm-activity-chart";
import { fetchValidatorRecentSlotDetails } from "@/lib/queries";
import type { SlotDetail } from "@/lib/types";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

type ValidatorData = {
  slots: SlotDetail[];
  error: string | null;
};

async function getValidatorData(validator: string): Promise<ValidatorData> {
  const trimmed = validator.trim();
  if (!trimmed) return { slots: [], error: null };
  try {
    const slots = await fetchValidatorRecentSlotDetails(trimmed, 20);
    return { slots, error: null };
  } catch (error) {
    return {
      slots: [],
      error: error instanceof Error ? error.message : "Failed to load slots"
    };
  }
}

function ValidatorColumn({
  label,
  validator,
  data
}: {
  label: string;
  validator: string;
  data: ValidatorData;
}) {
  const heading = validator || `${label} (validator pubkey)`;

  if (!validator) {
    return (
      <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/30 p-6 text-sm text-slate-400">
        Enter a {label.toLowerCase()} validator above to load their most recent 20 slots.
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-900/20 p-6 text-sm text-red-300">
        Failed to load slots for {heading}: {data.error}
      </div>
    );
  }

  if (data.slots.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-300">
        No slots found for validator {heading}. Ensure the pubkey is correct and that the validator has recent block leadership.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
        <div className="mt-1 font-mono text-sm text-slate-100 break-all">{validator}</div>
        <div className="mt-1 text-xs text-slate-400">Showing {data.slots.length} most recent slots</div>
      </div>
      {data.slots.map((slotDetail) => {
        const propTx = slotDetail.transactions.filter((t) => t.propAmmAccount && !t.isVote);
        const slotNumber = slotDetail.metadata.slot;
        const pct = slotDetail.transactions.length
          ? ((propTx.length / slotDetail.transactions.length) * 100).toFixed(1)
          : "0.0";
        return (
          <div
            key={`slot-${slotNumber}`}
            className="rounded-lg border border-slate-800 bg-slate-900/40 p-4"
          >
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <div className="text-xs text-slate-400">Slot</div>
                <div className="font-semibold text-slate-100">{slotNumber.toLocaleString()}</div>
              </div>
              <div className="text-right text-xs text-slate-400">
                Prop AMM tx: {propTx.length.toLocaleString()} ({pct}% of txs)
              </div>
            </div>
            <PropAmmActivityChart
              transactions={slotDetail.transactions}
              width={560}
              height={220}
              hideHeader
              showLegend={false}
            />
          </div>
        );
      })}
    </div>
  );
}

export default async function PropAmmComparisonPage({ searchParams }: PageProps) {
  const params = searchParams ?? {};
  const validatorA =
    typeof params.validatorA === "string" ? params.validatorA.trim() : "";
  const validatorB =
    typeof params.validatorB === "string" ? params.validatorB.trim() : "";

  const [dataA, dataB] = await Promise.all([
    getValidatorData(validatorA),
    getValidatorData(validatorB)
  ]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-slate-400">
          Prop AMM Comparison
        </p>
        <h1 className="text-3xl font-semibold">Validator Sequencing Side-by-Side</h1>
        <p className="text-sm text-slate-400">
          Pick two validators to compare the latest 20 slots of prop AMM sequencing. Each card below shows PoH tick placement for prop AMM accounts with dot size scaled by compute units.
        </p>
      </header>

      <form className="grid gap-4 rounded-lg border border-slate-800 bg-slate-900/40 p-4 sm:grid-cols-2" method="get">
        <label className="flex flex-col text-sm text-slate-200">
          <span className="text-xs uppercase tracking-wide text-slate-400">Validator A</span>
          <input
            type="text"
            name="validatorA"
            defaultValue={validatorA}
            placeholder="Enter validator identity (base58)"
            className="mt-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm focus:border-slate-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col text-sm text-slate-200">
          <span className="text-xs uppercase tracking-wide text-slate-400">Validator B</span>
          <input
            type="text"
            name="validatorB"
            defaultValue={validatorB}
            placeholder="Enter validator identity (base58)"
            className="mt-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm focus:border-slate-500 focus:outline-none"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="mt-2 inline-flex items-center rounded bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white"
          >
            Compare Validators
          </button>
        </div>
      </form>

      <div className="grid gap-8 lg:grid-cols-2">
        <ValidatorColumn label="Validator A" validator={validatorA} data={dataA} />
        <ValidatorColumn label="Validator B" validator={validatorB} data={dataB} />
      </div>
    </div>
  );
}
