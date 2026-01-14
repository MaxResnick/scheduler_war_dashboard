# Scheduler War Dashboard

Next.js dashboard for monitoring Solana scheduler war metrics. Connects to ClickHouse (Jito's public datasets) to visualize operational data including bundles landed, geyser throughput, entry ingest, slot status, and block metadata.

## Getting started

1. Install dependencies:
   ```bash
   pnpm install
   # or npm install / yarn install
   ```
2. Copy `.env.example` to `.env.local` and provide ClickHouse credentials with TLS enabled (`https` on port `8443` or native on port `9440`). If your ClickHouse deployment requires mutual TLS, supply the client certificate/key paths as well.
3. Run the dev server:
   ```bash
   pnpm dev
   ```

## Data model

The app includes a reusable ClickHouse client (`src/lib/clickhouse.ts`) and query helpers (`src/lib/queries.ts`) that target the following tables:

- `bundles.bundles_landed_v2`
- `bam.geyser_transactions`
- `bam.geyser_entries`
- `bam.geyser_slot_status`
- `bam.geyser_block_metadata`

The query layer aggregates metrics in 5-minute windows and returns structured payloads for the UI.

## Entries to PoH Ticks Methodology

The dashboard maps geyser entries to Proof of History (PoH) ticks to understand transaction sequencing within a slot. This is crucial for analyzing scheduler behavior and transaction ordering.

### How it works

The PoH tick derivation is implemented in `src/lib/queries.ts` within the `fetchSlotDetail` function:

1. **Identify PoH ticks**: Any entry with `executedTransactionCount === 0` is treated as a PoH tick. These represent moments when the leader hashes without including transactions.

2. **Build cumulative offsets**: We iterate through entries in order, maintaining:
   - A running sum of executed transactions
   - The current tick number (incremented at each zero-transaction entry)
   - References to the most recent tick's entry index and timestamp

3. **Map transactions to ticks**: Each transaction's index is matched against the cumulative boundaries to determine which tick preceded it. This lets us answer "which PoH tick was this transaction included after?"

### Code snippet

```typescript
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

    const start0 = cumulative;
    const end0 = cumulative + e.executedTransactionCount - 1;
    cumulative += e.executedTransactionCount;

    return {
      index: e.index,
      start0,
      end0,
      tickNumber: Math.max(0, tickNumber),
      tickEntryIndex,
      tickTimeMs
    };
  });
})();
```

### Why this matters

- **Transaction ordering analysis**: Knowing which tick a transaction lands after helps analyze fairness and MEV extraction timing
- **Scheduler comparison**: Different schedulers (e.g., central vs. Agave) may place transactions differently relative to PoH ticks
- **Latency measurement**: The tick timestamp provides a reference point for measuring when transactions were sequenced

### Visualizations

The `/methodology` page shows an interactive chart plotting entry indices (x-axis) against executed transaction counts (y-axis), with dotted vertical lines marking PoH tick entries. This makes it easy to see how transactions cluster between ticks.

## Dashboard UX

- Range selector (2h/6h/12h/24h) re-fetches via `/api/dashboard`
- Metric cards summarize landed bundles, geyser TPS, and entry ingest rate
- Sparkline charts visualize landed bundles, transaction throughput, and entry ingest trends
- Slot status distribution and block metadata snapshot highlight scheduler health
- Slot detail view with transaction sequencing charts and prop AMM analysis

## License

MIT
