"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type SlotSearchProps = {
  currentSlot?: number;
};

export default function SlotSearch({ currentSlot }: SlotSearchProps) {
  const [mode, setMode] = useState<"slot" | "validator">("slot");
  const [inputValue, setInputValue] = useState(currentSlot?.toString() ?? "");
  const [validatorResults, setValidatorResults] = useState<
    Array<{ slot: number; block_height: number; total_fee_lamports: number }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "slot") {
      const slot = parseInt(inputValue, 10);
      if (!isNaN(slot) && slot > 0) {
        router.push(`/slot/${slot}`);
      }
      return;
    }

    const validator = inputValue.trim();
    const VALIDATOR_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,64}$/;
    if (!VALIDATOR_REGEX.test(validator)) {
      setError("Enter a valid validator address.");
      setValidatorResults([]);
      return;
    }

    setError(null);
    setIsLoading(true);
    setHasSearched(true);
    setSuggestions([]);
    fetch(`/api/validator-slots/${validator}`)
      .then(async (res) => {
        if (!res.ok) {
          const { error: message } = await res.json();
          throw new Error(message || "Failed to fetch slots");
        }
        return res.json();
      })
      .then((data) => {
        const unique = new Map<number, { slot: number; block_height: number; total_fee_lamports: number }>();
        for (const item of data.slots ?? []) {
          if (!unique.has(item.slot)) {
            unique.set(item.slot, item);
          }
        }
        setValidatorResults(Array.from(unique.values()));
      })
      .catch((err) => {
        setValidatorResults([]);
        setError(err instanceof Error ? err.message : "Request failed");
      })
      .finally(() => setIsLoading(false));
  };

  const handleModeChange = (nextMode: "slot" | "validator") => {
    setMode(nextMode);
    setError(null);
    setValidatorResults([]);
    setHasSearched(false);
    setSuggestions([]);
    if (nextMode === "slot") {
      setInputValue(currentSlot?.toString() ?? "");
    } else {
      setInputValue("");
    }
  };

  useEffect(() => {
    if (mode !== "validator") return;

    const q = inputValue.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    setIsSuggesting(true);
    fetch(`/api/validator-search?q=${encodeURIComponent(q)}`, {
      signal: controller.signal
    })
      .then((res) => (res.ok ? res.json() : { validators: [] }))
      .then((data) => {
        if (data.validators) {
          setSuggestions(data.validators.slice(0, 10));
        } else {
          setSuggestions([]);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSuggestions([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsSuggesting(false);
        }
      });

    return () => controller.abort();
  }, [inputValue, mode]);

  const handleSuggestionSelect = (value: string) => {
    setInputValue(value);
    setSuggestions([]);
    setError(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleModeChange("slot")}
          className={`rounded-md px-3 py-1 text-xs font-medium uppercase tracking-wide transition ${
            mode === "slot"
              ? "bg-sky-600 text-white"
              : "border border-slate-700 bg-slate-900/60 text-slate-300 hover:border-sky-500"
          }`}
        >
          Slot
        </button>
        <button
          type="button"
          onClick={() => handleModeChange("validator")}
          className={`rounded-md px-3 py-1 text-xs font-medium uppercase tracking-wide transition ${
            mode === "validator"
              ? "bg-sky-600 text-white"
              : "border border-slate-700 bg-slate-900/60 text-slate-300 hover:border-sky-500"
          }`}
        >
          Validator
        </button>
      </div>

      <div className="relative">
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="text"
            placeholder={
              mode === "slot" ? "Enter slot number..." : "Enter validator address..."
            }
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-sky-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            Search
          </button>
        </form>

        {mode === "validator" && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 z-10 mt-1 max-h-56 overflow-auto rounded-lg border border-slate-700 bg-slate-900/95 py-2 text-sm shadow-lg">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => handleSuggestionSelect(suggestion)}
                className="w-full px-4 py-2 text-left text-slate-200 hover:bg-slate-800"
              >
                {suggestion}
              </button>
            ))}
            {isSuggesting && (
              <div className="px-4 py-2 text-xs text-slate-400">Loading…</div>
            )}
          </div>
        )}
      </div>

      {mode === "validator" && (
        <div className="space-y-3">
          {isLoading && <p className="text-xs text-slate-400">Loading slots…</p>}
          {error && <p className="text-xs text-red-400">{error}</p>}
          {validatorResults.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {validatorResults.map((item) => (
                <button
                  key={item.slot}
                  onClick={() => router.push(`/slot/${item.slot}`)}
                  className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-left transition hover:border-sky-500 hover:bg-slate-900/80"
                >
                  <div className="text-sm font-semibold text-slate-200">Slot {item.slot}</div>
                  <div className="text-xs text-slate-400">
                    Block height: {item.block_height.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-400">
                    Total fees: {(item.total_fee_lamports / 1_000_000_000).toFixed(4)} SOL
                  </div>
                </button>
              ))}
            </div>
          )}
          {!isLoading && !error && hasSearched && validatorResults.length === 0 && (
            <p className="text-xs text-slate-400">No slots found for this validator.</p>
          )}
        </div>
      )}
    </div>
  );
}
