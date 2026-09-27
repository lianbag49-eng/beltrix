# BELTRIX — Competitor DEX BD / Infrastructure Review

Updated: 2026-09-27

## Operating rule

The public BELTRIX terminal stays Hyperliquid-first. Competitor venues enter this workflow as research / BD / infrastructure candidates, not as automatic execution venues.

## BD workstreams

### Hyperliquid — Core relationship
Current BELTRIX execution venue. Maintain builder/API integration, builder-code economics, referral attribution, account-mode compatibility and HIP-3 monitoring.

### Orderly — White-label / multi-chain workstream
Primary question: can Orderly accelerate a second branded product or region-specific DEX without duplicating matching/liquidity infrastructure?

Due diligence:
- builder/broker commercial terms
- current base fee tiers vs user-facing fee spread
- supported chains and deposit paths
- custom domain / hosted vs custom frontend
- referral / leaderboard / campaign surfaces
- market-listing process
- test environment and signing model

### GMX — UI-fee / referral workstream
Primary question: can BELTRIX use a custom GMX frontend/integration for markets where a pool-based execution model is useful?

Due diligence:
- current MAX_UI_FEE_FACTOR
- referral tier qualification and partner terms
- supported market/network coverage
- Express/one-click order path
- historical attribution through uiFeeFactor
- gas/execution-fee economics

### dYdX — Affiliate + appchain benchmark
Primary question: whether the lifetime affiliate model and independent appchain liquidity justify a BELTRIX distribution partnership.

Due diligence:
- current governance fee schedule
- affiliate qualification / caps / restricted jurisdictions
- indexer and node SLA
- signing/subaccount/rate-limit model
- current market depth for BELTRIX target assets

### Paradex — Attribution / portfolio-margin benchmark
Primary question: use Paradex as a benchmark for referral_code + marketing_code + UTM onboarding and portfolio-margin UX.

Due diligence:
- direct current liquidity/OI telemetry
- current Pro vs Retail classification
- referral/affiliate economics after the ended TAP campaign
- onboarding/signing architecture
- market and product coverage

### Drift — Solana research
Current public aggregator perp telemetry is inconsistent. Before any commercial or execution comparison:
- pull live protocol-state volume/OI
- verify current fee schedule
- verify SDK and signing model
- determine current referral/partner program
- review current protocol/security state

### Aevo — Options / structured-product research
Useful differentiation is options + perps + OTC + MCP rather than raw perp scale.

Due diligence:
- current perps fee schedule
- current exchange-referral terms
- API/MCP commercial use
- options/OTC liquidity by underlying
- whether a partner/embed model exists

## Execution-venue admission

No competitor venue can be enabled in funded BELTRIX routing until every gate in execution-gates.js passes:
1. reliable telemetry
2. trading API
3. safe test path
4. reconciliation
5. fee economics
6. risk/oracle/liquidation review
7. jurisdiction/product review
8. signing/security review
9. funded E2E approval

This prevents research integrations from silently becoming live execution paths.

## Aster — Builder / Agent Wallet workstream
Stage: Technical review

Primary question: whether Aster's explicit Builder and Agent Wallet APIs make it a useful second execution/distribution candidate after BELTRIX's Hyperliquid core is stable.

Verified technical points in the current official API repository:
- V3 is the recommended integration path.
- Futures orders support builder attribution and fee-rate fields.
- builder-approved-user endpoints expose maxFeeRate / builder identity.
- Builder / Agent Wallet / public market data endpoints remain available under the September 2026 deposit prerequisite that applies to authenticated trading/account endpoints.

Due diligence before any funded POC:
1. commercial builder onboarding and fee settlement
2. allowed max fee policy and user approval UX
3. V3 futures testnet reconciliation
4. agent-wallet permission revocation / recovery
5. rate limits and operational SLA
6. jurisdiction/product review
