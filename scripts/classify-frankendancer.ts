/**
 * Classifies Frankendancer validators as "Rev" or "Vanilla" based on
 * transaction distribution in their most recent slot.
 *
 * Rev schedulers place ALL non-vote, non-Jito transactions in the
 * second half of PoH ticks (32-63).
 *
 * Run: pnpm classify-frankendancer
 */

import * as fs from "fs";
import * as path from "path";
import { ClickHouse } from "clickhouse";
import { config } from "dotenv";

// Load environment variables from .env.local (or .env as fallback)
config({ path: path.join(__dirname, "../.env.local") });
config({ path: path.join(__dirname, "../.env") });

const OUTPUT_PATH = path.join(__dirname, "../src/data/frankendancer-classifications.json");
const VALIDATORS_PATH = path.join(__dirname, "../src/data/validators.json");

type ValidatorData = {
  account: string;
  name: string | null;
  activeStake: number;
  softwareClient: string;
};

type CachedValidators = {
  generatedAt: string;
  count: number;
  validators: ValidatorData[];
};

type Classification = "Rev" | "Vanilla";

type ClassificationResult = {
  generatedAt: string;
  classifications: Record<string, Classification>;
};

function getClickHouseClient(): ClickHouse {
  const host = process.env.CLICKHOUSE_HOST;
  const username = process.env.CLICKHOUSE_USERNAME;
  const password = process.env.CLICKHOUSE_PASSWORD;
  const database = process.env.CLICKHOUSE_DATABASE || "default";
  const port = parseInt(process.env.CLICKHOUSE_PORT ?? "9440", 10);

  if (!host || !username || !password) {
    throw new Error("Missing ClickHouse credentials in environment variables");
  }

  return new ClickHouse({
    url: `https://${host}`,
    port,
    basicAuth: { username, password },
    debug: false,
    isUseGzip: false,
    format: "json",
    config: { database },
  });
}

const NUM_SLOTS_TO_CHECK = 5;

async function classifySlot(
  client: ClickHouse,
  slot: number
): Promise<{ isRev: boolean; ratio: number; txCount: number }> {

  // Fetch entries to build PoH tick mapping
  const entriesQuery = `
    SELECT
      index,
      executed_transaction_count
    FROM bam.geyser_entries
    WHERE slot = ${slot}
      AND source = (
        SELECT source FROM bam.geyser_entries
        WHERE slot = ${slot}
        ORDER BY time ASC
        LIMIT 1
      )
    ORDER BY index
    FORMAT JSON
  `;

  // Fetch non-vote transactions
  const transactionsQuery = `
    SELECT
      index,
      base58Encode(signature) AS signature
    FROM bam.geyser_transactions
    WHERE slot = ${slot}
      AND is_vote = false
    GROUP BY signature, index
    ORDER BY index
    FORMAT JSON
  `;

  // Fetch Jito bundle signatures
  const bundleTxQuery = `
    SELECT
      base58Encode(arrayJoin(tx_signatures)) AS signature
    FROM bundles.bundles_landed_v2
    WHERE slot = ${slot}
      AND validator = (
        SELECT validator_identity FROM bam.geyser_block_metadata WHERE slot = ${slot} LIMIT 1
      )
    GROUP BY signature
    FORMAT JSON
  `;

  const [entriesRows, transactionsRows, bundleRows] = await Promise.all([
    client.query(entriesQuery).toPromise() as Promise<{ index: number; executed_transaction_count: number }[]>,
    client.query(transactionsQuery).toPromise() as Promise<{ index: number; signature: string }[]>,
    client.query(bundleTxQuery).toPromise().catch(() => []) as Promise<{ signature: string }[]>,
  ]);

  const bundleSigSet = new Set<string>(bundleRows.map((r) => r.signature));

  // Build entry boundaries to map transaction index to PoH tick
  let cumulative = 0;
  let tickNumber = -1;
  const entryBoundaries: { start0: number; end0: number; tickNumber: number }[] = [];

  for (const e of entriesRows) {
    const txCount = e.executed_transaction_count;
    if (txCount === 0) {
      tickNumber += 1;
    }

    const start0 = cumulative;
    const end0 = cumulative + txCount - 1;
    cumulative += txCount;

    const effectiveTick = Math.max(0, tickNumber);
    entryBoundaries.push({ start0, end0, tickNumber: effectiveTick });
  }

  function findTickForTxIndex(idx: number): number {
    const b = entryBoundaries.find((b) => idx >= b.start0 && idx <= b.end0);
    if (b) return b.tickNumber;
    if (entryBoundaries.length === 0) return 0;
    if (idx < entryBoundaries[0].start0) return entryBoundaries[0].tickNumber;
    return entryBoundaries[entryBoundaries.length - 1].tickNumber;
  }

  // Filter to non-vote, non-Jito transactions
  const regularTxs = transactionsRows.filter((tx) => !bundleSigSet.has(tx.signature));

  if (regularTxs.length === 0) {
    // No regular transactions - cannot determine
    return { isRev: false, ratio: 0, txCount: 0 };
  }

  // Count how many regular transactions are in the second half (tick >= 32)
  const secondHalfCount = regularTxs.filter((tx) => {
    const tick = findTickForTxIndex(tx.index);
    return tick >= 32;
  }).length;

  // Rev if >= 95% of transactions are in the second half
  const ratio = regularTxs.length > 0 ? secondHalfCount / regularTxs.length : 0;
  const isRev = ratio >= 0.95;

  return { isRev, ratio, txCount: regularTxs.length };
}

