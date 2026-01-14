import "server-only";

import { getClickHouseClient } from "@/lib/clickhouse";
import type {
  BlockMetadataPoint,
  BundleLandingPoint,
  EntryVolumePoint,
  SlotBundle,
  SlotStatusPoint,
  TimeRange,
  TransactionThroughputPoint,
  SlotDetail,
  SlotEntry,
  SlotTransaction,
  SlotMetadata,
  PropAmmFirstWin
} from "@/lib/types";
import { PROP_AMM_ACCOUNT_MAP, PROP_AMM_ACCOUNTS } from "@/lib/prop-amm";

const TABLE_SAMPLES = [
  { key: "bundles", table: "bundles.bundles_landed_v2" },
  { key: "transactions", table: "bam.geyser_transactions" },
  { key: "entries", table: "bam.geyser_entries" },
  { key: "slotStatus", table: "bam.geyser_slot_status" },
  { key: "blockMetadata", table: "bam.geyser_block_metadata" }
] as const;

export async function fetchBundleLandingSeries(
  range: TimeRange
): Promise<BundleLandingPoint[]> {
  const client = getClickHouseClient();

  const query = `
    SELECT
      toStartOfInterval(time, INTERVAL 5 minute) AS window_start,
      count() AS bundle_count,
      sumOrNull(landed_tip_lamports) AS total_profit
    FROM bundles.bundles_landed_v2
    WHERE time BETWEEN parseDateTimeBestEffort('${range.from}') AND parseDateTimeBestEffort('${range.to}')
    GROUP BY window_start
    ORDER BY window_start
    FORMAT JSON
  `;

  const result = await client.query(query).toPromise();
  const rows = result as {
    window_start: string;
    bundle_count: number;
    total_profit: number | null;
  }[];

  return rows.map<BundleLandingPoint>((row) => ({
    windowStart: row.window_start,
    bundleCount: row.bundle_count,
    totalProfit: row.total_profit ? row.total_profit / 1_000_000_000 : null // Convert lamports to SOL
  }));
}

export async function fetchTransactionThroughput(
  range: TimeRange
): Promise<TransactionThroughputPoint[]> {
  const client = getClickHouseClient();

  const query = `
    SELECT
      toStartOfInterval(time, INTERVAL 5 minute) AS window_start,
      count() AS transaction_count
    FROM bam.geyser_transactions
    WHERE time BETWEEN parseDateTimeBestEffort('${range.from}') AND parseDateTimeBestEffort('${range.to}')
    GROUP BY window_start
    ORDER BY window_start
    FORMAT JSON
  `;

  const result = await client.query(query).toPromise();
  const rows = result as {
    window_start: string;
    transaction_count: number;
  }[];

  return rows.map<TransactionThroughputPoint>((row) => ({
    windowStart: row.window_start,
    transactionCount: row.transaction_count
  }));
}

export async function fetchEntryVolume(
  range: TimeRange
): Promise<EntryVolumePoint[]> {
  const client = getClickHouseClient();

  const query = `
    SELECT
      toStartOfInterval(time, INTERVAL 5 minute) AS window_start,
      count() AS entry_count
    FROM bam.geyser_entries
    WHERE time BETWEEN parseDateTimeBestEffort('${range.from}') AND parseDateTimeBestEffort('${range.to}')
    GROUP BY window_start
    ORDER BY window_start
    FORMAT JSON
  `;

  const result = await client.query(query).toPromise();
  const rows = result as {
    window_start: string;
    entry_count: number;
  }[];

  return rows.map<EntryVolumePoint>((row) => ({
    windowStart: row.window_start,
    entryCount: row.entry_count
  }));
}

type TableSampleResult = {
  rows: Record<string, unknown>[];
  error?: string;
};

