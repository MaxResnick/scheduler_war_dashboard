/**
 * Build-time script to fetch and cache validator data from validators.app
 * Run this during build to avoid runtime API calls per user.
 *
 * Usage: npx tsx scripts/fetch-validator-names.ts
 */

import { writeFileSync, existsSync } from "fs";
import { join } from "path";

const OUTPUT_PATH = join(process.cwd(), "src/data/validator-names.json");
const VALIDATORS_OUTPUT_PATH = join(process.cwd(), "src/data/validators.json");

type ValidatorInfo = {
  account: string;
  name: string | null;
  active_stake: number | null;
  software_client: string | null;
};

async function fetchValidatorsFromApi(): Promise<ValidatorInfo[] | null> {
  const apiToken = process.env.VALIDATORS_APP_API_TOKEN;

  if (!apiToken) {
    console.warn("Warning: VALIDATORS_APP_API_TOKEN not set, skipping fetch");
    return null;
  }

  const allValidators: ValidatorInfo[] = [];
  let page = 1;
  const limit = 1000;

  console.log("Fetching validators from validators.app...");

  while (true) {
    const url = `https://www.validators.app/api/v1/validators/mainnet.json?limit=${limit}&page=${page}`;

    const response = await fetch(url, {
      headers: {
        Token: apiToken,
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn("Rate limited, stopping at page", page);
        break;
      }
      throw new Error(`API returned ${response.status}: ${await response.text()}`);
    }

    const data: ValidatorInfo[] = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      break;
    }

    allValidators.push(...data);
    console.log(`  Page ${page}: fetched ${data.length} validators (total: ${allValidators.length})`);

    if (data.length < limit) {
      break;
    }

    page++;
  }

  return allValidators;
}

async function main() {
  try {
    const validators = await fetchValidatorsFromApi();

    // If no token, check if cached data exists
    if (validators === null) {
      if (existsSync(OUTPUT_PATH)) {
        console.log("Using existing cached validator data");
        return;
      } else {
        console.error("Error: No API token and no cached data exists");
        process.exit(1);
      }
    }

    // Build a map of account -> name (only include named validators)
    const namesMap: Record<string, string> = {};
    for (const v of validators) {
      if (v.name && v.name.trim()) {
        namesMap[v.account] = v.name.trim();
      }
    }

    const namesOutput = {
      generatedAt: new Date().toISOString(),
      count: Object.keys(namesMap).length,
      names: namesMap,
    };

    writeFileSync(OUTPUT_PATH, JSON.stringify(namesOutput, null, 2));
    console.log(`Cached ${namesOutput.count} named validators to ${OUTPUT_PATH}`);

    // Build full validator data with stake and scheduler type
    type ValidatorData = {
      account: string;
      name: string | null;
      activeStake: number;
      softwareClient: string;
    };

    const validatorsList: ValidatorData[] = [];
    for (const v of validators) {
      if (v.active_stake && v.active_stake > 0) {
        validatorsList.push({
          account: v.account,
          name: v.name?.trim() || null,
          activeStake: v.active_stake,
          softwareClient: v.software_client || "Unknown",
        });
      }
    }

    // Sort by stake descending
    validatorsList.sort((a, b) => b.activeStake - a.activeStake);

    const validatorsOutput = {
      generatedAt: new Date().toISOString(),
      count: validatorsList.length,
      validators: validatorsList,
    };

    writeFileSync(VALIDATORS_OUTPUT_PATH, JSON.stringify(validatorsOutput, null, 2));
    console.log(`Cached ${validatorsOutput.count} validators with stake data to ${VALIDATORS_OUTPUT_PATH}`);

    console.log("\nSuccess!");
  } catch (error) {
    console.error("Failed to fetch validators:", error);
    process.exit(1);
  }
}

main();
