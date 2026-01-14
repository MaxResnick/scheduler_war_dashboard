"use client";

import type { ReactNode } from "react";

type MetricCardProps = {
  label: string;
  value: string;
  delta?: string;
  footer?: ReactNode;
};

export default function MetricCard({
  label,
  value,
  delta,
  footer
}: MetricCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4 shadow-sm shadow-slate-950/40">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-slate-100">
          {value}
        </span>
        {delta && (
          <span className="text-xs text-slate-400">
            {delta}
          </span>
        )}
      </div>
      {footer && (
        <div className="mt-auto text-xs text-slate-400">
          {footer}
        </div>
      )}
    </div>
  );
}