export async function fetchTableSamples(limit = 5) {
  const client = getClickHouseClient();

  const samples: Record<
    (typeof TABLE_SAMPLES)[number]["key"],
    TableSampleResult
  > = {} as any;

  for (const { key, table } of TABLE_SAMPLES) {
    try {
      const query = `SELECT * FROM ${table} LIMIT ${limit} FORMAT JSON`;
      const result = await client.query(query).toPromise();
      const rows = result as Record<string, unknown>[];
      samples[key] = { rows };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred.";
      samples[key] = { rows: [], error: message };
    }
  }

  return samples;
}

export async function fetchSlotStatusSummary(
  range: TimeRange
): Promise<SlotStatusPoint[]> {
  const client = getClickHouseClient();

  const query = `
    SELECT
      toStartOfInterval(time, INTERVAL 5 minute) AS window_start,
      status,
      count() AS slot_count
    FROM bam.geyser_slot_status
    WHERE time BETWEEN parseDateTimeBestEffort('${range.from}') AND parseDateTimeBestEffort('${range.to}')
    GROUP BY window_start, status
    ORDER BY window_start, status
    FORMAT JSON
  `;

  const result = await client.query(query).toPromise();
  const rows = result as {
    window_start: string;
    status: string;
    slot_count: number;
  }[];

  return rows.map<SlotStatusPoint>((row) => ({
    windowStart: row.window_start,
    status: row.status,
    slotCount: row.slot_count
  }));
}

export async function fetchBlockMetadata(
  range: TimeRange
): Promise<BlockMetadataPoint[]> {
  const client = getClickHouseClient();

  const query = `
    SELECT
      toStartOfInterval(time, INTERVAL 5 minute) AS window_start,
      count() AS avg_tx_per_block,
      avgOrNull(total_fee_lamports) AS avg_success_tx,
      count() AS avg_compute_units
    FROM bam.geyser_block_metadata
    WHERE time BETWEEN parseDateTimeBestEffort('${range.from}') AND parseDateTimeBestEffort('${range.to}')
    GROUP BY window_start
    ORDER BY window_start
    FORMAT JSON
  `;

  const result = await client.query(query).toPromise();
  const rows = result as {
    window_start: string;
    avg_tx_per_block: number | null;
    avg_success_tx: number | null;
    avg_compute_units: number | null;
  }[];

  return rows.map<BlockMetadataPoint>((row) => ({
    windowStart: row.window_start,
    avgTxPerBlock: row.avg_tx_per_block,
    avgSuccessTx: row.avg_success_tx,
    avgComputeUnits: row.avg_compute_units
  }));
}

// Fetch full block metadata row(s) for a specific slot for inspection/debug
export async function fetchSlotBlockMetadataRaw(
  slot: number
): Promise<Record<string, unknown>[]> {
  const client = getClickHouseClient();
  const query = `
    SELECT *
    FROM bam.geyser_block_metadata
    WHERE slot = ${slot}
    FORMAT JSON
  `;
  const rows = (await client.query(query).toPromise()) as Record<string, unknown>[];
  return rows;
}

export async function fetchSlotBundles(slot: number): Promise<SlotBundle[]> {
  const client = getClickHouseClient();
  const query = `
    SELECT
      base58Encode(bundle_id) AS bundle_id,
      base58Encode(validator) AS validator,
      landed_tip_lamports,
      ifNull(landed_cu, 0) AS landed_cu,
      arrayMap(x -> base58Encode(x), tx_signatures) AS tx_sigs
    FROM bundles.bundles_landed_v2
    WHERE slot = ${slot}
    ORDER BY landed_tip_lamports DESC
    FORMAT JSON
  `;
  const rows = (await client.query(query).toPromise()) as {
    bundle_id: string;
    validator: string | null;
    landed_tip_lamports: number;
    landed_cu: number | null;
    tx_sigs: string[];
  }[];

  return rows.map<SlotBundle>((r) => ({
    bundleId: r.bundle_id,
    validator: r.validator,
    landedTipLamports: r.landed_tip_lamports,
    landedCu: r.landed_cu,
    txSignatures: r.tx_sigs || [],
    txCount: (r.tx_sigs || []).length
  }));
}