async function classifyValidator(
  client: ClickHouse,
  validatorAccount: string
): Promise<Classification> {
  // Get the most recent slots for this validator
  const recentSlotsQuery = `
    SELECT slot
    FROM bam.geyser_block_metadata
    WHERE base58Encode(validator_identity) = '${validatorAccount}'
    ORDER BY slot DESC
    LIMIT ${NUM_SLOTS_TO_CHECK}
    FORMAT JSON
  `;

  const slotsResult = await client.query(recentSlotsQuery).toPromise() as { slot: number }[];

  if (slotsResult.length === 0) {
    console.log(`    No recent slots found`);
    return "Vanilla";
  }

  // Classify each slot
  const slotResults: { slot: number; isRev: boolean; ratio: number; txCount: number }[] = [];

  for (const { slot } of slotsResult) {
    const result = await classifySlot(client, slot);
    const pct = (result.ratio * 100).toFixed(1);
    const label = result.isRev ? "Rev" : "Vanilla";
    console.log(`      slot=${slot} txs=${result.txCount} secondHalf=${pct}% -> ${label}`);
    slotResults.push({ slot, ...result });
  }

  // Filter to slots with transactions
  const validResults = slotResults.filter((r) => r.txCount > 0);

  if (validResults.length === 0) {
    console.log(`    No slots with transactions`);
    return "Vanilla";
  }

  // Majority vote: Rev if more than half of valid slots are Rev
  const revCount = validResults.filter((r) => r.isRev).length;
  const majorityThreshold = Math.ceil(validResults.length / 2);

  const classification = revCount >= majorityThreshold ? "Rev" : "Vanilla";
  console.log(`    -> ${revCount}/${validResults.length} Rev slots -> ${classification}`);

  return classification;
}

async function main() {
  console.log("Loading validators...");

  const validatorsData = JSON.parse(fs.readFileSync(VALIDATORS_PATH, "utf-8")) as CachedValidators;
  const frankendancerValidators = validatorsData.validators.filter(
    (v) => v.softwareClient === "Frankendancer"
  );

  console.log(`Found ${frankendancerValidators.length} Frankendancer validators`);

  if (frankendancerValidators.length === 0) {
    console.log("No Frankendancer validators found, writing empty classifications");
    const result: ClassificationResult = {
      generatedAt: new Date().toISOString(),
      classifications: {},
    };
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
    return;
  }

  const client = getClickHouseClient();
  const classifications: Record<string, Classification> = {};

  // Run classifications in parallel batches of 10
  const BATCH_SIZE = 10;
  for (let i = 0; i < frankendancerValidators.length; i += BATCH_SIZE) {
    const batch = frankendancerValidators.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (validator, idx) => {
        const globalIdx = i + idx + 1;
        try {
          const result = await classifyValidator(client, validator.account);
          return { validator, result, globalIdx };
        } catch (error) {
          console.error(`[${globalIdx}/${frankendancerValidators.length}] Error classifying ${validator.name || validator.account}: ${error}`);
          return { validator, result: "Vanilla" as Classification, globalIdx };
        }
      })
    );

    for (const { validator, result, globalIdx } of results) {
      classifications[validator.account] = result || "Vanilla";
      console.log(`[${globalIdx}/${frankendancerValidators.length}] ${validator.name || validator.account} -> ${result || "Vanilla"}`);
    }
  }

  const result: ClassificationResult = {
    generatedAt: new Date().toISOString(),
    classifications,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
  console.log(`\n✓ Saved classifications to ${OUTPUT_PATH}`);

  const revCount = Object.values(classifications).filter((c) => c === "Rev").length;
  const vanillaCount = Object.values(classifications).filter((c) => c === "Vanilla").length;
  console.log(`  Rev: ${revCount}, Vanilla: ${vanillaCount}`);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
