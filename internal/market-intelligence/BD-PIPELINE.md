# BELTRIX DEX BD Pipeline

Updated: 2026-09-27

## Pipeline stages
Research → Contact target identified → Intro sent → Technical call → Commercial terms → Security/compliance review → POC → Approved / Hold

## Hyperliquid
Stage: Core / ongoing
Objective:
- maintain Builder/API relationship
- verify builder-code economics before enabling any BELTRIX fee
- monitor HIP-3 changes and asset/account semantics
- referral attribution + user acquisition

## Orderly
Stage: Technical/commercial review
Objective:
- request current Builder / Broker commercial terms
- test DEX Creator API and multi-chain launch flow
- confirm base fee tiers, builder spread economics and referral tooling
- determine whether a region/product-specific BELTRIX spinout can use shared liquidity

Questions for call:
1. Current base fee schedule by builder volume tier?
2. Revenue-share / settlement timing?
3. Custom domain, branding and frontend ownership?
4. Referral, leaderboard, competition APIs?
5. Market listing / RWA listing process?
6. Test environment, rate limits and signing/key architecture?

## GMX
Stage: Integration/partner review
Objective:
- confirm current UI fee cap and claim path
- confirm affiliate tier eligibility
- test custom frontend + referral attribution
- normalize gas/execution cost into fee comparison

Questions:
1. Current MAX_UI_FEE_FACTOR?
2. Partner/referral tier process?
3. Recommended Express/one-click architecture?
4. Supported market/network expansion roadmap?

## dYdX v4
Stage: Affiliate / appchain review
Objective:
- current affiliate commercial terms
- current fee tier/governance state
- API/indexer/node reliability
- market depth for BELTRIX target cohort

## Paradex
Stage: Attribution benchmark / watch
Objective:
- validate current referral/marketing-code program
- confirm current retail vs Pro fee classification
- verify direct market telemetry because public OI snapshots disagree

## Drift
Stage: Data validation first
No BD sizing decision until direct protocol telemetry replaces inconsistent aggregator snapshots.

## Aevo
Stage: Product differentiation watch
Primary BD angle is options / structured products / API-MCP capability rather than raw perp volume.
