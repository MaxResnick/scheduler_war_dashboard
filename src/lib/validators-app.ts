/**
 * Service for accessing validator data.
 * Fetches from validators.app and BAM APIs with 30-minute caching.
 */

import "server-only";
import { unstable_cache } from "next/cache";

const VALIDATORS_APP_API_TOKEN = process.env.VALIDATORS_APP_API_TOKEN;
const BAM_API_URL = "https://explorer.bam.dev/api/v1/validators";
const CACHE_REVALIDATE_SECONDS = 1800; // 30 minutes

// Type for BAM validators from the API
type BamValidator = {
  validator_pubkey: string;
  bam_node_connection: string;
  stake: number;
  stake_percentage: number;
};

// Type for validators.app API response
type ValidatorInfo = {
  account: string;
  name: string | null;
  active_stake: number | null;
  software_client: string | null;
};

export type ValidatorData = {
  account: string;
  name: string | null;
  activeStake: number;
  softwareClient: string;
};

// Validators that report "Unknown" but are NOT Harmonic
// These stay as "Unknown" while all other "Unknown" validators become "Harmonic"
const notHarmonicValidators = new Set([
  "3psxMyr7rQzywVp1MXKd1XFmFz33NjydzCoJx9t2sMQW", // OtterSec
]);

/**
 * Fetch BAM validators from the explorer API
 */
async function fetchBamValidatorsRaw(): Promise<BamValidator[]> {
  try {
    const response = await fetch(BAM_API_URL, {
      next: { revalidate: CACHE_REVALIDATE_SECONDS },
    });
    if (!response.ok) {
      console.error(`BAM API returned ${response.status}`);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch BAM validators:", error);
    return [];
  }
}

/**
 * Fetch all validators from validators.app API
 */
async function fetchValidatorsFromApi(): Promise<ValidatorInfo[]> {
  if (!VALIDATORS_APP_API_TOKEN) {
    console.warn("Warning: VALIDATORS_APP_API_TOKEN not set");
    return [];
  }

  const allValidators: ValidatorInfo[] = [];
  let page = 1;
  const limit = 1000;

  try {
    while (true) {
      const url = `https://www.validators.app/api/v1/validators/mainnet.json?limit=${limit}&page=${page}`;

      const response = await fetch(url, {
        headers: {
          Token: VALIDATORS_APP_API_TOKEN,
        },
        next: { revalidate: CACHE_REVALIDATE_SECONDS },
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.warn("Rate limited at page", page);
          break;
        }
        console.error(`API returned ${response.status}`);
        break;
      }

      const data: ValidatorInfo[] = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        break;
      }

      allValidators.push(...data);

      if (data.length < limit) {
        break;
      }

      page++;
    }
  } catch (error) {
    console.error("Failed to fetch validators:", error);
  }

  return allValidators;
}

/**
 * Get processed validator data with BAM and Harmonic overrides applied
 */
const getValidatorDataCached = unstable_cache(
  async (): Promise<{
    validators: ValidatorData[];
    names: Record<string, string>;
    generatedAt: string;
  }> => {
    const [validatorsRaw, bamValidators] = await Promise.all([
      fetchValidatorsFromApi(),
      fetchBamValidatorsRaw(),
    ]);

    // Create a set of confirmed BAM validator pubkeys
    const bamValidatorPubkeys = new Set(
      bamValidators.map((v) => v.validator_pubkey)
    );

    // Build names map
    const names: Record<string, string> = {};
    for (const v of validatorsRaw) {
      if (v.name && v.name.trim()) {
        names[v.account] = v.name.trim();
      }
    }

    // Build validators list with overrides
    const validators: ValidatorData[] = [];
    for (const v of validatorsRaw) {
      if (v.active_stake && v.active_stake > 0) {
        let softwareClient = v.software_client || "Unknown";

        // BAM validators from confirmed list
        if (bamValidatorPubkeys.has(v.account)) {
          softwareClient = "AgaveBam";
        }
        // If gossip says BAM but not in confirmed list, it's regular Jito
        else if (softwareClient === "AgaveBam") {
          softwareClient = "JitoLabs";
        }
        // Most "Unknown" validators are Harmonic, except those in exclusion list
        else if (softwareClient === "Unknown" && !notHarmonicValidators.has(v.account)) {
          softwareClient = "Harmonic";
        }

        validators.push({
          account: v.account,
          name: v.name?.trim() || null,
          activeStake: v.active_stake,
          softwareClient,
        });
      }
    }

    // Sort by stake descending
    validators.sort((a, b) => b.activeStake - a.activeStake);

    return {
      validators,
      names,
      generatedAt: new Date().toISOString(),
    };
  },
  ["validator-data"],
  { revalidate: CACHE_REVALIDATE_SECONDS }
);

