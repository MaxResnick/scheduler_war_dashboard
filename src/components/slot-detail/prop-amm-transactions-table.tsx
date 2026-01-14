"use client";

import type { SlotTransaction } from "@/lib/types";
import { useMemo } from "react";

type Props = {
  transactions: SlotTransaction[];
};

export default function PropAmmTransactionsTable({ transactions }: Props) {
  const propTx = useMemo(
    () => transactions.filter((t) => !!t.propAmmAccount && !t.isVote),
    [transactions]
  );

  if (propTx.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
        No prop AMM oracle updates were detected in this slot.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Prop AMM Oracle Updates</h3>
          <p className="text-xs text-slate-400">Only transactions that touch tracked prop AMM signer accounts</p>
        </div>
        <div className="text-xs text-slate-400">
          Count: {propTx.length.toLocaleString()}
        </div>
      </div>
      <div className="max-h-[22rem] overflow-auto">
        <table className="w-full text-left text-xs text-slate-200">
          <thead className="sticky top-0 bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-3 py-2">Idx</th>
              <th className="px-3 py-2">Signature</th>
              <th className="px-3 py-2">Prop AMM</th>
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">PoH Tick</th>
              <th className="px-3 py-2">CU Used</th>
              <th className="px-3 py-2">Prio Fee / CU</th>
              <th className="px-3 py-2">Allocated Tip</th>
              <th className="px-3 py-2">Bundle Tip / Total CU</th>
              <th className="px-3 py-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {propTx.map((t) => (
              <tr key={`${t.signature}-${t.index}`} className="border-t border-slate-800">
                <td className="px-3 py-2 font-mono">{t.index}</td>
                <td className="px-3 py-2 font-mono">
                  <a
                    href={`https://solscan.io/tx/${t.signature}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-400 hover:underline"
                  >
                    {t.signature.slice(0, 8)}…{t.signature.slice(-8)}
                  </a>
                </td>
                <td className="px-3 py-2">{t.propAmmLabel ?? "Tracked signer"}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {t.propAmmAccount ? (
                    <a
                      href={`https://solscan.io/account/${t.propAmmAccount}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-400 hover:underline"
                    >
                      {t.propAmmAccount}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2">{t.isJitoBundle ? "Jito" : "TPU"}</td>
                <td className="px-3 py-2">{typeof t.pohTickNumber === "number" ? t.pohTickNumber + 1 : "—"}</td>
                <td className="px-3 py-2">{t.computeUnitsConsumed?.toLocaleString() ?? "—"}</td>
                <td className="px-3 py-2">
                  {typeof t.computeUnitPrice === "number"
                    ? t.computeUnitPrice.toLocaleString()
                    : "—"}
                </td>
                <td className="px-3 py-2">{(t.allocatedTipLamports ?? 0).toLocaleString()}</td>
                <td className="px-3 py-2">
                  {typeof t.bundleTipPerTotalCu === "number"
                    ? t.bundleTipPerTotalCu.toLocaleString()
                    : "—"}
                </td>
                <td className="px-3 py-2">{new Date(t.time).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
