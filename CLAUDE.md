# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Next.js dashboard for monitoring Solana scheduler war metrics. Connects to ClickHouse (Jito's public datasets) to visualize operational data including bundles landed, geyser throughput, entry ingest, slot status, and block metadata.

## Development Commands

```bash
# Install dependencies (supports pnpm/npm/yarn)
pnpm install

# Start dev server (http://localhost:3000)
pnpm dev

# Type checking
pnpm typecheck

# Lint code
pnpm lint

# Production build
pnpm build

# Run production server
pnpm start
```

## Environment Setup

Copy `.env.example` to `.env.local` and configure ClickHouse credentials:

- **Required**: `CLICKHOUSE_HOST`, `CLICKHOUSE_USERNAME`, `CLICKHOUSE_PASSWORD`
- **Optional**: `CLICKHOUSE_DATABASE` (defaults to "default"), `CLICKHOUSE_PORT` (defaults to 9440)
- **TLS options**: Set `CLICKHOUSE_TLS_REJECT_UNAUTHORIZED=false` for self-signed certs
- **mTLS**: Provide `CLICKHOUSE_TLS_CERT_PATH` and `CLICKHOUSE_TLS_KEY_PATH` (both required together)
- **Custom CA**: Optionally set `CLICKHOUSE_TLS_CA_PATH`

The ClickHouse host should be hostname only (no protocol prefix). Uses native protocol with TLS on port 9440.

## Architecture

### Data Layer (`src/lib/`)

**ClickHouse Client** (`clickhouse.ts`):
- Singleton client marked `server-only`
- Reads env vars, auto-prefixes `https://` to host if needed
- Supports optional mTLS via cert/key paths and custom CA bundles
- Validates that cert and key are both provided (or both omitted) for mTLS

**Query Functions** (`queries.ts`):
- All queries aggregate data in 5-minute windows (`toStartOfInterval(..., INTERVAL 5 minute)`)
- Targets five ClickHouse tables with the following schemas:

  **`bundles.bundles_landed_v2`:**
  - `bundle_id` (binary), `slot` (UInt64), `validator` (binary - use `base58Encode()` for display)
  - `tippers` (Array), `landed_tip_lamports` (UInt64), `landed_cu` (UInt64)
  - `block_index` (UInt64), `time` (DateTime64), `tx_signatures` (Array)
  - Note: This table tracks bundles landed by validators, NOT which validator was the leader

  **`bam.geyser_transactions`:**
  - `time` (DateTime64), `slot` (UInt64), `signature` (binary), `is_vote` (Bool)
  - `compute_units_consumed`, `compute_units_requested`, `compute_unit_price`, `fee`
  - `landed_tip_lamports`, `error_message`, `index`
  - Account arrays: `static_signed_writable_accounts`, `static_signed_readonly_accounts`, etc.

  **`bam.geyser_entries`:**
  - `time` (DateTime64), `slot` (UInt64), `index` (UInt64)
  - `executed_transaction_count` (UInt64)

  **`bam.geyser_slot_status`:**
  - `time` (DateTime64), `slot` (UInt64), `parent_slot` (Nullable UInt64)
  - `status` (String) - values like "Completed", "Processed", "Rooted"

  **`bam.geyser_block_metadata`:**
  - `time` (DateTime64), `slot` (UInt64), `block_height` (UInt64)
  - `validator_identity` (binary - use `base58Encode()`) - **THIS IS THE BLOCK LEADER**
  - `parent_slot` (UInt64), `parent_blockhash` (String), `blockhash` (String)
  - `total_fee_lamports` (UInt64)
  - Note: This table identifies which validator was the leader who produced each block

- Each query accepts a `TimeRange` object (`{ from: string, to: string }`) as query params
- All date comparisons must use `parseDateTimeBestEffort()` to convert ISO timestamp strings
- Returns typed point arrays (e.g., `BundleLandingPoint[]`, `TransactionThroughputPoint[]`)
- `fetchTableSamples()` optionally fetches raw sample rows for debugging (used by `/api/table-samples`)

**Type Definitions** (`types.ts`):
- `TimeRange`: ISO timestamp strings for from/to
- Point types: `BundleLandingPoint`, `TransactionThroughputPoint`, `EntryVolumePoint`, `SlotStatusPoint`, `BlockMetadataPoint`
- `DashboardPayload`: aggregated response shape returned by `/api/dashboard`

### API Routes (`src/app/api/`)

**`/api/dashboard` (GET)**:
- Accepts optional query params: `from` and `to` (ISO timestamps)
- Defaults to 6 hours back if not provided
- Fetches all five metric series in parallel via `Promise.all`
- Returns a `DashboardPayload` JSON object
- Returns 500 with error message on failure

**`/api/table-samples` (GET)** (optional debugging endpoint):
- Fetches sample rows from each table to verify schema and connectivity

### UI Components (`src/components/`)

**DashboardClient** (`dashboard/dashboard-client.tsx`):
- Client component managing state, time range selector, and data refreshing
- Range selector buttons: 2h, 6h, 12h, 24h
- Uses `useTransition` for non-blocking data fetches
- Computes derived metrics (bundle totals, avg profit, TPS, entry rate, slot status distribution)
- Renders metric cards, sparkline charts (bundle landings, geyser throughput, entry ingest), slot status distribution, and block metadata snapshot

**MetricCard** (`dashboard/metric-card.tsx`):
- Displays a label, value, optional delta, and footer text

**MiniAreaChart** (`charts/mini-area-chart.tsx`):
- Simple SVG area chart for sparklines
- Accepts array of `{ timestamp: string, value: number }` points
- Configurable color and height

### Page Layout (`src/app/`)

**`page.tsx`**:
- Server component that performs initial data fetch (6h default)
- Passes `initialData` to `<DashboardClient />`

**`layout.tsx`**:
- Root layout with Tailwind dark theme styling

## CRITICAL: ClickHouse Query Limits

**DO NOT run excessive queries against the ClickHouse cluster.** This is Jito's shared public infrastructure.

- **NEVER** reload the page repeatedly or trigger multiple refreshes in quick succession
- **NEVER** run queries in a loop or make parallel requests that could multiply query load
- **ALWAYS** test queries with small time ranges first (1-2 hours) before expanding
- **ALWAYS** use slot-level aggregation BEFORE joining with other tables to minimize memory usage
- **AVOID** queries that scan the full `geyser_transactions` table without proper filtering
- **PREFER** server-side caching (Next.js revalidation) to reduce query frequency
- When developing new queries, test ONE query at a time and wait for completion before the next
- If a query is taking too long, do NOT retry - wait for it to complete or timeout

Running too many queries can take down the shared cluster and affect other users.

## Key Implementation Details

- **5-minute aggregation windows**: All time-series queries use `toStartOfInterval(..., INTERVAL 5 minute)` to bucket data
- **Field name mapping**: ClickHouse returns snake_case fields (e.g., `window_start`, `bundle_count`); query helpers transform these to camelCase TypeScript types
- **Server-only data access**: ClickHouse client is imported only in server-side code (`"server-only"` marker); client components fetch via `/api/dashboard`
- **Time range calculation**: Client component computes `from` and `to` based on selected hours and fetches fresh data on range change
- **Nullable aggregations**: Queries use `sumOrNull`, `avgOrNull` where appropriate; UI formats nulls as "—"
- **Error handling**: Failed queries return 500 from API; client displays error banner and reverts to previous time range selection
- you must use native not https