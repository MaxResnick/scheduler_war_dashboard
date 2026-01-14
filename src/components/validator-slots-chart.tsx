"use client";

import { useState, useMemo } from "react";

type ValidatorData = {
  validator_address: string;
  avg_slot_time_ms: number;
  slot_count: number;
  block_count: number;
};

type ValidatorSlotsChartProps = {
  validators: ValidatorData[];
};

export default function ValidatorSlotsChart({ validators }: ValidatorSlotsChartProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const maxSlotTime = useMemo(
    () => Math.max(...validators.map((v) => v.avg_slot_time_ms)),
    [validators]
  );

  const minSlotTime = useMemo(
    () => Math.min(...validators.map((v) => v.avg_slot_time_ms)),
    [validators]
  );

  const searchedValidatorIndex = useMemo(() => {
    if (!searchTerm.trim()) return -1;
    return validators.findIndex((v) =>
      v.validator_address.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [validators, searchTerm]);

  const barHeight = 6;
  const chartHeight = validators.length * barHeight;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Validator Slot Time Rankings</h2>
          <p className="text-sm text-slate-400">
            {validators.length} validators ranked by average time between consecutive leader slots.
            Range: {minSlotTime.toFixed(0)}ms - {maxSlotTime.toFixed(0)}ms
          </p>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search validator address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          {searchedValidatorIndex >= 0 && (
            <div className="mt-2 text-sm text-sky-400">
              Found: {validators[searchedValidatorIndex].validator_address} - Rank #{searchedValidatorIndex + 1} - {validators[searchedValidatorIndex].avg_slot_time_ms.toFixed(0)}ms
            </div>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40 p-6">
        <svg width="100%" height={chartHeight} className="overflow-visible">
          {validators.map((validator, index) => {
            const widthPercent = ((validator.avg_slot_time_ms - minSlotTime) / (maxSlotTime - minSlotTime)) * 100;
            const isHighlighted =
              searchTerm.trim() &&
              validator.validator_address.toLowerCase().includes(searchTerm.toLowerCase());

            const y = index * barHeight;

            return (
              <g key={validator.validator_address}>
                <rect
                  x="0"
                  y={y}
                  width={`${widthPercent}%`}
                  height={barHeight - 1}
                  className={
                    isHighlighted
                      ? "fill-sky-500"
                      : validator.avg_slot_time_ms > 450
                      ? "fill-red-500/70"
                      : validator.avg_slot_time_ms > 420
                      ? "fill-orange-500/70"
                      : "fill-slate-600"
                  }
                  opacity="0.8"
                >
                  <title>
                    {validator.validator_address}: {validator.avg_slot_time_ms.toFixed(2)}ms ({validator.slot_count} slots)
                  </title>
                </rect>
              </g>
            );
          })}
        </svg>

        <div className="mt-4 flex items-center gap-6 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-slate-600"></div>
            <span>{'<'} 420ms (good)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-orange-500/70"></div>
            <span>420-450ms (moderate)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-red-500/70"></div>
            <span>{'>'} 450ms (slow)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-sky-500"></div>
            <span>Search result</span>
          </div>
        </div>
      </div>
    </div>
  );
}
