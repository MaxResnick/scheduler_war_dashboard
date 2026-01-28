"use client";

import { useState } from "react";
import type { ValidatorData } from "@/lib/validators-app";

type ExportFormat = "json" | "csv";

const SCHEDULER_COLORS: Record<string, string> = {
  AgaveBam: "#7C3AED",
  JitoLabs: "#5F288D",
  Frankendancer: "#fb923c",
  Harmonic: "#F5F2EB",
  Firedancer: "#ef4444",
  Agave: "#2C3316",
  Unknown: "#64748b",
};

const SCHEDULER_LABELS: Record<string, string> = {
  AgaveBam: "BAM",
  JitoLabs: "Jito Agave",
  Frankendancer: "Frankendancer",
  Harmonic: "Harmonic",
  Firedancer: "Firedancer",
  Agave: "Agave",
  Unknown: "Unknown",
};

type ValidatorListExportProps = {
  validators: ValidatorData[];
};

export default function ValidatorListExport({ validators }: ValidatorListExportProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [format, setFormat] = useState<ExportFormat>("json");

  // Group validators by scheduler type
  const validatorsByType = new Map<string, ValidatorData[]>();
  for (const v of validators) {
    const existing = validatorsByType.get(v.softwareClient) ?? [];
    existing.push(v);
    validatorsByType.set(v.softwareClient, existing);
  }

  // Sort by stake within each group
  Array.from(validatorsByType.entries()).forEach(([, list]) => {
    list.sort((a: ValidatorData, b: ValidatorData) => b.activeStake - a.activeStake);
  });

  // Order the scheduler types by total stake
  const sortedTypes = Array.from(validatorsByType.entries())
    .map(([type, list]) => ({
      type,
      validators: list,
      totalStake: list.reduce((sum, v) => sum + v.activeStake, 0),
    }))
    .sort((a: { totalStake: number }, b: { totalStake: number }) => b.totalStake - a.totalStake);

  const exportData = async (type: string, validatorList: ValidatorData[]) => {
    const includeClient = type === "all";

    if (format === "json") {
      const data = validatorList.map((v) => ({
        account: v.account,
        name: v.name,
        activeStake: v.activeStake,
        ...(includeClient ? { softwareClient: v.softwareClient } : {}),
      }));

      try {
        await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        setCopied(type);
        setTimeout(() => setCopied(null), 2000);
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    } else {
      // CSV download
      const headers = includeClient
        ? ["account", "name", "activeStake", "softwareClient"]
        : ["account", "name", "activeStake"];

      const rows = validatorList.map((v) => {
        const name = (v.name || "").replace(/"/g, '""'); // Escape quotes
        const row = [v.account, `"${name}"`, v.activeStake.toString()];
        if (includeClient) row.push(v.softwareClient);
        return row.join(",");
      });

      const csv = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `validators-${type}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <h2 className="text-lg font-semibold mb-2">Export Validator Lists</h2>
      <div className="flex items-center gap-4 mb-4">
        <p className="text-xs text-slate-400">
          Click a scheduler type to {format === "json" ? "copy as JSON" : "download CSV"}
        </p>
        <div className="flex items-center gap-1 rounded-md border border-slate-700 p-0.5">
          <button
            type="button"
            onClick={() => setFormat("json")}
            className={`px-2 py-1 text-xs rounded ${
              format === "json"
                ? "bg-sky-500 text-slate-900"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            JSON
          </button>
          <button
            type="button"
            onClick={() => setFormat("csv")}
            className={`px-2 py-1 text-xs rounded ${
              format === "csv"
                ? "bg-sky-500 text-slate-900"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            CSV
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => exportData("all", validators)}
          className="flex items-center gap-2 rounded-md border border-sky-500 px-3 py-2 text-sm text-sky-500 transition hover:bg-slate-800"
        >
          <span>All Validators</span>
          <span className="text-slate-500">({validators.length})</span>
          {copied === "all" && (
            <span className="text-green-400 text-xs">✓ {format === "json" ? "Copied" : "Downloaded"}</span>
          )}
        </button>
        {sortedTypes.map(({ type, validators: list }) => (
          <button
            key={type}
            type="button"
            onClick={() => exportData(type, list)}
            className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition hover:bg-slate-800"
            style={{
              borderColor: SCHEDULER_COLORS[type] ?? "#64748b",
              color: SCHEDULER_COLORS[type] ?? "#64748b",
            }}
          >
            <span
              className="w-3 h-3 rounded"
              style={{ backgroundColor: SCHEDULER_COLORS[type] ?? "#64748b" }}
            />
            <span>{SCHEDULER_LABELS[type] ?? type}</span>
            <span className="text-slate-500">({list.length})</span>
            {copied === type && (
              <span className="text-green-400 text-xs">✓ {format === "json" ? "Copied" : "Downloaded"}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
