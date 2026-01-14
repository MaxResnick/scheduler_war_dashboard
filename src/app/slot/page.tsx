import SlotSearch from "@/components/slot-detail/slot-search";
import Link from "next/link";

export default function SlotLandingPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-slate-400">
          Solana Scheduler War
        </p>
        <h1 className="text-3xl font-semibold">Slot Detail Analysis</h1>
        <p className="max-w-2xl text-sm text-slate-300">
          Analyze transaction sequencing and entry distribution for individual slots.
        </p>
      </header>

      <SlotSearch />

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="mb-4 text-lg font-semibold">What you&apos;ll see</h2>
        <ul className="space-y-2 text-sm text-slate-300">
          <li className="flex items-start gap-2">
            <span className="text-sky-400">•</span>
            <span>
              <strong>Transaction Sequencing Chart</strong> - Visualizes how transactions are distributed across entries within the slot
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-sky-400">•</span>
            <span>
              <strong>Slot Metadata</strong> - Block height, leader validator, total fees, and slot duration
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-sky-400">•</span>
            <span>
              <strong>Entry Analysis</strong> - Number of entries, transactions, and vote vs non-vote breakdown
            </span>
          </li>
        </ul>
      </div>

      <div className="text-sm text-slate-400">
        <Link href="/" className="text-sky-400 hover:underline">
          ← Back to Validator Rankings
        </Link>
      </div>
    </div>
  );
}
