# White-label Infrastructure Review

## BELTRIX public product
Primary product remains a Hyperliquid frontend.

## Hyperliquid
Model:
- build/own custom frontend
- route to Hyperliquid
- Builder Codes for optional frontend economics after explicit user approval
- Referral attribution
- HIP-3 for permissionless builder-deployed perp markets

Use when:
- BELTRIX UX/brand is primary
- Hyperliquid liquidity/execution remains primary
- team wants full frontend control

Not a turnkey hosted white-label creator.

## Orderly
Model:
- DEX Creator / Broker infrastructure
- shared liquidity
- configurable user fees / builder economics
- multi-chain distribution
- growth/referral tools

Use when:
- launching a second branded DEX quickly
- multi-chain distribution is more important than Hyperliquid-only execution
- avoiding a duplicate matching/liquidity stack

Current status: strongest turnkey white-label candidate in this research set, subject to commercial/API validation.

## GMX
Model:
- custom frontend integration
- pool-based perps execution
- UI fee receiver
- referrals

Use when:
- pool-based onchain execution is strategically useful
- Arbitrum/Avalanche/MegaETH market exposure matters

Not a turnkey DEX creator in the same sense as Orderly.

## dYdX / Paradex / Drift / Aevo
Treat primarily as API/protocol integrations until a current turnkey white-label commercial product is verified.

## Decision gate
No second white-label product is launched until:
- economics model is signed off
- target-region product policy is reviewed
- auth/signing/key architecture passes security review
- attribution and payout reconciliation exist
- staged testnet/simulation E2E passes
