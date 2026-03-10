# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Next.js dashboard for monitoring Solana scheduler war metrics. All data is fetched exclusively through the **scheduler-war-api** NestJS backend — the dashboard makes no direct ClickHouse connections.

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

Copy `.env.example` to `.env.local` and configure:

- **Required**: `SCHEDULER_API_BASE_URL` — base URL of the scheduler-war-api backend (e.g. `http://127.0.0.1:3100`)
- **Required**: `SCHEDULER_API_KEY` — must match `INTERNAL_API_KEY` in the backend `.env`

No ClickHouse credentials are needed in the dashboard — those belong in the backend.

## Architecture

### Data Layer (`src/lib/`)

**Backend API Client** (`backend-api.ts`):
- All data fetching goes through `schedulerApiFetch` / `schedulerApiGet`
- Reads `SCHEDULER_API_BASE_URL` and `SCHEDULER_API_KEY` from env
- Adds `x-internal-api-key` header and prefixes paths with `/v1/`
- Marked `server-only` — never imported by client components

**Type Definitions** (`types.ts`):
- `TimeRange`, `ValidatorData`
- Dashboard point types: `BundleLandingPoint`, `TransactionThroughputPoint`, `EntryVolumePoint`, `SlotStatusPoint`, `BlockMetadataPoint`
- `DashboardPayload`: aggregated dashboard response shape
- `SlotDetail`, `SlotEntry`, `SlotTransaction`, `SlotMetadata`
- `LeaderTransition`, `TransitionStats`, `AxiomRoutingPayload`
- `PropAmmFirstWin`

**Prop AMM constants** (`prop-amm.ts`):
- `PROP_AMM_GROUPS`, `PROP_AMM_ACCOUNTS`, `PROP_AMM_GROUP_COLORS`
- Pure constants, no data fetching

### API Routes (`src/app/api/`)

All Next.js API routes are thin proxies that forward requests to the scheduler-war-api backend and strip the `meta` field from responses.

| Route | Proxies to |
|-------|-----------|
| `/api/dashboard` | `/v1/dashboard` |
| `/api/axiom-routing` | `/v1/axiom-routing` |
| `/api/validator-names` | `/v1/validators/names` |
| `/api/validator-search` | `/v1/validators/search` |
| `/api/validator-slots/[validator]` | `/v1/validators/[validator]/slots` |

Routes returning 410: `/api/test-schema`, `/api/table-samples` (removed; use backend diagnostics).

### Pages (`src/app/`)

All pages are server components that call `schedulerApiGet` directly. Client components fetch from the Next.js proxy routes listed above.

| Page | Backend endpoints used |
|------|----------------------|
| `/` | `/v1/validators` |
| `/slot-lagging` | `/v1/slot-lagging`, `/v1/validators`, `/v1/validators/names` |
| `/slot/[slot]` | `/v1/slots/:slot`, `/v1/validators/names`, `/v1/validators`, `/v1/validators/:v/slots` |
| `/axiom-routing` | `/v1/axiom-routing` |
| `/prop-amm-winrates` | `/v1/prop-amm/first-wins`, `/v1/prop-amm/winrates/epoch`, `/v1/prop-amm/winrates/recent` |
| `/prop-amm-comparison` | `/v1/validators/:v/slots`, `/v1/slots/:slot` |

### Backend API Endpoints (scheduler-war-api at `/v1/*`)

| Endpoint | Purpose |
|----------|---------|
| `GET /dashboard` | 5-metric dashboard (bundles, tx, entries, slot status, block metadata) |
| `GET /validators` | All validators with stake and client type |
| `GET /validators/search` | Search by name or address prefix |
| `GET /validators/names` | Batch validator name lookup |
| `GET /validators/:v/slots` | Recent slots led by a validator |
| `GET /slots/range/recent` | Recent slot range |
| `GET /slots/:slot` | Full slot detail |
| `GET /axiom-routing` | Leader transition analysis |
| `GET /slot-lagging` | Slot lagging metrics |
| `GET /prop-amm/first-wins` | Prop AMM first wins in slot range |
| `GET /prop-amm/winrates/recent` | Recent winrate cache |
| `GET /prop-amm/winrates/epoch` | Epoch winrate cache |
| `GET /health` | Health check |
