/**
 * Fetches the list of Rakurai validators from their API.
 * This is the authoritative source for which validators are running Rakurai.
 *
 * Run: pnpm fetch-rakurai-validators
 */

import * as fs from "fs";
import * as path from "path";

const RAKURAI_API_URL = "https://api.rakurai.io/api/v1/validators/overview";
const OUTPUT_PATH = path.join(__dirname, "../src/data/rakurai-validators.json");

type RakuraiApiResponse = {
  general_data: {
    all_validators_Rakurai: number;
    rakurai_Total_stake: number;
    total_Solana_stake: number;
  };
  validators: Array<{
    identity: string;
    name: string;
    activated_stake: number;
    vote_identity: string;
  }>;
};

async function fetchRakuraiValidators() {
  console.log("Fetching Rakurai validators from API...");

  const response = await fetch(RAKURAI_API_URL);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const data: RakuraiApiResponse = await response.json();
  const validators = data.validators.map((v) => ({
    validator_identity: v.identity,
    name: v.name,
    activated_stake: v.activated_stake,
  }));

  // Write to file
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(validators, null, 2));

  console.log(`✓ Saved ${validators.length} Rakurai validators to ${OUTPUT_PATH}`);
}

fetchRakuraiValidators().catch((error) => {
  console.error("Error fetching Rakurai validators:", error);
  process.exit(1);
});
