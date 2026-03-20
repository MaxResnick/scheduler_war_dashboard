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
    <div className="flex flex-col gap-2 rounded-lg border border-anza-border bg-anza-surface p-4 shadow-sm shadow-anza-border/40">
      <span className="text-xs font-semibold uppercase tracking-wide text-anza-green-muted">
        {label}
      </span>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-anza-green">
          {value}
        </span>
        {delta && (
          <span className="text-xs text-anza-green-muted">
            {delta}
          </span>
        )}
      </div>
      {footer && (
        <div className="mt-auto text-xs text-anza-green-muted">
          {footer}
        </div>
      )}
    </div>
  );
}
