"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import cachedValidatorData from "../../data/validator-names.json";

// Type for cached data
type CachedValidatorNames = {
  generatedAt: string;
  count: number;
  names: Record<string, string>;
};

const validatorNamesData = cachedValidatorData as CachedValidatorNames;

type SlotSearchProps = {
  currentSlot?: number;
};

type ValidatorSuggestion = {
  address: string;
  name: string | null;
};

export default function SlotSearch({ currentSlot }: SlotSearchProps) {
  const [inputValue, setInputValue] = useState(currentSlot?.toString() ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const router = useRouter();

  // Check if input looks like a slot number
  const isSlotNumber = /^\d+$/.test(inputValue.trim());

  // Search validators locally from cached data
  const suggestions = useMemo((): ValidatorSuggestion[] => {
    const q = inputValue.trim().toLowerCase();

    // Don't search if it's a slot number or too short
    if (isSlotNumber || q.length < 2) {
      return [];
    }

    const results: ValidatorSuggestion[] = [];

    for (const [account, name] of Object.entries(validatorNamesData.names)) {
      const nameMatches = name.toLowerCase().includes(q);
      const accountMatches = account.toLowerCase().startsWith(q);

      if (nameMatches || accountMatches) {
        results.push({ address: account, name });
        if (results.length >= 10) {
          break;
        }
      }
    }

    return results;
  }, [inputValue, isSlotNumber]);

  // Reset highlighted index when suggestions change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [suggestions.length]);

  const navigateToSlot = (slot: number) => {
    router.push(`/slot/${slot}`);
  };

  const navigateToValidator = (address: string) => {
    setIsLoading(true);
    setError(null);
    setShowDropdown(false);

    fetch(`/api/validator-slots/${address}`)
      .then(async (res) => {
        if (!res.ok) {
          const { error: message } = await res.json();
          throw new Error(message || "Failed to fetch slots");
        }
        return res.json();
      })
      .then((data) => {
        const slots = data.slots ?? [];
        if (slots.length > 0) {
          router.push(`/slot/${slots[0].slot}`);
        } else {
          setError("No recent slots found for this validator.");
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Request failed");
      })
      .finally(() => setIsLoading(false));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = inputValue.trim();

    if (!value) return;

    // If it's a slot number, navigate directly
    if (isSlotNumber) {
      const slot = parseInt(value, 10);
      if (slot > 0) {
        navigateToSlot(slot);
      }
      return;
    }

    // If there's a highlighted suggestion, use it
    if (suggestions.length > 0 && suggestions[highlightedIndex]) {
      navigateToValidator(suggestions[highlightedIndex].address);
      return;
    }

    // If it looks like a validator address, try to navigate
    const VALIDATOR_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,64}$/;
    if (VALIDATOR_REGEX.test(value)) {
      navigateToValidator(value);
    } else {
      setError("Enter a slot number or validator name/address");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length === 0) return;

    if (e.key === "ArrowDown" || e.key === "Tab") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  const handleSuggestionClick = (suggestion: ValidatorSuggestion) => {
    setShowDropdown(false);
    navigateToValidator(suggestion.address);
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            placeholder="Search slot number or validator name..."
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setError(null);
              setShowDropdown(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => {
              // Delay to allow click on dropdown item
              setTimeout(() => setShowDropdown(false), 200);
            }}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-lg bg-sky-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50"
          >
            {isLoading ? "Loading..." : "Go"}
          </button>
        </form>

        {/* Dropdown suggestions */}
        {showDropdown && suggestions.length > 0 && (
          <div className="absolute left-0 right-[80px] z-10 mt-1 max-h-64 overflow-auto rounded-lg border border-slate-700 bg-slate-900/95 py-2 text-sm shadow-lg">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.address}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`w-full px-4 py-2 text-left ${
                  index === highlightedIndex ? "bg-slate-700" : "hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    {suggestion.name ? (
                      <>
                        <span className="font-medium text-slate-200">{suggestion.name}</span>
                        <span className="text-xs text-slate-400 font-mono">
                          {suggestion.address.slice(0, 8)}...{suggestion.address.slice(-8)}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-200 font-mono">
                        {suggestion.address.slice(0, 8)}...{suggestion.address.slice(-8)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Status messages */}
      {isLoading && <p className="text-xs text-slate-400">Finding most recent slot...</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
