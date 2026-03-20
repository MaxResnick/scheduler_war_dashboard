import PropAmmActivityChart from "@/components/slot-detail/prop-amm-activity-chart";
import { schedulerApiGet } from "@/lib/backend-api";
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
    const recentSlotsResult = await schedulerApiGet<{
      slots: Array<{ slot: number }>;
    }>(`/validators/${trimmed}/slots`, { limit: 20 });

    const detailedSlots = await Promise.all(
      recentSlotsResult.slots.map(async ({ slot }) => {
        try {
          return await schedulerApiGet<SlotDetail>(`/slots/${slot}`);
        } catch {
          return null;
        }
      })
    );

    const slots = detailedSlots.filter((detail): detail is SlotDetail => detail !== null);
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
      <div className="rounded-lg border border-dashed border-anza-border bg-anza-surface/30 p-6 text-sm text-anza-green-muted">
        Enter a {label.toLowerCase()} validator above to load their most recent 20 slots.
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-6 text-sm text-red-700">
        Failed to load slots for {heading}: {data.error}
      </div>
    );
  }

  if (data.slots.length === 0) {
    return (
      <div className="rounded-lg border border-anza-border bg-anza-surface p-6 text-sm text-anza-green-mid">
        No slots found for validator {heading}. Ensure the pubkey is correct and that the validator has recent block leadership.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-anza-border bg-anza-surface p-4">
        <div className="text-xs uppercase tracking-wide text-anza-green-muted">{label}</div>
        <div className="mt-1 font-mono text-sm text-anza-green break-all">{validator}</div>
        <div className="mt-1 text-xs text-anza-green-muted">Showing {data.slots.length} most recent slots</div>
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
            className="rounded-lg border border-anza-border bg-anza-surface p-4"
          >
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <div className="text-xs text-anza-green-muted">Slot</div>
                <div className="font-semibold text-anza-green">{slotNumber.toLocaleString()}</div>
              </div>
              <div className="text-right text-xs text-anza-green-muted">
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
        <p className="text-sm uppercase tracking-wide text-anza-green-muted">
          Prop AMM Comparison
        </p>
        <h1 className="text-3xl font-semibold">Validator Sequencing Side-by-Side</h1>
        <p className="text-sm text-anza-green-muted">
          Pick two validators to compare the latest 20 slots of prop AMM sequencing. Each card below shows PoH tick placement for prop AMM accounts with dot size scaled by compute units.
        </p>
      </header>

      <form className="grid gap-4 rounded-lg border border-anza-border bg-anza-surface p-4 sm:grid-cols-2" method="get">
        <label className="flex flex-col text-sm text-anza-green">
          <span className="text-xs uppercase tracking-wide text-anza-green-muted">Validator A</span>
          <input
            type="text"
            name="validatorA"
            defaultValue={validatorA}
            placeholder="Enter validator identity (base58)"
            className="mt-1 rounded border border-anza-border bg-white px-3 py-2 font-mono text-sm focus:border-anza-green focus:outline-none"
          />
        </label>
        <label className="flex flex-col text-sm text-anza-green">
          <span className="text-xs uppercase tracking-wide text-anza-green-muted">Validator B</span>
          <input
            type="text"
            name="validatorB"
            defaultValue={validatorB}
            placeholder="Enter validator identity (base58)"
            className="mt-1 rounded border border-anza-border bg-white px-3 py-2 font-mono text-sm focus:border-anza-green focus:outline-none"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="mt-2 inline-flex items-center rounded bg-anza-green px-4 py-2 text-sm font-semibold text-white hover:bg-anza-green-dark"
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
