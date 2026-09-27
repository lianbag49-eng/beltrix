# BELTRIX Project Status

**Updated:** 2026-09-27  
**Positioning:** BELTRIX decentralized derivatives protocol in bootstrap stage; Hyperliquid is the current settlement substrate, not the protocol identity.

## Public product

The public BELTRIX product remains a Hyperliquid-first terminal.

Current public scope:

- perpetual market discovery
- asset-first market navigation
- official asset logos
- chart and orderbook integration
- futures trading interface
- mobile / desktop responsive UI
- explicit builder-fee consent
- referral / campaign attribution foundation
- venue-adapter foundation

Public URL:

https://lianbag49-eng.github.io/beltrix/

## Internal Market Intelligence

### Phase 1 — Venue / BD foundation
Completed:

- venue registry
- BD comparison matrix
- fee / commercial model research
- white-label candidate research
- execution qualification gates

### Phase 2 — Asset-first DEX normalization
Completed:

- canonical BTC / ETH / SOL market mapping
- Hyperliquid / Orderly / Paradex / dYdX public-book normalization
- spread / depth / market-impact / fill-ratio simulation
- account-specific fee assumptions
- GMX pool-model separation

### Phase 3 — Operational Market Intelligence
Completed:

- sourced Orderly / GMX / Paradex / dYdX research profiles
- external documentation vs BELTRIX implementation/test-state separation
- GMX long/short JIT-aware trading capacity
- research-coverage and execution-gate visibility

### Phase 4 — Market metrics and local history
Completed:

- Hyperliquid funding / OI / 24h volume
- Paradex funding / OI / 24h volume with venue-native-unit preservation
- dYdX market-metric guarded parsing
- API latency collection
- browser-local 7-day telemetry history
- optional 60-second / 5-minute internal auto snapshot
- API health history

### Phase 5 — Alerts / trends / server persistence readiness
Completed:

- venue health alert engine
- collector outage alerts
- stale-data alerts
- API latency / success-ratio alerts
- simulated partial-fill alerts
- material depth-drop alerts
- funding / OI / volume / latency / spread / depth trend series
- internal SVG trend visualization
- Market Intelligence → BD follow-up events
- reusable server collector runner
- PostgreSQL persistence schema
- storage repository contract
- injected Postgres adapter
- server collector deployment documentation

## Phase 6 — BELTRIX Protocol Core
Completed:

- venue-independent BELTRIX Trade Intent
- BELTRIX canonical Market Registry
- multi-source Oracle Consensus
- BELTRIX Risk Policy
- user-controlled Settlement Preferences
- Settlement Adapter Registry
- Hyperliquid bootstrap settlement adapter
- disabled BELTRIX-native research adapter
- governance-ready signer / quorum / timelock proposals
- decentralization maturity state
- protocol-specific unit and regression validation

## Phase 7 — BELTRIX HIP-3 Hybrid planning
Implemented in code and under validation:

- BELTRIX protocol operating roles
- scoped oracle / risk / emergency / fee / market admin permissions
- unsigned HIP-3 deploy plan
- market definition derived from BELTRIX Market Registry
- Oracle updater policy
- Margin / OI cap / fee recipient planning
- Sub-deployer permission expansion
- Hybrid launch readiness gates

This is not a live HIP-3 deployment and does not yet enable user funds.

## Current execution boundary

**Execution-qualified / public baseline:**
- Hyperliquid

**Research-only:**
- Orderly
- GMX
- Paradex
- dYdX
- Drift

No competitor venue is promoted into live execution merely because an external API or testnet exists.

Required internal qualification includes:

1. public market data
2. canonical symbol mapping
3. normalized liquidity model
4. fee model
5. execution-cost model
6. signing model
7. order lifecycle
8. position reconciliation
9. rate limits
10. regional policy
11. failure recovery
12. paper / testnet E2E

## White-label track

Current primary research paths:

### Orderly
- shared liquidity
- DEX creation
- builder / broker economics
- custom frontend
- fee configuration
- domain / branding
- operational dependency and exit review

### Hyperliquid
- builder codes
- HIP-3 market-creation research

### GMX
- custom frontend
- UI fee / referral economics
- pool / JIT execution model

## Storage / 24x7 monitoring status

The normalized server storage layer is ready in code.

Prepared components:

- `storage/postgres-schema.sql`
- `storage/telemetry-repository.js`
- `storage/postgres-adapter.js`
- `collector-runner.js`

The PostgreSQL schema is **not yet applied to a BELTRIX production database**.

Current active historical storage remains browser-local. A real 24x7 service requires:

1. dedicated BELTRIX backend project/database
2. reviewed schema migration
3. secured backend runtime
4. scheduled collector
5. authenticated internal read API
6. retention / recovery / alert-deduplication validation

Database credentials must never be embedded into the static public frontend.

## Commercial / BD positioning

BELTRIX should currently be introduced as:

> A decentralized derivatives protocol in bootstrap stage, using Hyperliquid as the current settlement substrate while BELTRIX owns the market, intent, oracle, risk, governance and settlement-abstraction layers.

Do not currently describe BELTRIX as:

- an independent DEX with its own orderbook/liquidity
- a router that already executes across every DEX
- officially partnered with Orderly, GMX, Paradex or dYdX unless such partnership is actually signed

## Next engineering milestones

1. bind a dedicated BELTRIX backend database
2. deploy scheduled server collector
3. replace local-only history with authenticated server history
4. add server-backed alert lifecycle: open / acknowledge / resolve
5. add retention and aggregation jobs
6. extend canonical assets beyond BTC / ETH / SOL
7. implement isolated competitor testnet adapters
8. complete execution qualification one venue at a time
9. prepare first commercial white-label deployment
10. validate BELTRIX HIP-3 plan on testnet / isolated environment
11. deploy multisig + timelock ownership for protocol configuration
12. activate independent oracle operators
13. research BELTRIX-native margin / liquidation / settlement prototype
