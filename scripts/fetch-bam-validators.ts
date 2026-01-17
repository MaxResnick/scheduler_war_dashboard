/**
 * Fetches the list of confirmed BAM validators from the BAM Explorer API.
 * This is the authoritative source for which validators are running BAM.
 *
 * Run: pnpm fetch-bam-validators
 */

import * as fs from "fs";
import * as path from "path";

const BAM_API_URL = "https://explorer.bam.dev/api/v1/validators";
const OUTPUT_PATH = path.join(__dirname, "../src/data/bam-validators.json");

async function fetchBamValidators() {
  console.log("Fetching BAM validators from API...");

  const response = await fetch(BAM_API_URL);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const validators = await response.json();

  // Write to file
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(validators, null, 2));

  console.log(`✓ Saved ${validators.length} BAM validators to ${OUTPUT_PATH}`);
}

fetchBamValidators().catch((error) => {
  console.error("Error fetching BAM validators:", error);
  process.exit(1);
});
