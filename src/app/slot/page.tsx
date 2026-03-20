import SlotSearch from "@/components/slot-detail/slot-search";
import Link from "next/link";

export default function SlotLandingPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-anza-green-muted">
          Solana Scheduler War
        </p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold">Individual Slots</h1>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="rounded-lg bg-anza-surface-alt px-4 py-2 text-sm font-medium text-anza-green transition-colors hover:bg-anza-border"
            >
              ← Home
            </Link>
            <Link
              href="/slot-lagging"
              className="rounded-lg bg-anza-surface-alt px-4 py-2 text-sm font-medium text-anza-green transition-colors hover:bg-anza-border"
            >
              Slot Lagging →
            </Link>
          </div>
        </div>
        <p className="max-w-2xl text-sm text-anza-green-mid">
          Analyze transaction sequencing and entry distribution for individual slots.
        </p>
      </header>

      <SlotSearch />
    </div>
  );
}
