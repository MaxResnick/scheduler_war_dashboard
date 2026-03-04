import AxiomRoutingClient from "@/components/axiom-routing/axiom-routing-client";
import { schedulerApiGet } from "@/lib/backend-api";
import type { AxiomRoutingPayload } from "@/lib/types";
import Link from "next/link";

const DEFAULT_ACCOUNTS = [
  "axmFmfqQwZGEUZeF3i3MqbRCDiGPfshtbdoBjk41k88",
  "axmhpocX3hU7nT7KtsLBzNBR1Ur3HtU22Q5P313FREY",
  "axmD4LFJopAcbRKCKsrrmovCZZzmKQCMEfs5qEXj8dG",
  "axmWxBPqgRmcBN2cV12quqaQzsk16SazVXq8397KFKu",
  "axmMdWvgEnN3NFrxMfTqUURzj9NLhZL2DkHkWCdgiFV",
  "axmQTWU68qZ4fuG7zzkCXCBmxxeHVZrNrLkgxEFCbRv",
  "axmYVq9b1ABYqtyizMtyfJppPTPxZGXPLctB3hV6W5b",
  "axm2JQY1FKEktAwgXWqjGYkkWsWPfwKzgbnGVt5kiP4"
] as const;

export default async function AxiomRoutingPage() {
  const initialData = await schedulerApiGet<AxiomRoutingPayload>("/axiom-routing");

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

      <AxiomRoutingClient initialData={initialData} defaultAccounts={[...DEFAULT_ACCOUNTS]} />
    </div>
  );
}
