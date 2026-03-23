import NetworkTreemapToggle from "@/components/network-treemap-toggle";
import { schedulerApiGet } from "@/lib/backend-api";
import { loadEthStakers } from "@/lib/eth-stakers";
import Link from "next/link";

export default async function HomePage() {
  const { validators } = await schedulerApiGet<{
    validators: Array<{
      account: string;
      name: string | null;
      activeStake: number;
      softwareClient: string;
    }>;
  }>("/validators", { includeStake: "true" });

  const ethStakers = loadEthStakers();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-anza-green-muted">
          Solana Scheduler War
        </p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold">Scheduler Type Distribution</h1>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/slot"
              className="rounded-lg bg-anza-surface-alt px-4 py-2 text-sm font-medium text-anza-green transition-colors hover:bg-anza-border"
            >
              Individual Slots →
            </Link>
            <Link
              href="/slot-lagging"
              className="rounded-lg bg-anza-surface-alt px-4 py-2 text-sm font-medium text-anza-green transition-colors hover:bg-anza-border"
            >
              Slot Lagging →
            </Link>
            <Link
              href="/rewards-leaderboard"
              className="rounded-lg bg-anza-surface-alt px-4 py-2 text-sm font-medium text-anza-green transition-colors hover:bg-anza-border"
            >
              Rewards Leaderboard →
            </Link>
          </div>
        </div>
        <p className="max-w-2xl text-sm text-anza-green-mid">
          Validators grouped by their scheduler/client type as advertised in gossip.
          Node size represents stake. Click a validator to view one of their slots in detail.
        </p>
      </header>

      <NetworkTreemapToggle solanaValidators={validators} ethStakers={ethStakers} />
    </div>
  );
}
