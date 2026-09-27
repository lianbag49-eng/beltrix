# BELTRIX Protocol

BELTRIX Protocol is the venue-independent control layer behind the BELTRIX
trading product.

The public application started Hyperliquid-first, but the protocol architecture
is intentionally separated from Hyperliquid-specific settlement.

## Core rule

**BELTRIX defines the user intent, market identity, oracle policy, risk policy
and settlement permissions. A settlement provider only settles an already
validated user-authorized action.**

This keeps the product from becoming a thin exchange skin.

## Current Phase 6-7 components

- venue-neutral user trade intents
- protocol market registry
- multi-source oracle consensus
- BELTRIX risk policies
- user-controlled settlement preferences
- settlement adapter registry
- Hyperliquid bootstrap settlement adapter
- explicit BELTRIX-native settlement research boundary
- governance-ready configuration proposals
- decentralization maturity state
- scoped BELTRIX operating roles
- unsigned HIP-3 hybrid deployment plan
- hybrid launch readiness gates

## Current execution path

```text
User Wallet
   |
   | creates / approves BELTRIX intent
   v
BELTRIX Protocol
   |
   +--> Market Registry
   +--> Oracle Consensus
   +--> Risk Policy
   +--> Governance-controlled Config
   |
   v
Settlement Adapter
   |
   +--> Hyperliquid today
   +--> BELTRIX HIP-3 markets (planned hybrid path)
   +--> Other qualified venues
   +--> BELTRIX-native settlement (research)
```

## Non-custodial boundary

The protocol modules never ask for, store or transmit a private key.

The settlement output is unsigned and explicitly marked as requiring the
user's wallet signature.

The existing BELTRIX wallet signing guard remains the final UI/session boundary.

## Hyperliquid bootstrap

Hyperliquid is currently the live bootstrap settlement provider.

BELTRIX may use:

- standard Hyperliquid perps for initial liquidity and market coverage
- Builder Codes for user-approved frontend economics
- HIP-3 as a future hybrid stage where BELTRIX operates its own perp DEX market
  definitions while inheriting HyperCore matching, margining and settlement

This is a bootstrap / hybrid strategy, not the definition of the final BELTRIX
protocol.

## BELTRIX-native target

The native settlement adapter is intentionally disabled for funds today.

Before it can become live, BELTRIX needs at minimum:

1. audited settlement contracts or a dedicated chain/rollup
2. onchain market registry
3. onchain risk parameters
4. independent oracle consensus
5. permissionless user signing
6. margin / position accounting
7. liquidation engine
8. insurance or backstop policy
9. governance and upgrade controls
10. emergency halt / recovery
11. public state indexing

No native-settlement claim should be made before these are implemented,
audited and tested.

## Governance path

Phase 6 provides a pure governance-ready configuration model with:

- authorized signers
- quorum
- timelock
- config proposals
- approvals
- activation readiness

This is not yet onchain governance. The goal is to define protocol state
semantics now so a multisig / DAO / onchain governor can later own the same
configuration surface.

## Decentralization stages

### Bootstrap
BELTRIX owns its control layer but uses external decentralized settlement.

### Hybrid
BELTRIX owns markets, oracle/risk policy and multi-party control while using an
external consensus/matching substrate such as a BELTRIX HIP-3 DEX.

### Native
BELTRIX owns the complete onchain state / settlement layer and all required
decentralization components are live.

The current code intentionally reports **bootstrap**, not native.


## Phase 7 hybrid path

BELTRIX can now derive an **unsigned HIP-3 deployment plan** from its own market
registry and protocol policy.

The plan covers market definition, oracle updater, margin table, open-interest
cap, fee recipient and scoped sub-deployer permissions.

This does not make the HIP-3 DEX live. The current readiness matrix remains
blocked on independent oracle operation, multisig/timelock ownership, incident
recovery, testnet deploy/trading E2E, liquidation review and fee reconciliation.

The goal is to make Hyperliquid a replaceable / inherited settlement substrate,
not the owner of BELTRIX market semantics.
