# BELTRIX Market Intelligence

Internal research workspace for competitor DEX monitoring, BD due diligence, fee/liquidity comparison, white-label infrastructure review, and future execution-venue evaluation.

## Product boundary
This folder is **not** part of the public BELTRIX trading UI and is not copied by `web/prepare-site.mjs`.

BELTRIX user-facing trading remains Hyperliquid-first. No venue in this research dashboard is automatically enabled for funded execution.

## Workstreams
1. **Competitor data comparison** — direct public telemetry where a verified collector exists, otherwise a dated source-backed research snapshot.
2. **BD partnership review** — pipeline, contact route, commercial questions, next action.
3. **Fee / liquidity comparison** — protocol fee + spread + depth + market impact + execution/funding/bridge cost methodology.
4. **White-label infrastructure** — custom frontend vs turnkey DEX creator vs API-only integration.
5. **Admin / Market Intelligence** — internal dashboard, change watch, data-confidence state and execution admission.
6. **Future execution venue** — disabled unless every execution gate passes.

## Current venue set
Hyperliquid, Orderly, GMX, dYdX v4, Paradex, Aster, Drift, Aevo.

## Live collector
```bash
node internal/market-intelligence/collect-live.mjs
```

The collector currently has direct public adapters for:
- Hyperliquid
- Orderly
- Paradex
- dYdX
- Aster

Unsupported venues remain explicitly `unavailable`; the code never invents missing OI/volume.

A GitHub Actions workflow also creates a timestamped telemetry artifact daily after this work reaches the default branch.

## Data model
`schema.sql` prepares tables for:
- venue telemetry
- BD pipeline
- execution admission reviews
- change-watch events

The migration is source-only until an internal authenticated Admin backend is selected.

## Update policy
Every commercial decision must re-check the linked official source and current telemetry. Direct venue/API observation is preferred over aggregator data. Static values are for BD triage, never automatic routing.