export async function fetchSlotDetail(slot: number): Promise<SlotDetail> {
  const client = getClickHouseClient();

  // Fetch slot metadata
  const metadataQuery = `
    SELECT
      bm.slot,
      base58Encode(bm.validator_identity) AS leader_validator,
      bm.block_height,
      bm.total_fee_lamports,
      (SELECT time FROM bam.geyser_slot_status WHERE slot = ${slot} AND status = 'FirstShredReceived' LIMIT 1) AS first_shred_time,
      (SELECT time FROM bam.geyser_slot_status WHERE slot = ${slot - 1} AND status = 'FirstShredReceived' LIMIT 1) AS prev_slot_first_shred_time,
      (SELECT time FROM bam.geyser_slot_status WHERE slot = ${slot} AND status = 'LastShredReceived' ORDER BY time DESC LIMIT 1) AS last_shred_time
    FROM bam.geyser_block_metadata bm
    WHERE bm.slot = ${slot}
    LIMIT 1
    FORMAT JSON
  `;

  // Try to fetch entries including num_hashes (if present in schema).
  const entriesQueryWithHashes = `
    SELECT
      index,
      time,
      executed_transaction_count,
      num_hashes
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

  // Fallback entries query if num_hashes is not available.
  const entriesQueryFallback = `
    SELECT
      index,
      time,
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

  // Fetch transactions for this slot (deduplicated by averaging timestamps)
  const transactionsQuery = `
    SELECT
      index,
      avg(toUnixTimestamp64Milli(time)) AS avg_time_ms,
      is_vote,
      any(compute_units_consumed) AS compute_units_consumed,
      any(compute_units_requested) AS compute_units_requested,
      any(fee) AS fee,
      any(compute_unit_price) AS compute_unit_price,
      base58Encode(signature) AS signature,
      arrayMap(x -> base58Encode(x), coalesce(any(static_signed_writable_accounts), [])) AS static_signed_writable_accounts,
      arrayMap(x -> base58Encode(x), coalesce(any(static_signed_readonly_accounts), [])) AS static_signed_readonly_accounts,
      arrayMap(x -> base58Encode(x), coalesce(any(static_unsigned_writable_accounts), [])) AS static_unsigned_writable_accounts,
      arrayMap(x -> base58Encode(x), coalesce(any(static_unsigned_readonly_accounts), [])) AS static_unsigned_readonly_accounts
    FROM bam.geyser_transactions
    WHERE slot = ${slot}
    GROUP BY signature, index, is_vote
    ORDER BY index
    FORMAT JSON
  `;

  // Fetch bundle transaction signatures landed in this slot
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

  // Allocate Jito bundle tips to txs proportionally by compute units.
  const bundleAllocationQuery = `
    SELECT
      br.signature AS signature,
      if(pb.total_cu > 0,
         br.bundle_tip * coalesce(tx.cu, 0) / pb.total_cu,
         br.bundle_tip / pb.tx_count) AS allocated_tip,
      if(pb.total_cu > 0, br.bundle_tip / pb.total_cu, NULL) AS bundle_tip_per_cu
    FROM (
      SELECT
        bundle_id,
        base58Encode(arrayJoin(tx_signatures)) AS signature,
        landed_tip_lamports AS bundle_tip
      FROM bundles.bundles_landed_v2
      WHERE slot = ${slot}
        AND validator = (
          SELECT validator_identity FROM bam.geyser_block_metadata WHERE slot = ${slot} LIMIT 1
        )
    ) AS br
    LEFT JOIN (
      SELECT base58Encode(signature) AS signature, any(compute_units_consumed) AS cu
      FROM bam.geyser_transactions
      WHERE slot = ${slot}
      GROUP BY signature
    ) AS tx ON br.signature = tx.signature
    INNER JOIN (
      SELECT
        s.bundle_id AS bundle_id,
        sum(coalesce(txx.cu, 0)) AS total_cu,
        count() AS tx_count
      FROM (
        SELECT bundle_id, base58Encode(arrayJoin(tx_signatures)) AS signature
        FROM bundles.bundles_landed_v2
        WHERE slot = ${slot}
          AND validator = (
            SELECT validator_identity FROM bam.geyser_block_metadata WHERE slot = ${slot} LIMIT 1
          )
      ) AS s
      LEFT JOIN (
        SELECT base58Encode(signature) AS signature, any(compute_units_consumed) AS cu
        FROM bam.geyser_transactions
        WHERE slot = ${slot}
        GROUP BY signature
      ) AS txx ON s.signature = txx.signature
      GROUP BY bundle_id
    ) AS pb ON br.bundle_id = pb.bundle_id
    FORMAT JSON
  `;

  const metadataPromise = client.query(metadataQuery).toPromise();
  const transactionsPromise = client.query(transactionsQuery).toPromise();
  const entriesPromise = client
    .query(entriesQueryWithHashes)
    .toPromise()
    .catch(async () => {
      // Column likely not present; run fallback query.
      return client.query(entriesQueryFallback).toPromise();
    });
  const bundlesPromise = client.query(bundleTxQuery).toPromise().catch(() => []);

  const [metadataResult, entriesResult, transactionsResult, bundleTxRows, allocationRows] = await Promise.all([
    metadataPromise,
    entriesPromise,
    transactionsPromise,
    bundlesPromise,
    client.query(bundleAllocationQuery).toPromise().catch(() => [])
  ]);

  const metadataRows = metadataResult as {
    slot: number;
    leader_validator: string;
    block_height: number;
    total_fee_lamports: number;
    first_shred_time: string | null;
    prev_slot_first_shred_time: string | null;
  }[];

  const entriesRows = entriesResult as {
    index: number;
    time: string;
    executed_transaction_count: number;
    num_hashes?: number | null;
  }[];

  const transactionsRows = transactionsResult as {
    index: number;
    avg_time_ms: number;
    is_vote: boolean;
    compute_units_consumed: number | null;
    compute_units_requested: number | null;
    fee: number | null;
    signature: string;
    compute_unit_price: number | null;
    static_signed_writable_accounts?: string[] | null;
    static_signed_readonly_accounts?: string[] | null;
    static_unsigned_writable_accounts?: string[] | null;
    static_unsigned_readonly_accounts?: string[] | null;
  }[];

  const bundleSigSet = new Set<string>(
    ((bundleTxRows as any[]) || []).map((r: any) => r.signature)
  );

  // Sum allocations across all bundles (a tx can appear in multiple landed bundles)
  type AllocationInfo = { allocatedTip: number; bundleTipPerCu: number | null };
  const allocationMap = new Map<string, AllocationInfo>();
  for (const r of (((allocationRows as any[]) || []) as any[])) {
    const sig = r.signature as string;
    const add = Number(r.allocated_tip || 0);
    const perCu =
      r.bundle_tip_per_cu === null || typeof r.bundle_tip_per_cu === "undefined"
        ? null
        : Number(r.bundle_tip_per_cu);
    const existing = allocationMap.get(sig);
    if (existing) {
      allocationMap.set(sig, {
        allocatedTip: existing.allocatedTip + add,
        bundleTipPerCu: existing.bundleTipPerCu ?? perCu
      });
    } else {
      allocationMap.set(sig, {
        allocatedTip: add,
        bundleTipPerCu: perCu
      });
    }
  }

  const metadata: SlotMetadata = metadataRows.length > 0 ? {
    slot: metadataRows[0].slot,
    leaderValidator: metadataRows[0].leader_validator,
    blockHeight: metadataRows[0].block_height,
    totalFee: metadataRows[0].total_fee_lamports,
    firstShredTime: metadataRows[0].first_shred_time,
    prevSlotFirstShredTime: metadataRows[0].prev_slot_first_shred_time,
    lastShredTime: metadataRows[0].last_shred_time ?? null
  } : {
    slot,
    leaderValidator: "Unknown",
    blockHeight: 0,
    totalFee: 0,
    firstShredTime: null,
    prevSlotFirstShredTime: null,
    lastShredTime: null
  };

  const entries: SlotEntry[] = entriesRows.map(row => ({
    index: row.index,
    time: row.time,
    executedTransactionCount: row.executed_transaction_count,
    numHashes: row.num_hashes ?? null
  }));

  // Build entry index boundaries and map each entry to the most recent PoH tick entry
  const entryBoundaries = (() => {
    let cumulative = 0;
    let tickNumber = -1; // zero-based; becomes 0 at first PoH tick
    let tickEntryIndex: number | null = null;
    let tickTimeMs: number | null = null;
    return entries.map((e) => {
      // Update current tick if this entry is a PoH tick (no executed txs)
      if (e.executedTransactionCount === 0) {
        tickNumber += 1;
        tickEntryIndex = e.index;
        tickTimeMs = new Date(e.time).getTime();
      }

      const start0 = cumulative; // zero-based start for tx indices
      const end0 = cumulative + e.executedTransactionCount - 1; // zero-based end
      const start1 = cumulative + 1; // one-based start
      const end1 = cumulative + e.executedTransactionCount; // one-based end
      const timeMs = new Date(e.time).getTime();
      cumulative += e.executedTransactionCount;

      // Clamp tick to at least 0 so pre-first-tick txs map to tick 0 (displayed as 1)
      const effectiveTick = Math.max(0, tickNumber);

      return {
        index: e.index,
        timeMs,
        start0,
        end0,
        start1,
        end1,
        tickNumber: effectiveTick,
        tickEntryIndex,
        tickTimeMs
      };
    });
  })();

  function findBoundaryForTxIndex(idx: number) {
    // prefer zero-based mapping
    let b = entryBoundaries.find((b) => idx >= b.start0 && idx <= b.end0);
    if (!b) {
      // fallback to one-based range
      b = entryBoundaries.find((b) => idx >= b.start1 && idx <= b.end1);
    }
    if (b) return b;
    // edge cases: before first or after last
    if (entryBoundaries.length === 0) return null;
    if (idx < entryBoundaries[0].start0) return entryBoundaries[0];
    return entryBoundaries[entryBoundaries.length - 1];
  }

  const transactions: SlotTransaction[] = transactionsRows.map(row => {
    const allocationInfo = allocationMap.get(row.signature);
    const allocatedTip = allocationInfo?.allocatedTip ?? 0;
    const bundleTipPerCu = allocationInfo?.bundleTipPerCu ?? null;
    const fee = row.fee ?? 0;
    // Leader receives half of the 5,000 lamport base fee (2,500) and 100% of
    // any fee above the base (e.g., prioritization fees). Negative guarded at 0.
    const basePortion = Math.min(fee, 5000);
    const baseToLeader = Math.floor(basePortion / 2);
    const extraToLeader = Math.max(0, fee - 5000);
    const leaderFeeShare = baseToLeader + extraToLeader;
    const reward = leaderFeeShare + allocatedTip;
    const boundary = findBoundaryForTxIndex(row.index);
    const writableAccounts = row.static_signed_writable_accounts ?? [];
    const readonlyAccounts = row.static_signed_readonly_accounts ?? [];
    const unsignedWritable = row.static_unsigned_writable_accounts ?? [];
    const unsignedReadonly = row.static_unsigned_readonly_accounts ?? [];
    const accountMatches = [
      ...writableAccounts,
      ...readonlyAccounts,
      ...unsignedWritable,
      ...unsignedReadonly
    ];
    let propAmmAccount: string | null = null;
    let propAmmLabel: string | null = null;
    for (const account of accountMatches) {
      const match = PROP_AMM_ACCOUNT_MAP.get(account);
      if (match) {
        propAmmAccount = account;
        propAmmLabel = match.label;
        break;
      }
    }
    const firstEntryTimeMs = boundary ? boundary.timeMs : null;
    return {
      index: row.index,
      time: new Date(row.avg_time_ms).toISOString(),
      isVote: row.is_vote,
      computeUnitsConsumed: row.compute_units_consumed,
      computeUnitsRequested: row.compute_units_requested ?? null,
      signature: row.signature,
      feeLamports: row.fee ?? null,
      computeUnitPrice: row.compute_unit_price ?? null,
      isJitoBundle: bundleSigSet.has(row.signature),
      allocatedTipLamports: allocatedTip,
      rewardLamports: reward,
      bundleTipPerTotalCu: bundleTipPerCu,
      firstEntryTimeMs,
      pohTickNumber: boundary?.tickNumber ?? null,
      pohTickEntryIndex: boundary?.tickEntryIndex ?? null,
      pohTickTimeMs: boundary?.tickTimeMs ?? null,
      staticSignedWritableAccounts: writableAccounts,
      staticSignedReadonlyAccounts: readonlyAccounts,
      propAmmAccount,
      propAmmLabel
    };
  });

  return {
    metadata,
    entries,
    transactions
  };
}

