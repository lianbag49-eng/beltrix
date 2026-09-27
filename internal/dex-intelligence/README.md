# BELTRIX Internal DEX Intelligence

This directory is **internal research/admin infrastructure**.

The public BELTRIX trading product remains **Hyperliquid-first**. Nothing under
`internal/dex-intelligence/` is copied by `web/prepare-site.mjs`.

## Scope

1. Competitive DEX data comparison
2. BD partnership review
3. Fees / liquidity comparison
4. Future white-label infrastructure research
5. Internal Admin / Market Intelligence
6. Optional future execution venue evaluation

## Phase 2 — asset-first normalization

The comparison layer treats the **asset/market as the primary object** and maps
it into venue-specific symbols. Initial canonical assets are BTC, ETH and SOL.

Normalized public-book collectors:

- Hyperliquid
- Orderly
- Paradex
- dYdX

GMX is handled as an oracle/liquidity-pool venue. The system does **not**
fabricate a CLOB orderbook or fake depth for GMX.

## Phase 3 — operational Market Intelligence

Phase 3 adds three layers without enabling competitor execution.

### 1. GMX JIT-aware capacity

BELTRIX reads the current GMX API trading-capacity surface for both long and
short directions. Raw capacity values are 30-decimal USD values and are
normalized before display.

The collector records:

- total available capacity
- base pool capacity
- JIT capacity
- limiting factor
- JIT data status
- market data status

Capacity is **indicative**, not a request-specific execution guarantee.
Request preparation, account eligibility, collateral swaps and intervening
market state can still change executable size.

### 2. Sourced venue research

`venue-research.js` separates external documentation from BELTRIX's own
implementation/testing state.

Current research tracks:

- **Orderly** — DEX creation, broker graduation, fee settings, shared liquidity,
  and remaining migration/exit due diligence.
- **GMX** — JIT-aware trading capacity, pool/open-interest price impact and risk
  controls.
- **Paradex** — short-lived JWT auth, signed orders, NEW/OPEN/CLOSED lifecycle,
  rate limits, private websocket reconciliation and testnet surfaces.
- **dYdX** — indexer/node separation, chain order placement/cancellation,
  websocket/subaccount reads and testnet client configuration.

A capability being documented externally never marks it as implemented or
tested inside BELTRIX.

### 3. Internal Market Intelligence dashboard

The Admin preview now shows descriptive per-venue telemetry:

- data availability / degradation
- spread and ±25 bps depth for normalized CLOB venues
- simulated buy/sell market impact and minimum fill ratio
- GMX long/short JIT-aware capacity
- execution qualification gate count
- internal research coverage
- operational flags such as stale, partial fill, collector error,
  model-specific and research-only

The dashboard deliberately does **not** rank venues or auto-select a new
execution venue.

## BD / commercial track

The internal pipeline separates research state from actual outreach. A
`contact-ready` stage means desk research is sufficient to prepare outreach;
it does not claim that a venue has been contacted.

Priority tracks:

- Orderly — white-label/shared-liquidity and builder economics
- GMX — custom frontend, UI fee/referral economics, pool/JIT execution model
- Paradex — CLOB/API attribution and onboarding
- dYdX — indexer/CLOB and institutional API
- Hyperliquid — baseline execution, builder codes and HIP-3 research

## Execution safety rule

A competitor venue stays **research-only** until every execution qualification
gate is evidenced by BELTRIX implementation/testing. Current external
documentation for Paradex, dYdX, GMX or Orderly does not change that rule.

Market-data collection never submits orders or signs transactions.

## Data principles

- Every live measurement must carry a timestamp when the source provides one.
- Never mix historical documentation with live measurements without labeling.
- An unsupported venue metric is `null`, not zero.
- Different liquidity models are compared without pretending they are identical.
- Account/tier trading fees are not hard-coded when they can vary.
- Collector failure is isolated per venue instead of collapsing the full table.
- 30-decimal protocol values are normalized explicitly before presentation.


## Phase 4 — funding / OI / volume / API health history

Phase 4 adds local time-series telemetry to the internal Admin.

### Metric collectors

Currently normalized where the public source semantics are sufficiently clear:

- Hyperliquid: mark price, current funding, open interest in base units, estimated
  open-interest USD using mark price, and daily notional volume.
- Paradex: mark price, funding, open interest and 24h volume. OI/volume are
  retained as venue-native values rather than being mislabeled as USD.
- dYdX: guarded parsing of indexer market data for mark/oracle price, next
  funding, open interest and 24h volume. Values remain venue-native unless the
  unit is explicitly normalized.

Orderly remains part of book/liquidity/API-health monitoring while its market
metric field semantics are normalized separately.

### Local telemetry history

Each internal Admin refresh can persist a snapshot containing:

- collector success/failure
- API latency
- spread and depth
- minimum simulated fill ratio
- funding / OI / 24h volume when normalized
- GMX long/short trading capacity

History uses browser local storage, retains at most 720 snapshots and prunes
entries older than 7 days. This is **not** a server-side 24/7 monitoring
service; collection occurs while the internal Admin is being used or its
optional auto-snapshot timer is active.

The history module is intentionally storage-agnostic so the same normalized
snapshot format can later be moved to a database-backed collector.