/**
 * Get validator name by account address.
 * Returns null if not found or no name available.
 */
export async function getValidatorName(account: string): Promise<string | null> {
  const data = await getValidatorDataCached();
  return data.names[account] ?? null;
}

/**
 * Get multiple validator names at once.
 * Returns a map of account -> name (null if not found).
 */
export async function getValidatorNames(accounts: string[]): Promise<Map<string, string | null>> {
  const data = await getValidatorDataCached();
  const result = new Map<string, string | null>();
  for (const account of accounts) {
    result.set(account, data.names[account] ?? null);
  }
  return result;
}

/**
 * Search validators by name or address prefix.
 * Returns matches with both name and address.
 */
export async function searchValidators(
  query: string,
  limit: number = 10
): Promise<Array<{ account: string; name: string | null }>> {
  const data = await getValidatorDataCached();
  const queryLower = query.toLowerCase();
  const results: Array<{ account: string; name: string | null }> = [];

  for (const [account, name] of Object.entries(data.names)) {
    const nameMatches = name.toLowerCase().includes(queryLower);
    const accountMatches = account.toLowerCase().startsWith(queryLower);

    if (nameMatches || accountMatches) {
      results.push({ account, name });
      if (results.length >= limit) {
        break;
      }
    }
  }

  return results;
}

/**
 * Get all cached validator names.
 * Returns the full names object.
 */
export async function getAllValidatorNames(): Promise<Record<string, string>> {
  const data = await getValidatorDataCached();
  return data.names;
}

/**
 * Get cache metadata (when it was generated, count, etc.)
 */
export async function getCacheInfo(): Promise<{ generatedAt: string; count: number }> {
  const data = await getValidatorDataCached();
  return {
    generatedAt: data.generatedAt,
    count: Object.keys(data.names).length,
  };
}

/**
 * Get all validators with full data including stake and scheduler type.
 * Returns an array sorted by stake descending.
 */
export async function getAllValidators(): Promise<ValidatorData[]> {
  const data = await getValidatorDataCached();
  return data.validators;
}

/**
 * Get validators grouped by scheduler type (software client).
 * Returns a map of softwareClient -> validators array.
 */
export async function getValidatorsBySchedulerType(): Promise<Map<string, ValidatorData[]>> {
  const data = await getValidatorDataCached();
  const grouped = new Map<string, ValidatorData[]>();

  for (const validator of data.validators) {
    const existing = grouped.get(validator.softwareClient) ?? [];
    existing.push(validator);
    grouped.set(validator.softwareClient, existing);
  }

  return grouped;
}

/**
 * Get total stake by scheduler type.
 * Returns a map of softwareClient -> total stake.
 */
export async function getStakeBySchedulerType(): Promise<Map<string, number>> {
  const data = await getValidatorDataCached();
  const stakeMap = new Map<string, number>();

  for (const validator of data.validators) {
    const current = stakeMap.get(validator.softwareClient) ?? 0;
    stakeMap.set(validator.softwareClient, current + validator.activeStake);
  }

  return stakeMap;
}
