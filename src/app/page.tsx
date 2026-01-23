import SchedulerTreemap from "@/components/scheduler-treemap";
import { getAllValidators } from "@/lib/validators-app";
import Link from "next/link";

export default async function HomePage() {
  const validators = await getAllValidators();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-slate-400">
          Solana Scheduler War
        </p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold">Scheduler Type Distribution</h1>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/slot"
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700"
            >
              Individual Slots →
            </Link>
            <Link
              href="/slot-lagging"
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700"
            >
              Slot Lagging →
            </Link>
          </div>
        </div>
        <p className="max-w-2xl text-sm text-slate-300">
          Validators grouped by their scheduler/client type as advertised in gossip.
          Node size represents stake. Click a validator to view one of their slots in detail.
        </p>
      </header>

      <SchedulerTreemap validators={validators} />
    </div>
  );
}