export async function fetchPropAmmFirstWins(
  startSlot: number,
  endSlot: number,
  options?: { maxRange?: number }
): Promise<PropAmmFirstWin[]> {
  if (!Number.isFinite(startSlot) || !Number.isFinite(endSlot)) {
    throw new Error("Invalid slot range");
  }
  const [fromSlot, toSlot] =
    startSlot <= endSlot ? [startSlot, endSlot] : [endSlot, startSlot];
  const maxRange = options?.maxRange ?? Infinity;
  if (toSlot - fromSlot > maxRange) {
    throw new Error(`Slot range too large (>${maxRange}). Please narrow the window.`);
  }
  if (PROP_AMM_ACCOUNTS.length === 0) return [];

  const client = getClickHouseClient();
  const accountListSql = PROP_AMM_ACCOUNTS.map((entry) => `'${entry.account}'`).join(", ");
  const propAccountsLiteral = `array(${accountListSql})`;

  const query = `
    WITH ${propAccountsLiteral} AS prop_accounts
    SELECT
      tx.slot AS slot,
      tx.tx_index AS tx_index,
      base58Encode(tx.signature) AS signature,
      base58Encode(bm.validator_identity) AS validator,
      tx.matching_account AS account
    FROM (
      SELECT
        slot,
        index AS tx_index,
        signature,
        arrayFirst(
          acc -> acc IN prop_accounts,
          arrayConcat(
            arrayMap(x -> base58Encode(x), coalesce(static_signed_writable_accounts, [])),
            arrayMap(x -> base58Encode(x), coalesce(static_signed_readonly_accounts, [])),
            arrayMap(x -> base58Encode(x), coalesce(static_unsigned_writable_accounts, [])),
            arrayMap(x -> base58Encode(x), coalesce(static_unsigned_readonly_accounts, []))
          )
        ) AS matching_account
      FROM bam.geyser_transactions
      WHERE slot BETWEEN ${fromSlot} AND ${toSlot}
    ) AS tx
    INNER JOIN bam.geyser_block_metadata bm ON bm.slot = tx.slot
    WHERE matching_account IS NOT NULL AND matching_account != ''
    ORDER BY slot ASC, tx_index ASC
    FORMAT JSON
  `;

  const rows = (await client.query(query).toPromise()) as {
    slot: number;
    tx_index: number;
    signature: string;
    validator: string;
    account: string;
  }[];

  const firstBySlot = new Map<number, (typeof rows)[number]>();
  for (const row of rows) {
    if (!firstBySlot.has(row.slot)) {
      firstBySlot.set(row.slot, row);
    }
  }

  const winners = Array.from(firstBySlot.values()).map<PropAmmFirstWin>((row) => {
    const match = PROP_AMM_ACCOUNT_MAP.get(row.account);
    return {
      slot: row.slot,
      validator: row.validator,
      signature: row.signature,
      transactionIndex: row.tx_index,
      account: row.account,
      group: match?.group ?? null
    };
  });

  return winners.sort((a, b) => a.slot - b.slot);
}

