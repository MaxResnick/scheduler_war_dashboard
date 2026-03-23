"use client";

import { useState } from "react";
import SchedulerTreemap from "@/components/scheduler-treemap";
import EthStakerTreemap from "@/components/eth-staker-treemap";
import ValidatorListExport from "@/components/validator-list-export";
import type { ValidatorData } from "@/lib/types";
import type { EthStaker } from "@/lib/eth-stakers";

type Network = "solana" | "ethereum";

type Props = {
  solanaValidators: ValidatorData[];
  ethStakers: EthStaker[];
};

export default function NetworkTreemapToggle({ solanaValidators, ethStakers }: Props) {
  const [network, setNetwork] = useState<Network>("solana");

  return (
    <>
      {/* Toggle */}
      <div className="flex items-center gap-1 rounded-lg border border-anza-border bg-anza-surface p-1 w-fit">
        <button
          onClick={() => setNetwork("solana")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            network === "solana"
              ? "bg-anza-green text-anza-bg"
              : "text-anza-green-muted hover:text-anza-green"
          }`}
        >
          Solana
        </button>
        <button
          onClick={() => setNetwork("ethereum")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            network === "ethereum"
              ? "bg-anza-green text-anza-bg"
              : "text-anza-green-muted hover:text-anza-green"
          }`}
        >
          Ethereum
        </button>
      </div>

      {network === "solana" ? (
        <>
          <SchedulerTreemap validators={solanaValidators} />
          <ValidatorListExport validators={solanaValidators} />
        </>
      ) : (
        <EthStakerTreemap stakers={ethStakers} />
      )}
    </>
  );
}
