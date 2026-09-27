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

The comparison layer now treats the **asset/market as the primary object** and
maps it into venue-specific symbols. Initial canonical assets are BTC, ETH and
SOL.

Current normalized public-book collectors:

- Hyperliquid
- Orderly
- Paradex
- dYdX

GMX is intentionally handled as an oracle/liquidity-pool venue. The system reads
public market state but does **not** fabricate a CLOB orderbook or fake depth.

The admin preview can compare:

- best bid / ask and spread
- depth inside ±10 / 25 / 50 bps
- simulated market-order impact
- fill ratio at selected notional
- book freshness / degraded state
- effective cost only when an explicit account fee assumption is supplied

## BD / commercial track

The internal pipeline separates research state from actual outreach. A
`contact-ready` stage means desk research is sufficient to prepare outreach;
it does not claim that a venue has been contacted.

Priority research tracks:

- Orderly — white-label/shared-liquidity and builder economics
- GMX — custom frontend, UI fee/referral economics, pool execution model
- Paradex — CLOB/API attribution and onboarding
- dYdX — indexer/CLOB and institutional API
- Hyperliquid — baseline execution, builder codes and HIP-3 research

## Execution safety rule

A competitor venue stays **research-only** until every execution qualification
gate is evidenced. The current qualification matrix keeps Hyperliquid as the
only execution-qualified venue. Market-data collection never submits orders or
signs transactions.

## Data principles

- Every live measurement must carry a timestamp.
- Never mix historical documentation with live measurements without labeling.
- An unsupported venue metric is `null`, not zero.
- Different liquidity models are compared without pretending they are identical.
- Account/tier trading fees are not hard-coded when they can vary.
- Collector failure is isolated per venue instead of collapsing the full table.