export async function fetchPropAmmFirstWinsIncremental(
  startSlot: number,
  endSlot: number,
  chunkSize = 1000,
  onChunk?: (chunkWins: PropAmmFirstWin[], range: { start: number; end: number }) => Promise<void> | void
): Promise<PropAmmFirstWin[]> {
  const results: PropAmmFirstWin[] = [];
  const [fromSlot, toSlot] =
    startSlot <= endSlot ? [startSlot, endSlot] : [endSlot, startSlot];
  let currentStart = fromSlot;
  while (currentStart <= toSlot) {
    const currentEnd = Math.min(currentStart + chunkSize - 1, toSlot);
    const chunk = await fetchPropAmmFirstWins(currentStart, currentEnd);
    results.push(...chunk);
    if (onChunk && chunk.length) {
      await onChunk(chunk, { start: currentStart, end: currentEnd });
    }
    currentStart = currentEnd + 1;
  }
  return results;
}

export async function fetchValidatorRecentSlotDetails(
  validatorIdentity: string,
  limit = 20
): Promise<SlotDetail[]> {
  const validator = validatorIdentity.trim();
  if (!validator) return [];
  const client = getClickHouseClient();
  const escaped = validator.replace(/'/g, "\\'");
  const slotQuery = `
    SELECT slot
    FROM bam.geyser_block_metadata
    WHERE validator_identity = base58Decode('${escaped}')
    ORDER BY slot DESC
    LIMIT ${limit}
    FORMAT JSON
  `;

  const slotRows = (await client.query(slotQuery).toPromise()) as { slot: number }[];
  const slots = slotRows.map((row) => row.slot);
  if (!slots.length) return [];

  const slotDetails = await Promise.all(
    slots.map((slot) =>
      fetchSlotDetail(slot).catch(() => null)
    )
  );

  return slotDetails.filter((detail): detail is SlotDetail => detail !== null);
}

export async function fetchLatestCompletedEpochRange(): Promise<{ epoch: number; minSlot: number; maxSlot: number } | null> {
  const client = getClickHouseClient();
  const query = `
    WITH target_epoch AS (
      SELECT max(epoch) - 1 AS epoch_value
      FROM bam.geyser_block_metadata
    )
    SELECT
      any(bm.epoch) AS epoch,
      min(bm.slot) AS min_slot,
      max(bm.slot) AS max_slot
    FROM bam.geyser_block_metadata bm
    WHERE bm.epoch = (SELECT epoch_value FROM target_epoch)
    FORMAT JSON
  `;

  const rows = (await client.query(query).toPromise()) as {
    epoch: number | null;
    min_slot: number | null;
    max_slot: number | null;
  }[];

  if (!rows.length) return null;
  const row = rows[0];
  if (row.epoch === null || row.min_slot === null || row.max_slot === null) return null;
  return { epoch: row.epoch, minSlot: row.min_slot, maxSlot: row.max_slot };
}

export async function fetchRecentSlotRange(hours = 4): Promise<{ minSlot: number; maxSlot: number } | null> {
  const client = getClickHouseClient();
  const minutes = Math.max(1, Math.round(hours * 60));
  const query = `
    SELECT
      min(slot) AS min_slot,
      max(slot) AS max_slot
    FROM bam.geyser_block_metadata
    WHERE time >= now() - INTERVAL ${minutes} MINUTE
    FORMAT JSON
  `;
  const rows = (await client.query(query).toPromise()) as { min_slot: number | null; max_slot: number | null }[];
  if (!rows.length) return null;
  const row = rows[0];
  if (row.min_slot === null || row.max_slot === null) return null;
  return { minSlot: row.min_slot, maxSlot: row.max_slot };
}
