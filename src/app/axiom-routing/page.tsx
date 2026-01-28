import AxiomRoutingClient from "@/components/axiom-routing/axiom-routing-client";
import { fetchSlotLeaderSequence, AXIOM_TIP_ACCOUNTS } from "@/lib/queries";
import { getAllValidators, getValidatorName } from "@/lib/validators-app";
import type {
  AxiomRoutingPayload,
  LeaderTransition,
  TransitionStats,
  TimeRange,
  SlotData
} from "@/lib/types";
import Link from "next/link";

// Only these 4 scheduler types
const ALLOWED_TYPES = new Set(["AgaveBam", "Frankendancer", "JitoLabs", "Harmonic"]);

function defaultTimeRange(hoursBack: number): TimeRange {
  const to = new Date();
  const from = new Date(to.getTime() - hoursBack * 60 * 60 * 1000);
  return {
    from: from.toISOString(),
    to: to.toISOString()
  };
}

async function fetchInitialData(): Promise<AxiomRoutingPayload> {
  const range = defaultTimeRange(2);

  const [slotSequence, allValidators] = await Promise.all([
    fetchSlotLeaderSequence(range),
    getAllValidators()
  ]);

  // Build validator type map
  const validatorTypeMap = new Map<string, string>();
  for (const v of allValidators) {
    validatorTypeMap.set(v.account, v.softwareClient);
  }

  // Helper to get slot data with validator info
  const getSlotData = (idx: number): SlotData | null => {
    if (idx < 0 || idx >= slotSequence.length) return null;
    const s = slotSequence[idx];
    return {
      slot: s.slot,
      validator: s.validator,
      validatorName: getValidatorName(s.validator),
      validatorType: validatorTypeMap.get(s.validator) ?? "Unknown",
      axiomTxCount: s.axiomTxCount,
      totalTxCount: s.totalTxCount,
      totalComputeUnits: s.totalComputeUnits
    };
  };

  // Find ALL transitions between the 4 allowed types
  const transitions: LeaderTransition[] = [];

  for (let i = 0; i < slotSequence.length - 1; i++) {
    const current = slotSequence[i];
    const next = slotSequence[i + 1];

    const currentType = validatorTypeMap.get(current.validator) ?? "Unknown";
    const nextType = validatorTypeMap.get(next.validator) ?? "Unknown";

    // Only include transitions between our 4 allowed types (and where type changes)
    if (
      ALLOWED_TYPES.has(currentType) &&
      ALLOWED_TYPES.has(nextType) &&
      currentType !== nextType
    ) {
      // Build 8-slot sequence
      const slotSequenceWindow: SlotData[] = [];
      for (let offset = -3; offset <= 4; offset++) {
        const slotData = getSlotData(i + offset);
        if (slotData) {
          slotSequenceWindow.push(slotData);
        }
      }

      transitions.push({
        fromSlot: current.slot,
        fromValidator: current.validator,
        fromValidatorName: getValidatorName(current.validator),
        fromValidatorType: currentType,
        fromAxiomTxCount: current.axiomTxCount,
        fromTotalTxCount: current.totalTxCount,
        toSlot: next.slot,
        toValidator: next.validator,
        toValidatorName: getValidatorName(next.validator),
        toValidatorType: nextType,
        toAxiomTxCount: next.axiomTxCount,
        toTotalTxCount: next.totalTxCount,
        slotSequence: slotSequenceWindow
      });
    }
  }

  // Calculate stats by transition type
  const statsByType = new Map<string, {
    count: number;
    totalFromAxiom: number;
    totalToAxiom: number;
    totalFromTotal: number;
    totalToTotal: number;
  }>();

  for (const t of transitions) {
    const key = `${t.fromValidatorType} → ${t.toValidatorType}`;
    const existing = statsByType.get(key) ?? {
      count: 0,
      totalFromAxiom: 0,
      totalToAxiom: 0,
      totalFromTotal: 0,
      totalToTotal: 0
    };
    existing.count++;
    existing.totalFromAxiom += t.fromAxiomTxCount;
    existing.totalToAxiom += t.toAxiomTxCount;
    existing.totalFromTotal += t.fromTotalTxCount;
    existing.totalToTotal += t.toTotalTxCount;
    statsByType.set(key, existing);
  }

  const transitionStats: TransitionStats[] = Array.from(statsByType.entries())
    .map(([type, stats]) => ({
      transitionType: type,
      count: stats.count,
      avgBamAxiomTx: stats.count > 0 ? stats.totalFromAxiom / stats.count : 0,
      avgFollowerAxiomTx: stats.count > 0 ? stats.totalToAxiom / stats.count : 0,
      avgBamTotalTx: stats.count > 0 ? stats.totalFromTotal / stats.count : 0,
      avgFollowerTotalTx: stats.count > 0 ? stats.totalToTotal / stats.count : 0,
      axiomTxRatio: stats.totalFromAxiom > 0
        ? stats.totalToAxiom / stats.totalFromAxiom
        : stats.totalToAxiom > 0 ? Infinity : 1
    }))
    .sort((a, b) => b.count - a.count);

  // Calculate overall stats
  const allowedSlots = slotSequence.filter(
    s => ALLOWED_TYPES.has(validatorTypeMap.get(s.validator) ?? "Unknown")
  );
  const bamSlots = allowedSlots.filter(
    s => (validatorTypeMap.get(s.validator) ?? "Unknown") === "AgaveBam"
  );
  const nonBamSlots = allowedSlots.filter(
    s => (validatorTypeMap.get(s.validator) ?? "Unknown") !== "AgaveBam"
  );

  const totalBamSlots = bamSlots.length;
  const totalAxiomTxOnBam = bamSlots.reduce((sum, s) => sum + s.axiomTxCount, 0);
  const totalAxiomTxOnNonBam = nonBamSlots.reduce((sum, s) => sum + s.axiomTxCount, 0);

  return {
    range,
    transitions,
    transitionStats,
    totalBamSlots,
    totalAxiomTxOnBam,
    avgAxiomTxPerBamSlot: totalBamSlots > 0 ? totalAxiomTxOnBam / totalBamSlots : 0,
    avgAxiomTxPerNonBamSlot: nonBamSlots.length > 0 ? totalAxiomTxOnNonBam / nonBamSlots.length : 0
  };
}

export default async function AxiomRoutingPage() {
  const initialData = await fetchInitialData();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-slate-400">
          Axiom Routing Analysis
        </p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold">
            Scheduler Transition Matrix
          </h1>
          <Link
            href="/"
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700"
          >
            ← Back to Dashboard
          </Link>
        </div>
        <p className="max-w-3xl text-sm text-slate-300">
          Analyzing transaction patterns across all transitions between BAM, Frankendancer,
          Jito Agave, and Harmonic validators. Each chart shows the 8-slot window around
          a scheduler transition.
        </p>
      </header>

      <AxiomRoutingClient initialData={initialData} defaultAccounts={[...AXIOM_TIP_ACCOUNTS]} />
    </div>
  );
}
