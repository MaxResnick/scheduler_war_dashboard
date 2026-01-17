"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";

type ValidatorData = {
  validator_address: string;
  avg_slot_time_ms: number;
  slot_count: number;
  block_count: number;
};

type ValidatorSlotsChartProps = {
  validators: ValidatorData[];
  validatorNames: Record<string, string>;
  validatorClients?: Record<string, string>;
};

const SCHEDULER_COLORS: Record<string, string> = {
  "AgaveBam": "#7C3AED",
  "Agave": "#2C3316",
  "JitoLabs": "#5F288D",
  "Frankendancer": "#fb923c",
  "Firedancer": "#ef4444",
  "AgavePaladin": "#facc15",
  "Harmonic": "#F5F2EB",
  "Unknown": "#64748b", // Neutral gray for unidentified validators
};

function getDisplayName(softwareClient: string): string {
  if (softwareClient === "JitoLabs") return "Jito Agave";
  return softwareClient;
}

function getSchedulerColor(softwareClient: string | undefined): string {
  if (!softwareClient) return "#64748b";
  return SCHEDULER_COLORS[softwareClient] ?? "#64748b";
}

export default function ValidatorSlotsChart({ validators, validatorNames, validatorClients = {} }: ValidatorSlotsChartProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedValidator, setSelectedValidator] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [hoveredValidator, setHoveredValidator] = useState<string | null>(null);
  const [loadingValidator, setLoadingValidator] = useState<string | null>(null);
  const router = useRouter();

  const handleBarClick = async (address: string) => {
    setLoadingValidator(address);
    try {
      const res = await fetch(`/api/validator-slots/${address}`);
      if (res.ok) {
        const data = await res.json();
        const slots = data.slots ?? [];
        // Use 5th most recent slot (index 4) to ensure Jito data is populated
        const slotIndex = Math.min(4, slots.length - 1);
        if (slots.length > 0 && slotIndex >= 0) {
          router.push(`/slot/${slots[slotIndex].slot}`);
          return;
        }
      }
    } catch {
      // ignore errors
    }
    setLoadingValidator(null);
  };

  const maxSlotTime = useMemo(
    () => Math.max(...validators.map((v) => v.avg_slot_time_ms)),
    [validators]
  );

  const minSlotTime = useMemo(
    () => Math.min(...validators.map((v) => v.avg_slot_time_ms)),
    [validators]
  );

  type MatchedValidator = ValidatorData & { name: string | null; rank: number };

  // Find all matching validators for dropdown
  const matchingValidators = useMemo((): MatchedValidator[] => {
    if (!searchTerm.trim() || searchTerm.length < 2) return [];
    const query = searchTerm.toLowerCase();
    const results: MatchedValidator[] = [];

    for (let index = 0; index < validators.length; index++) {
      const v = validators[index];
      const name = validatorNames[v.validator_address] ?? null;
      const addressMatch = v.validator_address.toLowerCase().includes(query);
      const nameMatch = name ? name.toLowerCase().includes(query) : false;
      if (addressMatch || nameMatch) {
        results.push({ ...v, name, rank: index + 1 });
        if (results.length >= 10) break;
      }
    }

    return results;
  }, [validators, searchTerm, validatorNames]);

  // Find the selected/highlighted validator index
  const searchedValidatorIndex = useMemo(() => {
    if (selectedValidator) {
      return validators.findIndex((v) => v.validator_address === selectedValidator);
    }
    if (!searchTerm.trim()) return -1;
    const query = searchTerm.toLowerCase();
    return validators.findIndex((v) => {
      const addressMatch = v.validator_address.toLowerCase().includes(query);
      const name = validatorNames[v.validator_address];
      const nameMatch = name ? name.toLowerCase().includes(query) : false;
      return addressMatch || nameMatch;
    });
  }, [validators, searchTerm, validatorNames, selectedValidator]);

  const searchedValidator = searchedValidatorIndex >= 0 ? validators[searchedValidatorIndex] : null;
  const searchedValidatorName = searchedValidator
    ? validatorNames[searchedValidator.validator_address]
    : null;

  const handleSelectValidator = (address: string) => {
    setSelectedValidator(address);
    const name = validatorNames[address];
    setSearchTerm(name || address);
    setShowDropdown(false);
    setHighlightedIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || matchingValidators.length === 0) return;

    if (e.key === "ArrowDown" || e.key === "Tab") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < matchingValidators.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : matchingValidators.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (matchingValidators[highlightedIndex]) {
        handleSelectValidator(matchingValidators[highlightedIndex].validator_address);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  // Reset highlighted index when matches change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [matchingValidators.length]);

  const barHeight = 20;
  const chartHeight = validators.length * barHeight;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Validator Slot Time Rankings</h2>
          <p className="text-sm text-slate-400">
            {validators.length} validators ranked by average time between consecutive leader slots.
            Range: 0ms - {maxSlotTime.toFixed(0)}ms
          </p>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search by name or address..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setSelectedValidator(null);
              setShowDropdown(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => {
              // Delay to allow click on dropdown item
              setTimeout(() => setShowDropdown(false), 200);
            }}
            className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />

          {/* Dropdown suggestions */}
          {showDropdown && matchingValidators.length > 0 && !selectedValidator && (
            <div className="absolute left-0 right-0 z-10 mt-1 max-h-64 overflow-auto rounded-lg border border-slate-700 bg-slate-900/95 py-2 text-sm shadow-lg">
              {matchingValidators.map((validator, index) => (
                <button
                  key={validator.validator_address}
                  type="button"
                  onMouseDown={() => handleSelectValidator(validator.validator_address)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`w-full px-4 py-2 text-left ${
                    index === highlightedIndex ? "bg-slate-700" : "hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      {validator.name ? (
                        <>
                          <span className="font-medium text-slate-200">{validator.name}</span>
                          <span className="text-xs text-slate-400 font-mono">
                            {validator.validator_address.slice(0, 8)}...{validator.validator_address.slice(-8)}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-200 font-mono">{validator.validator_address}</span>
                      )}
                    </div>
                    <div className="text-right text-xs">
                      <div className="text-slate-400">Rank #{validator.rank}</div>
                      <div className={
                        validator.avg_slot_time_ms > 450
                          ? "text-red-400"
                          : validator.avg_slot_time_ms > 420
                          ? "text-orange-400"
                          : "text-green-400"
                      }>
                        {validator.avg_slot_time_ms.toFixed(0)}ms
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Selected validator info */}
          {searchedValidatorIndex >= 0 && searchedValidator && (
            <div className="mt-2 text-sm">
              <span className="text-slate-400">Found: </span>
              {searchedValidatorName && (
                <span className="font-medium text-sky-400">{searchedValidatorName} </span>
              )}
              <span className="text-slate-300 font-mono text-xs">
                ({searchedValidator.validator_address.slice(0, 8)}...{searchedValidator.validator_address.slice(-8)})
              </span>
              <span className="text-slate-400"> - Rank </span>
              <span className="text-sky-400">#{searchedValidatorIndex + 1}</span>
              <span className="text-slate-400"> - </span>
              <span className="text-sky-400">{searchedValidator.avg_slot_time_ms.toFixed(0)}ms</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        {/* Legend - Left Side */}
        <div className="flex-shrink-0 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Client Type
          </div>
          <div className="flex flex-col gap-3 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded" style={{ backgroundColor: "#7C3AED" }}></div>
              <span>BAM</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded" style={{ backgroundColor: "#F5F2EB" }}></div>
              <span>Harmonic</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded" style={{ backgroundColor: "#5F288D" }}></div>
              <span>Jito Agave</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded" style={{ backgroundColor: "#2C3316" }}></div>
              <span>Agave</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded" style={{ backgroundColor: "#fb923c" }}></div>
              <span>Frankendancer</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded" style={{ backgroundColor: "#facc15" }}></div>
              <span>Paladin</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded" style={{ backgroundColor: "#64748b" }}></div>
              <span>Unknown</span>
            </div>
            <div className="mt-2 border-t border-slate-700 pt-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-sky-500"></div>
                <span>Search result</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="flex-1 overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40 p-6">
          <svg width="100%" height={chartHeight} className="overflow-visible">
            {validators.map((validator, index) => {
              const widthPercent = (validator.avg_slot_time_ms / maxSlotTime) * 100;
              const name = validatorNames[validator.validator_address];
              const clientType = validatorClients[validator.validator_address];
              const query = searchTerm.toLowerCase().trim();
              const isHighlighted =
                query &&
                (validator.validator_address.toLowerCase().includes(query) ||
                  (name && name.toLowerCase().includes(query)));

              const y = index * barHeight;

              const clientDisplay = clientType ? getDisplayName(clientType) : "Unknown";
              const tooltipText = name
                ? `${name} (${validator.validator_address})\n${validator.avg_slot_time_ms.toFixed(2)}ms (${validator.slot_count} slots)\nClient: ${clientDisplay}`
                : `${validator.validator_address}\n${validator.avg_slot_time_ms.toFixed(2)}ms (${validator.slot_count} slots)\nClient: ${clientDisplay}`;

              const labelText = name || validator.validator_address.slice(0, 8) + "...";
              const isHovered = hoveredValidator === validator.validator_address;
              const isLoading = loadingValidator === validator.validator_address;
              const barColor = getSchedulerColor(clientType);

              return (
                <g
                  key={validator.validator_address}
                  onClick={() => handleBarClick(validator.validator_address)}
                  onMouseEnter={() => setHoveredValidator(validator.validator_address)}
                  onMouseLeave={() => setHoveredValidator(null)}
                  style={{ cursor: isLoading ? "wait" : "pointer" }}
                >
                  <rect
                    x="0"
                    y={y}
                    width={`${widthPercent}%`}
                    height={barHeight - 2}
                    fill={isHighlighted ? "#38bdf8" : barColor}
                    opacity={isHovered ? 0.95 : 0.75}
                    stroke={isHovered ? "#fff" : "none"}
                    strokeWidth={isHovered ? 1 : 0}
                  >
                    <title>{tooltipText}</title>
                  </rect>
                  <text
                    x={4}
                    y={y + barHeight / 2 + 1}
                    dominantBaseline="middle"
                    className="fill-white text-[10px] font-medium pointer-events-none"
                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
                  >
                    {isLoading ? "Loading..." : `${labelText} — ${validator.avg_slot_time_ms.toFixed(0)}ms`}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
